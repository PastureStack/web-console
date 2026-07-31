import Ember from 'ember';
import { module, test } from 'qunit';
import MfaSecurityConfirmation from 'ui/components/mfa-security-confirmation/component';

module('Unit | Component | mfa security confirmation');

test('does not start a passkey confirmation on an insecure connection', function(assert) {
  let challenge = {
    challengeId: 'challenge-1',
    methods: ['webauthn', 'totp', 'recoveryCode'],
  };
  let component = MfaSecurityConfirmation.create({
    intl: Ember.Object.create(),
    modalService: Ember.Object.create({modalOpts: {}}),
    userStore: Ember.Object.create({
      rawRequest() {
        return Ember.RSVP.resolve({body: challenge});
      },
    }),
    webAuthnEnvironmentSupported: false,
  });

  return component.begin().then(() => {
    assert.deepEqual(component.get('availableMethods'), ['totp', 'recoveryCode'],
      'only methods supported by the current connection are offered');
    assert.strictEqual(component.get('method'), 'totp',
      'the first usable registered factor is selected');
    assert.ok(component.get('hasUnavailablePasskeyMethod'),
      'the modal explains why the registered passkey is not shown');
  }).finally(() => Ember.run(() => component.destroy()));
});
