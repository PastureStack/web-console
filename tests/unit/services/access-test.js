import Ember from 'ember';
import { module, test } from 'qunit';
import C from 'ui/utils/constants';
import AccessService from 'ui/services/access';

module('Unit | Service | access');

test('uses an explicit provider only for the activation token exchange', function(assert) {
  assert.expect(4);

  let cookie;
  let sessionValues;
  let request;
  let service = AccessService.create({
    cookies: Ember.Object.create({
      setWithOptions(name, value) {
        cookie = {name, value};
      },
    }),
    provider: 'localauthconfig',
    session: Ember.Object.create({
      setProperties(values) {
        sessionValues = values;
      },
    }),
    userStore: Ember.Object.create({
      rawRequest(options) {
        request = options;
        return Ember.RSVP.resolve({
          body: {
            jwt: 'platform-session-token',
            user: 'test-user',
          },
        });
      },
    }),
  });

  return service.login('opaque-authorization-response', 'oidcconfig').then(() => {
    assert.strictEqual(request.data.authProvider, 'oidcconfig', 'the requested provider is sent to the token endpoint');
    assert.strictEqual(service.get('provider'), 'localauthconfig', 'the active provider is unchanged until activation succeeds');
    assert.strictEqual(cookie.value, 'platform-session-token', 'the normal platform session is accepted');
    assert.ok(sessionValues, 'the normal session contract is updated');
    Ember.run(() => service.destroy());
  });
});

test('suspends and restores the current provider session around activation', function(assert) {
  assert.expect(8);

  let cookieValue = 'existing-local-session';
  let removedCookie;
  let sessionValues = {
    [C.SESSION.ACCOUNT_ID]: '1a1',
    [C.SESSION.USER_ID]: '1u1',
  };
  let service = AccessService.create({
    cookies: Ember.Object.create({
      get() {
        return cookieValue;
      },
      remove(name) {
        removedCookie = name;
        cookieValue = undefined;
      },
      setWithOptions(name, value, options) {
        assert.strictEqual(name, C.COOKIE.TOKEN, 'the platform token cookie is restored');
        assert.strictEqual(options.path, '/', 'the restored cookie keeps the platform path');
        cookieValue = value;
      },
    }),
    session: Ember.Object.create({
      get(key) {
        return sessionValues[key];
      },
      setProperties(values) {
        Object.assign(sessionValues, values);
      },
    }),
  });

  let snapshot = service.suspendSession();

  assert.strictEqual(snapshot.token, 'existing-local-session', 'the existing token is retained only in memory');
  assert.strictEqual(snapshot.values[C.SESSION.ACCOUNT_ID], '1a1', 'the account session is retained');
  assert.strictEqual(removedCookie, C.COOKIE.TOKEN, 'the old provider cookie is removed before login');
  assert.strictEqual(cookieValue, undefined, 'the suspended cookie is not sent to the token endpoint');

  service.restoreSession(snapshot);

  assert.strictEqual(cookieValue, 'existing-local-session', 'the previous provider token is restored');
  assert.strictEqual(sessionValues[C.SESSION.USER_ID], '1u1', 'the previous session values are restored');
  Ember.run(() => service.destroy());
});
