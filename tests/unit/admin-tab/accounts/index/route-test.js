import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import AccountsRoute from 'ui/admin-tab/accounts/index/route';

module('Unit | Route | admin tab accounts index');

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
  let route = AccountsRoute.create({userStore});

  return route.model().then((result) => {
    assert.strictEqual(result, accounts, 'the original account collection is retained');
    assert.deepEqual(queried.sort(), ['1a1', '1a2'], 'each query is bound to one exact account');
    assert.strictEqual(accounts[1].get('_authIdentityLinks'), links['1a2'], 'OIDC links are attached without changing account data');
    run(() => route.destroy());
  });
});
