import EmberObject, { computed } from '@ember/object';
import { resolve, reject } from 'rsvp';
import { module, test } from 'qunit';
import AccountKeysRoute from 'ui/authenticated/account-keys/route';
import KeysRoute from 'ui/authenticated/project/api/keys/route';
import C from 'ui/utils/constants';
import { createOwned, destroyOwned } from '../../../helpers/owned-subject';

module('Unit | Route | Account Keys');

function userStore(calls, restricted, result) {
  return EmberObject.create({
    getById(type, id) {
      if (type !== 'schema' || id !== 'apikeyrestricted') { throw new Error('UnexpectedKeySchema'); }
      return restricted ? EmberObject.create({id}) : null;
    },
    findAll(type, id, options) {
      calls.push({type, id, options});
      return result ? result(type) : resolve([type]);
    },
  });
}

test('Account Keys loads both own collections without an environment store', async function(assert) {
  let calls = [];
  let route = createOwned(AccountKeysRoute, {
    session: EmberObject.create({[C.SESSION.ACCOUNT_ID]: 'own-account'}),
    userStore: userStore(calls, true),
    store: computed(function() { throw new Error('EnvironmentStoreMustNotBeAccessed'); }),
  }, 'route');
  try {
    let model = await route.model();
    assert.true(route.get('accountOnly'));
    assert.strictEqual(route.get('templateName'), 'authenticated/project/api/keys', 'uses the existing template');
    assert.deepEqual(model, {account: ['apikey'], accountRestricted: ['apikeyrestricted']});
    assert.deepEqual(calls, [
      {type: 'apikey', id: null, options: {filter: {accountId: 'own-account'}, url: 'apikeys', forceReload: true}},
      {type: 'apikeyrestricted', id: null, options: {filter: {accountId: 'own-account'}, forceReload: true}},
    ], 'only the two owner-filtered userStore requests are issued');
  } finally {
    destroyOwned(route);
  }
});

test('Account Keys keeps the legacy restricted-schema fallback without extra requests', async function(assert) {
  let calls = [];
  let route = createOwned(AccountKeysRoute, {
    session: EmberObject.create({[C.SESSION.ACCOUNT_ID]: 'own-account'}),
    userStore: userStore(calls, false),
    store: computed(function() { throw new Error('EnvironmentStoreMustNotBeAccessed'); }),
  }, 'route');
  try {
    assert.deepEqual(await route.model(), {account: ['apikey'], accountRestricted: []});
    assert.strictEqual(calls.length, 1, 'absent restricted schema does not cause a speculative request');
  } finally {
    destroyOwned(route);
  }
});

test('Account Keys leaves 403 and other load errors for the existing route error handling', async function(assert) {
  for (let status of [403, 500]) {
    let error = {status, body: {code: 'KeyListUnavailable'}};
    let route = createOwned(AccountKeysRoute, {
      session: EmberObject.create({[C.SESSION.ACCOUNT_ID]: 'own-account'}),
      userStore: userStore([], false, () => reject(error)),
      store: computed(function() { throw new Error('EnvironmentStoreMustNotBeAccessed'); }),
    }, 'route');
    try {
      await route.model();
      assert.ok(false, 'a denied or failed list must not become an empty successful model');
    } catch (actual) {
      assert.strictEqual(actual, error, `HTTP ${status} is propagated unchanged`);
    } finally {
      destroyOwned(route);
    }
  }
});

test('Account Keys variant leaves the existing environment route requests intact', async function(assert) {
  let calls = [], environmentCalls = [];
  let route = createOwned(KeysRoute, {
    session: EmberObject.create({[C.SESSION.ACCOUNT_ID]: 'own-account'}),
    userStore: userStore(calls, true),
    store: EmberObject.create({findAll(...args) {
      environmentCalls.push(args);
      return resolve(['environment-key']);
    }}),
  }, 'route');
  try {
    assert.false(route.get('accountOnly'));
    assert.deepEqual(await route.model(), {
      account: ['apikey'], accountRestricted: ['apikeyrestricted'], environment: ['environment-key'],
    });
    assert.deepEqual(environmentCalls, [['apikey', null, {forceReload: true}]]);
    assert.strictEqual(calls.length, 2);
  } finally {
    destroyOwned(route);
  }
});
