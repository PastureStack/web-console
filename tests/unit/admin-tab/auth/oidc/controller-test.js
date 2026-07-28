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

test('stages OIDC with security disabled and restores the local session after login failure', function(assert) {
  assert.expect(8);

  let events = [];
  let saveStates = [];
  let snapshot = {token: 'existing-local-session', values: {accountId: '1a1'}};
  let candidate = Ember.Object.create({
    enabled: null,
    save() {
      saveStates.push(this.get('enabled'));
      events.push(`save:${this.get('enabled')}`);
      return Ember.RSVP.resolve(this);
    },
  });
  let controller = OidcController.create({
    access: Ember.Object.create({
      suspendSession() {
        events.push('suspend');
        return snapshot;
      },
      login(code, provider) {
        assert.strictEqual(code, 'one-time-code', 'the fresh authorization code is exchanged');
        assert.strictEqual(provider, 'oidcconfig', 'the provider override is explicit');
        events.push('login');
        return Ember.RSVP.reject(new Error('controlled token failure'));
      },
      restoreSession(value) {
        assert.strictEqual(value, snapshot, 'the exact prior session snapshot is restored');
        events.push('restore-session');
      },
      setProperties(values) {
        assert.strictEqual(values.provider, 'localauthconfig', 'the active provider returns to local authentication');
        events.push('set-local-provider');
      },
    }),
    intl: Ember.Object.create({
      t() {
        return 'The failed activation was rolled back.';
      },
    }),
    recoveryModel: Ember.Object.create({
      clone() {
        return Ember.Object.create();
      },
    }),
    recoveryEnabled: true,
    recoveryProvider: 'localauthconfig',
    testedIdentity: {externalId: 'test-user'},
    buildCandidateConfig() {
      return candidate;
    },
    restorePreviousProvider() {
      events.push('restore-provider');
      return Ember.RSVP.resolve();
    },
  });
  let originalSend = controller.send;
  controller.send = function(action) {
    if ( action === 'gotError' ) {
      events.push('got-error');
      return;
    }
    return originalSend.apply(this, arguments);
  };

  return controller.activateWithCodeFlow('one-time-code').then(() => {
    assert.deepEqual(saveStates, [false], 'OIDC is first saved with global security disabled');
    assert.ok(events.indexOf('suspend') > events.indexOf('save:false'), 'the old session is suspended only after staging');
    assert.ok(events.indexOf('restore-provider') > events.indexOf('login'), 'the provider is restored after the failed exchange');
    assert.ok(events.indexOf('restore-session') > events.indexOf('restore-provider'), 'the local session returns after provider restoration');
    Ember.run(() => controller.destroy());
  });
});

test('enables OIDC only after the new platform session exists', function(assert) {
  assert.expect(5);

  let events = [];
  let candidate = Ember.Object.create({
    enabled: null,
    save() {
      events.push(`save:${this.get('enabled')}`);
      return Ember.RSVP.resolve(this);
    },
  });
  let controller = OidcController.create({
    access: Ember.Object.create({
      suspendSession() {
        events.push('suspend');
        return {token: 'local'};
      },
      login() {
        events.push('login');
        return Ember.RSVP.resolve();
      },
      setProperties(values) {
        assert.strictEqual(values.provider, 'oidcconfig', 'OIDC becomes the active provider');
        events.push('set-oidc-provider');
      },
    }),
    recoveryModel: Ember.Object.create({
      clone() {
        return Ember.Object.create();
      },
    }),
    testedIdentity: {externalId: 'test-user'},
    buildCandidateConfig() {
      return candidate;
    },
  });
  let originalSend = controller.send;
  controller.send = function(action) {
    if ( action === 'waitAndRefresh' ) {
      events.push('refresh');
      return;
    }
    return originalSend.apply(this, arguments);
  };

  return controller.activateWithCodeFlow('one-time-code').then(() => {
    assert.deepEqual(events.slice(0, 4), ['save:false', 'suspend', 'login', 'save:true'], 'security is enabled only after login succeeds');
    assert.ok(events.indexOf('set-oidc-provider') > events.indexOf('save:true'), 'the UI provider changes after the enabled config is saved');
    assert.ok(events.indexOf('refresh') > events.indexOf('set-oidc-provider'), 'the page refreshes after activation completes');
    assert.strictEqual(candidate.get('enabled'), true, 'the final saved model is enabled');
    Ember.run(() => controller.destroy());
  });
});
