import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { defer, resolve } from 'rsvp';
import { module, test } from 'qunit';

import Registry from 'ui/models/registry';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Model | registry edit permissions');

test('Edit follows the credential write capability and rechecks it when opening', async function(assert) {
  let credential = EmberObject.create({registryId: 'registry-1', actionLinks: {}});
  let credentials = A([credential]);
  let canCreate = true;
  let findCalls = 0;
  let nextFind = null;
  let opened = [];
  let projects = EmberObject.create({
    current: EmberObject.create({id: 'project-1'}),
    schemaProjectId: 'project-1',
    schemaLoadGeneration: 0,
    canCreateResource(type) {
      assert.strictEqual(type, 'registryCredential');
      return this.get('current.id') === this.get('schemaProjectId') && canCreate;
    },
  });
  let registry = createOwned(Registry, {
    id: 'registry-1',
    actionLinks: {update: '/registry-1'},
    projects,
    store: {
      all(type) {
        assert.strictEqual(type, 'registrycredential');
        return credentials;
      },
      find(type) {
        assert.strictEqual(type, 'registry');
        findCalls++;
        return nextFind || resolve(A([registry]));
      },
    },
    modalService: {
      toggleModal(name, options) {
        assert.strictEqual(name, 'edit-registry');
        opened.push(options);
      },
    },
  }, 'model');
  const editEnabled = () => registry.get('availableActions').findBy('action', 'edit').enabled;
  const open = () => registry.actions.edit.call(registry);

  assert.false(editEnabled(), 'the parent update link cannot authorize a child PUT');
  await open();
  assert.strictEqual(findCalls, 0);

  credential.set('actionLinks', {update: '/credential-1'});
  registry.set('actionLinks', {});
  assert.true(editEnabled(), 'the child update link allows editing without a parent update link');
  await open();
  assert.strictEqual(opened.length, 1);
  assert.strictEqual(opened[0].get('credential'), credential);
  assert.strictEqual(opened[0].get('projectId'), 'project-1');

  credential.set('actionLinks', {});
  assert.false(editEnabled(), 'revocation hides Edit when the modal is reopened');
  await open();
  assert.strictEqual(opened.length, 1);

  credentials.removeObject(credential);
  assert.true(editEnabled(), 'a missing credential uses the current schema POST capability');
  await open();
  assert.strictEqual(opened.length, 2);
  assert.strictEqual(opened[1].get('credential'), undefined);

  canCreate = false;
  projects.incrementProperty('schemaLoadGeneration');
  assert.false(editEnabled(), 'revoked POST hides the missing-credential editor');
  await open();
  assert.strictEqual(opened.length, 2);

  canCreate = true;
  projects.incrementProperty('schemaLoadGeneration');
  const pending = defer();
  nextFind = pending.promise;
  let opening = open();
  canCreate = false;
  projects.incrementProperty('schemaLoadGeneration');
  pending.resolve(A([registry]));
  await opening;
  assert.strictEqual(opened.length, 2, 'permission revoked while loading never opens the modal');

  credential.set('actionLinks', {update: '/credential-1'});
  credentials.pushObject(credential);
  const projectSwitch = defer();
  nextFind = projectSwitch.promise;
  opening = open();
  projects.set('current.id', 'project-2');
  projectSwitch.resolve(A([registry]));
  await opening;
  assert.strictEqual(opened.length, 2, 'switching projects while loading never opens the old registry');
  assert.false(editEnabled(), 'a stale registry has no Edit action without a current project');

  destroyOwned(registry);
  destroyOwned(projects);
});
