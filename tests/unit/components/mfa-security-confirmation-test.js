import Ember from 'ember';
import { module, test } from 'qunit';
import MfaSecurityConfirmation from 'ui/components/mfa-security-confirmation/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | mfa security confirmation');

test('does not start a passkey confirmation on an insecure connection', function(assert) {
  let challenge = {
    challengeId: 'challenge-1',
    methods: ['webauthn', 'totp', 'recoveryCode'],
  };
  let InsecureMfaSecurityConfirmation = MfaSecurityConfirmation.extend({
    webAuthnEnvironmentSupported: false,
  });
  let component = createOwned(InsecureMfaSecurityConfirmation, {
    renderer: inertRenderer(),
    intl: Ember.Object.create(),
    modalService: Ember.Object.create({modalOpts: {}}),
    userStore: Ember.Object.create({
      rawRequest() {
        return Ember.RSVP.resolve({body: challenge});
      },
    }),
  }, 'component');

  return component.begin().then(() => {
    assert.deepEqual(component.get('availableMethods'), ['totp', 'recoveryCode'],
      'only methods supported by the current connection are offered');
    assert.strictEqual(component.get('method'), 'totp',
      'the first usable registered factor is selected');
    assert.ok(component.get('hasUnavailablePasskeyMethod'),
      'the modal explains why the registered passkey is not shown');
  }).finally(() => destroyOwned(component));
});
