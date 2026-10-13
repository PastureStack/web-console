import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import AccountKeysController from 'ui/authenticated/account-keys/controller';
import KeysController from 'ui/authenticated/project/api/keys/controller';
import C from 'ui/utils/constants';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Controller | Account Keys');

test('Account Keys merges both own lists and only permits the normal account editor', function(assert) {
  let created = [], modals = [], canCreate = true;
  let session = EmberObject.create({[C.SESSION.ACCOUNT_ID]: 'own-account'});
  let controller = createOwned(AccountKeysController, {
    session,
    access: EmberObject.create({identity: EmberObject.create({id: 'own-account'})}),
    userStore: {
      canCreate(type) { assert.strictEqual(type, 'apikey'); return canCreate; },
      getById() { return EmberObject.create({resourceFields: {apiKeyPolicy: {}}}); },
      createRecord(record) { created.push(record); return record; },
    },
    projects: {canCreateResource() { throw new Error('EnvironmentCapabilityMustNotBeUsed'); }},
    store: {createRecord() { throw new Error('EnvironmentStoreMustNotBeUsed'); }},
    modalService: {toggleModal(name, record) { modals.push({name, record}); }},
    model: EmberObject.create({account: [
      EmberObject.create({id: 'full', accountId: 'own-account', name: 'z'}),
      EmberObject.create({id: 'foreign', accountId: 'other-account', name: 'b'}),
    ], accountRestricted: [
      EmberObject.create({id: 'restricted', accountId: 'own-account', name: 'a'}),
      EmberObject.create({id: 'full', accountId: 'own-account', name: 'duplicate'}),
    ]}),
    sortBy: 'name', descending: false,
  }, 'controller');
  try {
    assert.true(controller.get('accountOnly'));
    assert.strictEqual(controller.get('project'), null, 'the page has no project binding');
    assert.deepEqual(controller.get('accountArranged').map((row) => row.get('id')), ['restricted', 'full']);
    assert.deepEqual(controller.get('environmentArranged'), [], 'no environment collection is required');
    assert.false(controller.get('canCreateEnvironmentKey'));
    controller.send('newApikey', 'environment');
    assert.deepEqual(created, [], 'a forged environment action is blocked even with policy support');
    controller.send('newApikey', 'account');
    assert.deepEqual(created, [{type: 'apikey', accountId: 'own-account'}]);
    assert.deepEqual(modals, [{name: 'edit-apikey', record: created[0]}]);
    canCreate = false;
    controller.set('model.account', []);
    controller.send('newApikey', 'account');
    assert.strictEqual(created.length, 1, 'revoked account capability still blocks the editor');
    session.set(C.SESSION.ACCOUNT_ID, null);
    assert.deepEqual(controller.get('accountArranged'), [], 'loss of the owner clears visible cached keys');
  } finally {
    destroyOwned(controller);
  }
});

test('Account Keys keeps targetKey across project changes but clears it on viewer change', function(assert) {
  let identity = EmberObject.create({id: 'own-account'});
  let controller = createOwned(AccountKeysController, {
    access: EmberObject.create({identity}),
    targetKey: 'selected-key',
  }, 'controller');
  try {
    assert.deepEqual(controller.get('queryParams'), ['targetKey']);
    controller.set('project', EmberObject.create({id: 'unrelated-project'}));
    assert.strictEqual(controller.get('targetKey'), 'selected-key', 'environment changes do not erase the account query');
    identity.set('id', 'other-account');
    assert.strictEqual(controller.get('targetKey'), null, 'the previous viewer audit is cleared');
    controller.set('targetKey', 'new-selection');
    controller.send('closeAudit');
    assert.strictEqual(controller.get('targetKey'), null);
  } finally {
    destroyOwned(controller);
  }
});

test('Account Keys variant preserves environment-mode audit clearing', function(assert) {
  let project = EmberObject.create({id: 'old-project'});
  let controller = createOwned(KeysController, {
    projects: EmberObject.create({current: project}),
    access: EmberObject.create({identity: EmberObject.create({id: 'own-account'})}),
    targetKey: 'selected-key',
  }, 'controller');
  try {
    project.set('id', 'new-project');
    assert.strictEqual(controller.get('targetKey'), null);
  } finally {
    destroyOwned(controller);
  }
});
