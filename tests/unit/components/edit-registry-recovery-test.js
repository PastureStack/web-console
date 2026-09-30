import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { defer, resolve } from 'rsvp';
import { module, test } from 'qunit';

import EditRegistry from 'ui/components/edit-registry/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | edit-registry recovery');

test('a registry without credentials opens safely and checks the server before adding one', async function(assert) {
  let creates = 0;
  let saves = 0;
  let saveOptions;
  let reads = 0;
  let credentials = A([]);
  let pendingRead = null;
  let canCreate = true;
  const projects = EmberObject.create({
    current: EmberObject.create({id: 'project-1'}),
    schemaProjectId: 'project-1',
    canCreateResource(type) {
      assert.strictEqual(type, 'registryCredential');
      return canCreate;
    },
  });
  const store = EmberObject.create({
    createRecord(data) {
      creates++;
      return EmberObject.create({
        ...data,
        publicValue: 'test-user',
        validationErrors() { return A([]); },
        save(options) { saves++; saveOptions = options; return resolve(this); },
      });
    },
    find(type, id, options) {
      reads++;
      assert.strictEqual(type, 'registrycredential');
      assert.strictEqual(id, null);
      assert.true(options.forceReload, 'the orphan path bypasses a cached collection');
      return pendingRead ? pendingRead.promise : resolve(credentials);
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
    projects,
    modalService: EmberObject.create({modalOpts: EmberObject.create({registry, credential: null, registries: A([registry]), projectId: 'project-1'})}),
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
  assert.strictEqual(saveOptions, undefined, 'the missing-credential POST path keeps its original save call');

  canCreate = false;
  projects.incrementProperty('schemaLoadGeneration');
  assert.false(component.get('canSaveCredential'), 'schema revocation disables the open modal');
  try {
    await component.doSave();
    assert.ok(false, 'a revoked creator must not submit');
  } catch (error) {
    assert.strictEqual(error.status, 403);
    assert.strictEqual(error.messageKey, 'resourceSaveError.unavailable');
  }
  assert.strictEqual(reads, 2, 'a denied save makes no collection request');
  assert.strictEqual(saves, 1, 'a denied save makes no POST');

  canCreate = true;
  projects.incrementProperty('schemaLoadGeneration');
  pendingRead = defer();
  const submission = component.doSave();
  canCreate = false;
  projects.incrementProperty('schemaLoadGeneration');
  pendingRead.resolve(A([]));
  try {
    await submission;
    assert.ok(false, 'revocation during the collection read must stop POST');
  } catch (error) {
    assert.strictEqual(error.status, 403);
  }
  assert.strictEqual(reads, 3);
  assert.strictEqual(saves, 1);
  destroyOwned(component);
});

test('editing an existing credential sends only the editable fields', async function(assert) {
  const saveCalls = [];
  let registrySaves = 0;
  let reads = 0;
  let freshCredential = EmberObject.create({
    id: 'credential-1',
    registryId: 'registry-1',
    actionLinks: {update: '/credential-1'},
  });
  const saved = EmberObject.create({id: 'credential-1'});
  const editedCredential = EmberObject.create({
    id: 'credential-1',
    type: 'registryCredential',
    registryId: 'registry-1',
    email: 'synthetic@invalid.test',
    state: 'active',
    created: '2026-01-01T00:00:00Z',
    publicValue: 'edited-user',
    secretValue: 'synthetic-test-value',
    validationErrors() {
      const value = this.get('secretValue');
      if ( typeof value === 'string' ) {
        this.set('secretValue', value.trim());
      }
      return A([]);
    },
    save(options) {
      saveCalls.push(options);
      return resolve(saved);
    },
  });
  const registry = EmberObject.create({
    id: 'registry-1',
    serverAddress: 'registry.invalid.test',
    store: {
      find(type, id, options) {
        reads++;
        assert.strictEqual(type, 'registrycredential');
        assert.strictEqual(id, 'credential-1');
        assert.true(options.forceReload, 'PUT capability is fetched again before saving');
        return resolve(freshCredential);
      },
    },
    clone() { return EmberObject.create({id: this.get('id')}); },
    save() { registrySaves++; return resolve(this); },
  });
  const originalCredential = EmberObject.create({
    secretValue: 'api-value-must-not-be-retransmitted',
    actionLinks: {update: '/credential-1'},
    clone() { return editedCredential; },
  });
  const projects = EmberObject.create({current: EmberObject.create({id: 'project-1'}), schemaProjectId: 'project-1'});
  const component = createOwned(EditRegistry, {
    renderer: inertRenderer(),
    intl: EmberObject.create({t(key) { return key; }}),
    projects,
    modalService: EmberObject.create({modalOpts: EmberObject.create({
      registry,
      credential: originalCredential,
      registries: A([registry]),
      projectId: 'project-1',
    })}),
  }, 'component');

  assert.false(component.get('missingCredential'));
  assert.strictEqual(editedCredential.get('secretValue'), '', 'the edit clone starts with an empty password input');
  assert.strictEqual(originalCredential.get('secretValue'), 'api-value-must-not-be-retransmitted',
    'initializing the edit input does not change the original credential');
  editedCredential.set('secretValue', ' synthetic-test-value ');
  assert.true(component.willSave(), 'the normal Save path validates before building the PUT');
  assert.strictEqual(editedCredential.get('secretValue'), ' synthetic-test-value ',
    'validation does not trim an explicitly entered password');
  assert.strictEqual(await component.doSave(), saved, 'the inherited save result is preserved');
  assert.deepEqual(Object.keys(saveCalls[0]), ['data']);
  assert.deepEqual(JSON.parse(JSON.stringify(saveCalls[0].data)), {
    publicValue: 'edited-user',
    secretValue: ' synthetic-test-value ',
  }, 'cloned metadata and registry fields are excluded; password whitespace is preserved');

  for ( const input of [
    {name: 'null', value: null},
    {name: 'undefined', value: undefined},
    {name: 'empty string', value: ''},
    {name: 'missing', missing: true},
  ] ) {
    if ( input.missing ) {
      delete editedCredential.secretValue;
    } else {
      editedCredential.set('secretValue', input.value);
    }
    component.set('saving', false);
    assert.true(component.willSave(), `${input.name} password input still validates`);
    await component.doSave();
    assert.deepEqual(saveCalls[saveCalls.length - 1].data, {publicValue: 'edited-user'},
      `${input.name} password input is omitted to preserve the stored password`);
  }
  assert.strictEqual(reads, 5, 'each PUT checks current child capabilities');

  freshCredential = EmberObject.create({
    id: 'credential-1',
    registryId: 'registry-1',
    actionLinks: {},
  });
  try {
    await component.doSave();
    assert.ok(false, 'a revoked child update link must stop PUT');
  } catch (error) {
    assert.strictEqual(error.status, 403);
    assert.strictEqual(error.messageKey, 'resourceSaveError.unavailable');
  }
  assert.strictEqual(saveCalls.length, 5);

  freshCredential = EmberObject.create({
    id: 'credential-1',
    registryId: 'another-registry',
    actionLinks: {update: '/credential-1'},
  });
  try {
    await component.doSave();
    assert.ok(false, 'a credential linked to another registry must not be updated');
  } catch (error) {
    assert.strictEqual(error.status, 404);
    assert.strictEqual(error.messageKey, 'resourceSaveError.unavailable');
  }
  assert.strictEqual(saveCalls.length, 5);

  originalCredential.set('actionLinks', {});
  assert.false(component.get('canSaveCredential'), 'a cached link revocation disables Save');
  originalCredential.set('actionLinks', {update: '/credential-1'});
  projects.set('current.id', 'project-2');
  assert.false(component.get('canSaveCredential'), 'an open editor cannot save into another project');
  assert.strictEqual(registrySaves, 0, 'the registry itself is not saved by this editor');
  destroyOwned(component);
});

test('cancel discards the credential edit clone without saving either resource', function(assert) {
  let saves = 0;
  let reads = 0;
  let cancels = 0;
  const originalCredential = EmberObject.create({
    id: 'credential-1', registryId: 'registry-1', publicValue: 'original-user', secretValue: null,
    actionLinks: {update: '/credential-1'},
    clone() {
      return EmberObject.create({
        id: this.get('id'), registryId: this.get('registryId'),
        publicValue: this.get('publicValue'), secretValue: this.get('secretValue'),
        save() { saves++; return resolve(this); },
      });
    },
    save() { saves++; return resolve(this); },
  });
  const registry = EmberObject.create({
    id: 'registry-1',
    store: {find() { reads++; return resolve(originalCredential); }},
    clone() { return EmberObject.create({id: this.get('id')}); },
    save() { saves++; return resolve(this); },
  });
  const modalService = EmberObject.create({
    modalOpts: EmberObject.create({registry, credential: originalCredential,
      registries: A([registry]), projectId: 'project-1'}),
    toggleModal() { cancels++; },
  });
  const component = createOwned(EditRegistry, {
    renderer: inertRenderer(), intl: EmberObject.create({t(key) { return key; }}),
    projects: EmberObject.create({current: EmberObject.create({id: 'project-1'}), schemaProjectId: 'project-1'}),
    modalService,
  }, 'component');
  const clone = component.get('model.credential');
  assert.notStrictEqual(clone, originalCredential, 'the editor has a separate credential');
  assert.strictEqual(clone.get('secretValue'), '', 'an API null starts as an empty edit input');
  clone.setProperties({publicValue: 'cancelled-user', secretValue: 'cancelled-password'});
  component.send('cancel');
  assert.strictEqual(cancels, 1, 'Cancel closes the modal');
  assert.strictEqual(originalCredential.get('publicValue'), 'original-user');
  assert.strictEqual(originalCredential.get('secretValue'), null, 'the original API value is unchanged');
  assert.strictEqual(reads, 0, 'Cancel does not enter the save guard');
  assert.strictEqual(saves, 0, 'Cancel saves neither the credential nor its parent');
  destroyOwned(component);
});

test('existing password preservation retains validation errors and other field normalization', function(assert) {
  let throws = false;
  const editedCredential = EmberObject.create({
    publicValue: '  edited-user  ', secretValue: '  new-password  ',
    validationErrors() {
      this.set('publicValue', this.get('publicValue').trim());
      this.set('secretValue', this.get('secretValue').trim());
      if ( throws ) {
        throw new Error('validation failed');
      }
      return A(['original validation error']);
    },
  });
  const registry = EmberObject.create({clone() { return EmberObject.create(); }});
  const component = createOwned(EditRegistry, {
    renderer: inertRenderer(), intl: EmberObject.create({t(key) { return key; }}),
    projects: EmberObject.create(),
    modalService: EmberObject.create({modalOpts: EmberObject.create({registry,
      credential: EmberObject.create({clone() { return editedCredential; }}), registries: A([registry])})}),
  }, 'component');
  editedCredential.set('secretValue', '  new-password  ');
  assert.false(component.validate(), 'the original validation result is retained');
  assert.deepEqual(component.get('errors'), ['original validation error'], 'the original errors are retained');
  assert.strictEqual(editedCredential.get('publicValue'), 'edited-user', 'other field normalization still applies');
  assert.strictEqual(editedCredential.get('secretValue'), '  new-password  ');
  throws = true;
  assert.throws(() => component.validate(), /validation failed/, 'validation exceptions still propagate');
  assert.strictEqual(editedCredential.get('secretValue'), '  new-password  ', 'the input is restored even on an exception');
  destroyOwned(component);
});
