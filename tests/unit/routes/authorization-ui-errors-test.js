import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { reject, resolve } from 'rsvp';
import { module, test } from 'qunit';
import StackRoute from 'ui/stack/route';
import AccountsRoute from 'ui/admin-tab/accounts/index/route';
import AccountSecurityRoute from 'ui/account-security/route';

module('Unit | Route | authorization UI errors');

const intl = EmberObject.create({t(key) { return key; }});

function routeFor(kind, failure) {
  if ( kind === 'stack' ) {
    return StackRoute.create({
      intl,
      modelFor() { return A([]); },
      store: EmberObject.create({find() { return reject(failure); }}),
    });
  }
  if ( kind === 'accounts' ) {
    return AccountsRoute.create({
      intl,
      userStore: EmberObject.create({find() { return reject(failure); }}),
    });
  }
  return AccountSecurityRoute.create({
    intl,
    session: EmberObject.create({accountId: '1a1'}),
    userStore: EmberObject.create({
      find(type) {
        return type === 'mfaFactor' ? reject(failure) : resolve(A([]));
      },
    }),
  });
}

test('stack, account list, and account security loads show localized denials and server failures', async function(assert) {
  for (let [kind, unavailableKey, failedKey] of [
    ['stack', 'resourceLoadError.stackUnavailable', 'resourceLoadError.stackFailed'],
    ['accounts', 'resourceLoadError.accountsUnavailable', 'resourceLoadError.accountsFailed'],
    ['security', 'resourceLoadError.accountSecurityUnavailable', 'resourceLoadError.accountSecurityFailed'],
  ]) {
    for (let status of [403, 404, 500, 503, 401]) {
      let failure = {status, message: 'Raw English API error'};
      let route = routeFor(kind, failure);
      let model = kind === 'stack' ? route.model({stack_id: '1st1'}) : route.model();

      await model.then(
        () => assert.ok(false, `${kind} ${status} must reject`),
        (error) => {
          if ( status === 401 ) {
            assert.strictEqual(error, failure, '401 remains available for global session recovery');
          } else {
            assert.strictEqual(error.status, status === 403 ? 404 : status,
              'denied and missing resources have the same visible status');
            assert.strictEqual(error.message, status >= 500 ? failedKey : unavailableKey,
              'the error view receives the translated message');
            assert.notOk(error.detail, 'raw API details are not shown');
          }
        }
      );
      run(() => route.destroy());
    }
  }
});
