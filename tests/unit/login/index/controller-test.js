import Ember from 'ember';
import { module, test } from 'qunit';
import LoginController from 'ui/login/index/controller';

module('Unit | Controller | login | index');

test('keeps account recovery separate from regular MFA methods', function(assert) {
  let access = Ember.Object.create({
    mfaChallenge: {
      mfaRequired: true,
      mfaMethods: ['totp', 'webauthn', 'recoveryCode', 'emailRecovery'],
    },
  });
  let controller = LoginController.create({
    access: access,
    settings: Ember.Object.create(),
    intl: Ember.Object.create(),
    webAuthnEnvironmentSupported: true,
  });

  assert.deepEqual(
    controller.get('primaryMfaMethods'),
    ['totp', 'webauthn'],
    'regular verification presents only registered authentication factors'
  );
  assert.deepEqual(
    controller.get('recoveryMfaMethods'),
    ['recoveryCode', 'emailRecovery'],
    'recovery methods stay behind the explicit account-recovery path'
  );
  assert.strictEqual(controller.get('activeMfaMethod'), 'totp', 'regular verification is selected first');

  Ember.run(() => controller.send('showMfaRecoveryOptions'));
  assert.ok(controller.get('showMfaRecoveryOptions'), 'the user can explicitly open account recovery');
  assert.strictEqual(
    controller.get('activeMfaMethod'),
    'recoveryCode',
    'the less destructive recovery-code option is selected before email recovery'
  );

  Ember.run(() => controller.send('showMfaPrimaryOptions'));
  assert.notOk(controller.get('showMfaRecoveryOptions'), 'the user can return to regular verification');
  assert.strictEqual(controller.get('activeMfaMethod'), 'totp', 'regular verification is restored');

  Ember.run(() => controller.destroy());
});

test('does not offer a passkey ceremony on an insecure connection', function(assert) {
  let challenge = {
    mfaRequired: true,
    mfaMethods: ['webauthn', 'recoveryCode'],
  };
  let controller = LoginController.create({
    access: Ember.Object.create({mfaChallenge: challenge}),
    settings: Ember.Object.create(),
    intl: Ember.Object.create(),
    webAuthnEnvironmentSupported: false,
  });

  Ember.run(() => controller.handleLoginResponse(challenge, true));

  assert.deepEqual(controller.get('primaryMfaMethods'), [],
    'the browser is not asked to start an unsupported WebAuthn ceremony');
  assert.ok(controller.get('hasUnavailablePasskeyMethod'),
    'the page can explain why the enrolled passkey is unavailable');
  assert.ok(controller.get('showMfaRecoveryOptions'),
    'the viable recovery path opens when it is the only available method');
  assert.strictEqual(controller.get('activeMfaMethod'), 'recoveryCode',
    'the one-use recovery code is preferred over a dead-end passkey button');

  Ember.run(() => controller.set('newRecoveryCodes', ['first-code', 'second-code']));
  assert.strictEqual(controller.get('recoveryCodesText'), 'first-code\nsecond-code',
    'one-time recovery codes are passed to the standard clipboard component');

  Ember.run(() => controller.destroy());
});
