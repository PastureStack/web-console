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

test('persists the browser origin before preparing an OIDC provider', function(assert) {
  assert.expect(5);

  let savedValue;
  let setting = Ember.Object.create({
    value: '',
    save() {
      savedValue = this.get('value');
      return Ember.RSVP.resolve(this);
    },
  });
  let controller = OidcController.create({
    settings: Ember.Object.create({
      get(key) {
        assert.strictEqual(key, 'api$host', 'the canonical API host setting is checked');
        return '';
      },
    }),
    userStore: Ember.Object.create({
      find(type, id) {
        assert.strictEqual(type, 'setting', 'the persistent setting resource is used');
        assert.strictEqual(id, 'api.host', 'the normalized setting name is converted for the API');
        return Ember.RSVP.resolve(setting);
      },
    }),
    platformHostname() {
      return 'console.example.test';
    },
    platformOrigin() {
      return 'https://console.example.test';
    },
  });

  return controller.ensureApiHost().then((value) => {
    assert.strictEqual(savedValue, 'https://console.example.test', 'the browser origin is persisted');
    assert.strictEqual(value, savedValue, 'preparation waits for the saved API host');
    Ember.run(() => controller.destroy());
  });
});
