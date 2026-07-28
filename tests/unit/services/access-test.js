import Ember from 'ember';
import { module, test } from 'qunit';
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
