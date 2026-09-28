import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';

import EditRegistry from 'ui/components/edit-registry/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | edit-registry recovery');

test('a registry without credentials opens safely and checks the server before adding one', async function(assert) {
  let creates = 0;
  let saves = 0;
  let reads = 0;
  let credentials = A([]);
  const store = EmberObject.create({
    createRecord(data) {
      creates++;
      return EmberObject.create({
        ...data,
        publicValue: 'test-user',
        validationErrors() { return A([]); },
        save() { saves++; return resolve(this); },
      });
    },
    find(type, id, options) {
      reads++;
      assert.strictEqual(type, 'registrycredential');
      assert.strictEqual(id, null);
      assert.true(options.forceReload, 'the orphan path bypasses a cached collection');
      return resolve(credentials);
    },
  });
  const registry = EmberObject.create({
    id: 'registry-1',
    serverAddress: 'quay.io',
    store,
    clone() { return EmberObject.create({id: this.get('id'), serverAddress: this.get('serverAddress')}); },
  });
  const component = createOwned(EditRegistry, {
    renderer: inertRenderer(),
    intl: EmberObject.create({t(key) { return key; }}),
    modalService: EmberObject.create({modalOpts: EmberObject.create({registry, credential: null, registries: A([registry])})}),
  }, 'component');

  assert.true(component.get('missingCredential'), 'no clone() call on a missing credential');
  assert.true(component.get('editing'), 'the Edit Registry modal keeps a Save button while adding missing credentials');
  assert.strictEqual(creates, 1);
  credentials = A([EmberObject.create({registryId: 'registry-1', publicValue: 'other-user'})]);
  try {
    await component.doSave();
    assert.ok(false, 'a credential appearing meanwhile must stop the save');
  } catch (error) {
    assert.strictEqual(error.message, 'editRegistry.credentialAppeared');
  }
  assert.strictEqual(saves, 0);
  credentials = A([]);
  await component.doSave();
  assert.strictEqual(reads, 2);
  assert.strictEqual(saves, 1, 'only the still-empty orphan path submits a credential');
  destroyOwned(component);
});
