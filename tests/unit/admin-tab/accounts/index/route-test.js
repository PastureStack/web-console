import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import AccountsRoute from 'ui/admin-tab/accounts/index/route';

module('Unit | Route | admin tab accounts index');

const intl = EmberObject.create({t(key) { return key; }});

test('loads authoritative login identities for each account with an exact account filter', function(assert) {
  assert.expect(7);
  let accounts = A([
    EmberObject.create({id: '1a1', kind: 'admin'}),
    EmberObject.create({id: '1a2', kind: 'user'}),
  ]);
  let links = {
    '1a1': A([EmberObject.create({externalIdType: 'rancher_id', externalId: '1'})]),
    '1a2': A([EmberObject.create({externalIdType: 'oidc_user', externalId: 'subject-2'})]),
  };
  let queried = [];
  let userStore = EmberObject.create({
    find(type, id, options) {
      if ( type === 'password' ) {
        return resolve(A([]));
      }
      if ( type === 'account' ) {
        assert.deepEqual(options.filter, {kind_ne: ['service','agent']}, 'service and agent accounts remain excluded');
        assert.strictEqual(options.forceReload, true, 'the account inventory is current');
        return resolve(accounts);
      }
      if ( type === 'authIdentityLink' ) {
        let accountId = options.filter.accountId;
        queried.push(accountId);
        assert.strictEqual(options.forceReload, true, `${accountId} identity links are current`);
        return resolve(links[accountId]);
      }
      throw new Error(`unexpected lookup ${type}:${id}`);
    },
  });
  let route = AccountsRoute.create({userStore, intl});

  return route.model().then((result) => {
    assert.strictEqual(result, accounts, 'the original account collection is retained');
    assert.deepEqual(queried.sort(), ['1a1', '1a2'], 'each query is bound to one exact account');
    assert.strictEqual(accounts[1].get('_authIdentityLinks'), links['1a2'], 'OIDC links are attached without changing account data');
    run(() => route.destroy());
  });
});

test('isolates a missing inactive account identity without hiding other failures', function(assert) {
  assert.expect(5);
  let accounts = A([
    EmberObject.create({id: '1a1', kind: 'admin', state: 'active'}),
    EmberObject.create({id: '1a5', kind: 'user', state: 'inactive', externalIdType: 'oidc_user', externalId: 'retired-subject'}),
  ]);
  let activeLinks = A([EmberObject.create({externalIdType: 'rancher_id', externalId: '1'})]);
  let userStore = EmberObject.create({
    find(type, id, options) {
      if ( type === 'password' ) {
        return resolve(A([]));
      }
      if ( type === 'account' ) {
        return resolve(accounts);
      }
      if ( type === 'authIdentityLink' && options.filter.accountId === '1a1' ) {
        return resolve(activeLinks);
      }
      if ( type === 'authIdentityLink' && options.filter.accountId === '1a5' ) {
        return reject({status: 404, code: 'AccountNotFound'});
      }
      return reject({status: 503, code: 'UnexpectedLookup'});
    },
  });
  let route = AccountsRoute.create({userStore, intl});

  return route.model().then((result) => {
    assert.strictEqual(result, accounts, 'the account inventory remains visible');
    assert.strictEqual(accounts[0].get('_authIdentityLinks'), activeLinks, 'active identity links remain authoritative');
    assert.deepEqual(accounts[1].get('_authIdentityLinks'), [], 'only the missing row falls back to embedded identity fields');
    assert.strictEqual(accounts[1].get('externalIdType'), 'oidc_user', 'the row fallback identity is preserved');
    assert.strictEqual(accounts[1].get('externalId'), 'retired-subject', 'the row fallback subject is preserved');
    run(() => route.destroy());
  });
});

test('propagates non-404 identity lookup failures', function(assert) {
  assert.expect(1);
  let accounts = A([EmberObject.create({id: '1a1', kind: 'admin'})]);
  let userStore = EmberObject.create({
    find(type) {
      if ( type === 'password' ) {
        return resolve(A([]));
      }
      if ( type === 'account' ) {
        return resolve(accounts);
      }
      return reject({status: 503, code: 'ServiceUnavailable'});
    },
  });
  let route = AccountsRoute.create({userStore, intl});

  return route.model().then(() => {
    assert.ok(false, 'the route must reject');
  }, (error) => {
    assert.strictEqual(error.status, 503, 'non-404 failures remain diagnosable');
    run(() => route.destroy());
  });
});

test('masked authorization 404 is never treated as a stale account row', async function(assert) {
  for (let [state, code] of [
    ['active', 'AccountNotFound'],
    ['inactive', 'PermissionDenied'],
  ]) {
    let account = EmberObject.create({id: '1a1', state});
    let userStore = EmberObject.create({
      find(type) {
        if ( type === 'account' ) {
          return resolve(A([account]));
        }
        if ( type === 'authIdentityLink' ) {
          return reject({status: 404, code, message: 'Raw API response'});
        }
        return resolve(A([]));
      },
    });
    let route = AccountsRoute.create({userStore, intl});

    await route.model().then(
      () => assert.ok(false, `${state} ${code} must remain a visible error`),
      (error) => {
        assert.strictEqual(error.status, 404);
        assert.strictEqual(error.message, 'resourceLoadError.accountsUnavailable');
        assert.notOk(account.get('_authIdentityLinks'), 'the denied identity was not replaced by an empty row');
      }
    );
    run(() => route.destroy());
  }
});
