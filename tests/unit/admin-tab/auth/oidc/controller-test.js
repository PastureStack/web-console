import Ember from 'ember';
import { module, test } from 'qunit';
import OidcController from 'ui/admin-tab/auth/oidc/controller';

module('Unit | Controller | admin tab | auth | oidc');

test('restores the existing local provider without replacing its password', function(assert) {
  assert.expect(5);

  let fallbackSaved = false;
  let restored;
  let localRecoveryModel = Ember.Object.create({
    clone() {
      return Ember.Object.create({
        enabled: false,
        username: 'not-returned-by-api',
        password: 'not-returned-by-api',
        save() {
          restored = this.getProperties('enabled', 'username', 'password');
          return Ember.RSVP.resolve(this);
        },
      });
    },
  });
  let fallbackModel = Ember.Object.create({
    save() {
      fallbackSaved = true;
      return Ember.RSVP.resolve(this);
    },
  });
  let controller = OidcController.create({
    recoveryEnabled: true,
    recoveryLocalModel: localRecoveryModel,
    recoveryProvider: 'localauthconfig',
  });

  return controller.restorePreviousProvider(fallbackModel).then(() => {
    assert.notOk(fallbackSaved, 'the external-provider fallback is not used for local authentication');
    assert.ok(restored, 'the local authentication configuration is saved');
    assert.strictEqual(restored.enabled, true, 'local authentication is re-enabled');
    assert.strictEqual(restored.username, '', 'the existing username credential is not replaced');
    assert.strictEqual(restored.password, '', 'the existing password credential is not replaced');
    Ember.run(() => controller.destroy());
  });
});
