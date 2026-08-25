import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import EmberObject from '@ember/object';
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
    cookies: EmberObject.create({
      setWithOptions(name, value) {
        cookie = {name, value};
      },
    }),
    provider: 'localauthconfig',
    session: EmberObject.create({
      setProperties(values) {
        sessionValues = values;
      },
    }),
    userStore: EmberObject.create({
      rawRequest(options) {
        request = options;
        return resolve({
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
    run(() => service.destroy());
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
    cookies: EmberObject.create({
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
    session: EmberObject.create({
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
  run(() => service.destroy());
});

test('holds an MFA challenge without creating a browser session', function(assert) {
  assert.expect(4);

  let cookieWritten = false;
  let sessionWritten = false;
  let challenge = {
    mfaRequired: true,
    mfaChallengeId: 'opaque-challenge',
    mfaMethods: ['totp'],
  };
  let service = AccessService.create({
    cookies: EmberObject.create({
      setWithOptions() {
        cookieWritten = true;
      },
    }),
    provider: 'localauthconfig',
    session: EmberObject.create({
      setProperties() {
        sessionWritten = true;
      },
    }),
    userStore: EmberObject.create({
      rawRequest() {
        return resolve({body: challenge});
      },
    }),
  });

  return service.login('administrator:password').then((xhr) => {
    assert.strictEqual(xhr.body, challenge, 'the pending ceremony is returned to the login controller');
    assert.strictEqual(service.get('mfaChallenge'), challenge, 'the challenge remains only in memory');
    assert.notOk(cookieWritten, 'no session cookie exists before MFA succeeds');
    assert.notOk(sessionWritten, 'no authenticated session state exists before MFA succeeds');
    run(() => service.destroy());
  });
});

test('creates the browser session only after MFA succeeds', function(assert) {
  assert.expect(5);

  let request;
  let cookie;
  let sessionValues;
  let service = AccessService.create({
    cookies: EmberObject.create({
      setWithOptions(name, value) {
        cookie = {name, value};
      },
    }),
    mfaChallenge: {mfaRequired: true},
    session: EmberObject.create({
      setProperties(values) {
        sessionValues = values;
      },
    }),
    userStore: EmberObject.create({
      rawRequest(options) {
        request = options;
        return resolve({
          body: {jwt: 'mfa-complete-session', user: 'administrator'},
        });
      },
    }),
  });

  return service.completeMfa({
    code: 'opaque-challenge',
    mfaMethod: 'totp',
    mfaCode: '123456',
  }).then(() => {
    assert.strictEqual(request.data.authProvider, 'mfa', 'the MFA continuation provider is explicit');
    assert.strictEqual(request.data.code, 'opaque-challenge', 'the opaque challenge is returned');
    assert.strictEqual(service.get('mfaChallenge'), null, 'the completed challenge is removed from memory');
    assert.strictEqual(cookie.value, 'mfa-complete-session', 'the completed session token is stored');
    assert.ok(sessionValues, 'the normal session contract is populated after verification');
    run(() => service.destroy());
  });
});

test('preserves other factor options while an email recovery code is requested', function(assert) {
  assert.expect(5);

  let original = {
    mfaRequired: true,
    mfaChallengeId: 'opaque-challenge',
    mfaMethods: ['webauthn', 'emailRecovery'],
    webAuthnOptions: {challenge: 'browser-challenge'},
  };
  let service = AccessService.create({
    mfaChallenge: original,
    userStore: EmberObject.create({
      rawRequest(options) {
        assert.strictEqual(options.data.mfaMethod, 'emailRecovery', 'the email recovery method is requested');
        return resolve({
          body: {
            mfaRequired: true,
            mfaChallengeId: 'opaque-challenge',
            mfaMethods: ['webauthn', 'emailRecovery'],
            emailCodeSent: true,
            recoveryEmailMasked: 'ad***@example.test',
          },
        });
      },
    }),
  });

  return service.completeMfa({
    code: 'opaque-challenge',
    mfaMethod: 'emailRecovery',
  }).then(() => {
    let challenge = service.get('mfaChallenge');
    assert.notStrictEqual(challenge, original, 'the stored challenge is updated immutably');
    assert.strictEqual(challenge.webAuthnOptions.challenge, 'browser-challenge',
      'the passkey challenge remains available if the user changes methods');
    assert.ok(challenge.emailCodeSent, 'the email-code step becomes active');
    assert.strictEqual(challenge.recoveryEmailMasked, 'ad***@example.test',
      'the response adds the masked destination');
    run(() => service.destroy());
  });
});
