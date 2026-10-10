import EmberObject from '@ember/object';
import { setOwner } from '@ember/application';
import Store from 'ember-api-store/services/store';
import Resource from 'ember-api-store/models/resource';
import { module, test } from 'qunit';
import KeysController from 'ui/authenticated/project/api/keys/controller';
import C from 'ui/utils/constants';
import { createOwned, destroyOwned } from '../../../../../helpers/owned-subject';

module('Unit | Controller | authenticated/project/api/keys');

test('personal list follows the real store cache when a newly read-back key is added', function(assert) {
  let userStore = Store.create({baseUrl: '/v2-beta'});
  let records = [];
  setOwner(userStore, {lookup() {
    let record = Resource.create();
    records.push(record);
    return record;
  }});
  let account = userStore.all('apikey'), accountRestricted = userStore.all('apikeyrestricted');
  let controller = createOwned(KeysController, {
    userStore,
    projects: EmberObject.create({current: EmberObject.create({id: '1a12'})}),
    access: EmberObject.create({identity: EmberObject.create({id: '1a1'})}),
    session: EmberObject.create({[C.SESSION.ACCOUNT_ID]: '1a1'}),
    model: EmberObject.create({account, accountRestricted, environment: []}),
    sortBy: 'name', descending: false,
  }, 'controller');
  assert.deepEqual(controller.get('accountArranged').map((record) => record.get('id')), [], 'empty list is first evaluated');
  userStore._typeify({type: 'apiKey', id: '1c120', accountId: '1a1', name: 'new personal key', apiKeyPolicyRevision: 1});
  assert.true(account.any((record) => record.get('id') === '1c120'), 'real cache contains the POST/readback metadata');
  assert.deepEqual(controller.get('accountArranged').map((record) => record.get('id')), ['1c120'], 'the visible list invalidates without a route reload');
  userStore._typeify({type: 'apiKeyRestricted', id: '1c121', accountId: '1a1', name: 'restricted personal key', apiKeyPolicyRevision: 1});
  assert.deepEqual(controller.get('accountArranged').map((record) => record.get('id')), ['1c120', '1c121'], 'restricted subtype also appears from its real live cache');
  userStore._typeify({type: 'apiKey', id: '1c122', accountId: '1a12', name: 'not personal'});
  assert.deepEqual(controller.get('accountArranged').map((record) => record.get('id')), ['1c120', '1c121'], 'project keys do not leak into the personal list');
  destroyOwned(controller);
  account.destroy(); accountRestricted.destroy(); userStore.destroy();
  records.forEach((record) => record.destroy());
});

test('personal list clears and re-filters when the live session owner changes', function(assert) {
  let session = EmberObject.create({[C.SESSION.ACCOUNT_ID]: '1a1'});
  let controller = createOwned(KeysController, {
    projects: EmberObject.create({current: EmberObject.create({id: '1a12'})}),
    access: EmberObject.create({identity: EmberObject.create({id: '1a1'})}),
    session,
    model: EmberObject.create({account: [
      EmberObject.create({id: '1c1', accountId: '1a1', name: 'z'}),
      EmberObject.create({id: '1c2', accountId: '1a2', name: 'b'}),
    ], accountRestricted: [
      EmberObject.create({id: '1c3', accountId: '1a1', name: 'a'}),
      EmberObject.create({id: '1c1', accountId: '1a1', name: 'duplicate'}),
    ]}),
    sortBy: 'name', descending: false,
  }, 'controller');
  assert.deepEqual(controller.get('accountArranged').map((row) => row.get('id')), ['1c3', '1c1'], 'full/restricted merge keeps sorting and stable-ID deduplication');
  session.set(C.SESSION.ACCOUNT_ID, '1a2');
  assert.deepEqual(controller.get('accountArranged').map((row) => row.get('id')), ['1c2'], 'old personal rows disappear on owner switch');
  session.set(C.SESSION.ACCOUNT_ID, null);
  assert.deepEqual(controller.get('accountArranged'), [], 'loss of session clears cached personal rows');
  destroyOwned(controller);
});

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
