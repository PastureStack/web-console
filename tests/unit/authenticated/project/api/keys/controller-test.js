import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import KeysController from 'ui/authenticated/project/api/keys/controller';
import C from 'ui/utils/constants';
import { createOwned, destroyOwned } from '../../../../../helpers/owned-subject';

module('Unit | Controller | authenticated/project/api/keys');

test('account and environment key actions use their separate effective schemas', function(assert) {
  let project = EmberObject.create({id: '1a-owner'});
  let projectCanCreate = false;
  let accountCanCreate = true;
  let created = [];
  let modals = [];
  let projects = EmberObject.create({
    current: project,
    schemaProjectId: '1a-owner',
    canCreateResource(type) {
      assert.strictEqual(type, 'apikey');
      return this.get('schemaProjectId') === this.get('current.id') && projectCanCreate;
    },
  });
  let userStore = {
    canCreate(type) {
      assert.strictEqual(type, 'apikey');
      return accountCanCreate;
    },
    createRecord(data) {
      created.push({scope: 'account', data});
      return data;
    },
  };
  let store = {
    createRecord(data) {
      created.push({scope: 'environment', data});
      return data;
    },
  };
  let controller = createOwned(KeysController, {
    projects,
    userStore,
    store,
    model: EmberObject.create({account: null}),
    session: EmberObject.create({[C.SESSION.ACCOUNT_ID]: '1a-user'}),
    modalService: {toggleModal(name, record) { modals.push({name, record}); }},
  }, 'controller');

  assert.true(controller.get('canCreateAccountKey'), 'account API key remains available');
  assert.false(controller.get('canCreateEnvironmentKey'), 'readonly project key is hidden');
  controller.send('newApikey', 'environment');
  assert.strictEqual(created.length, 0, 'forged action cannot create a project key record');
  controller.send('newApikey', 'account');
  assert.deepEqual(created[0], {scope: 'account', data: {type: 'apikey', accountId: '1a-user'}});
  assert.strictEqual(modals.length, 1, 'account key editor opens once');

  projectCanCreate = true;
  projects.set('schemaProjectId', null);
  assert.false(controller.get('canCreateEnvironmentKey'), 'loading schema grants no create action');
  projects.set('schemaProjectId', '1a-owner');
  assert.true(controller.get('canCreateEnvironmentKey'), 'project POST enables environment key');
  controller.send('newApikey', 'environment');
  assert.deepEqual(created[1], {scope: 'environment', data: {type: 'apikey', accountId: '1a-owner'}});

  project.set('id', '1a-other');
  assert.false(controller.get('canCreateEnvironmentKey'), 'old project capability is not reused');
  controller.send('newApikey', 'environment');
  assert.strictEqual(created.length, 2, 'project switch blocks stale action');

  accountCanCreate = false;
  controller.set('model.account', EmberObject.create({id: 'reloaded'}));
  assert.false(controller.get('canCreateAccountKey'), 'account schema revocation hides account action');
  controller.send('newApikey', 'account');
  assert.strictEqual(created.length, 2, 'forged account action is blocked too');
  destroyOwned(controller);
});
