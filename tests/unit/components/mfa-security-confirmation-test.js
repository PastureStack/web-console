import { run } from '@ember/runloop';
import { resolve } from 'rsvp';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import MfaSecurityConfirmation from 'ui/components/mfa-security-confirmation/component';
import componentWithTestOwner from 'ui/tests/helpers/component-with-test-owner';

const InsecureMfaSecurityConfirmation = componentWithTestOwner(
  MfaSecurityConfirmation.extend({
    webAuthnEnvironmentSupported: false,
  })
);

module('Unit | Component | mfa security confirmation');

test('does not start a passkey confirmation on an insecure connection', function(assert) {
  let challenge = {
    challengeId: 'challenge-1',
    methods: ['webauthn', 'totp', 'recoveryCode'],
  };
  let component = InsecureMfaSecurityConfirmation.create({
    intl: EmberObject.create(),
    modalService: EmberObject.create({modalOpts: {}}),
    userStore: EmberObject.create({
      rawRequest() {
        return resolve({body: challenge});
      },
    }),
  });

  return component.begin().then(() => {
    assert.deepEqual(component.get('availableMethods'), ['totp', 'recoveryCode'],
      'only methods supported by the current connection are offered');
    assert.strictEqual(component.get('method'), 'totp',
      'the first usable registered factor is selected');
    assert.ok(component.get('hasUnavailablePasskeyMethod'),
      'the modal explains why the registered passkey is not shown');
  }).finally(() => run(() => component.destroy()));
});
