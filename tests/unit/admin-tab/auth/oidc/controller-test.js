import Ember from 'ember';
import { module, test } from 'qunit';
import OidcController from 'ui/admin-tab/auth/oidc/controller';

module('Unit | Controller | admin tab | auth | oidc');

test('requires confirmation for the exact identity and permission reassignment', function(assert) {
  let source = Ember.Object.create({id: '1a1', name: 'Old account', kind: 'admin', state: 'active'});
  let target = Ember.Object.create({id: '1a2', name: 'New account', kind: 'user', state: 'active'});
  let controller = OidcController.create({
    accounts: [source, target],
    identityMatchAccountId: '1a1',
    identityStrategy: 'reassign',
    oidcEnabled: true,
    oldAccountDisposition: 'disable',
    selectedTargetAccountId: '1a2',
    testedIdentityProof: 'signed-proof',
    transferPermissions: true,
  });

  assert.ok(controller.get('targetAccountReady'), 'the selected active target is valid');
  assert.notOk(controller.get('mappingReady'), 'a reassignment cannot run before explicit confirmation');

  controller.send('confirmIdentityDecision');
  assert.ok(controller.get('identityChangeConfirmed'), 'the exact displayed decision is confirmed');
  assert.ok(controller.get('mappingReady'), 'the confirmed reassignment can run');

  controller.set('oldAccountDisposition', 'discardPermissions');
  assert.notOk(controller.get('identityChangeConfirmed'), 'changing a destructive choice invalidates confirmation');
  assert.notOk(controller.get('mappingReady'), 'the changed decision must be confirmed again');
  Ember.run(() => controller.destroy());
});

test('restores a disabled matched account before retaining its identity link', function(assert) {
  assert.expect(8);

  let disabled = Ember.Object.create({id: '1a9', name: 'Disabled account', kind: 'admin', state: 'inactive'});
  let restored = Ember.Object.create({id: '1a9', name: 'Disabled account', kind: 'admin', state: 'active'});
  let controller = OidcController.create({
    accounts: [disabled],
    identityMatchAccountId: '1a9',
    selectedTargetAccountId: '1a1',
    testedIdentityProof: 'signed-proof',
    userStore: Ember.Object.create({
      createRecord(fields) {
        assert.strictEqual(fields.operation, 'restore', 'the explicit restore operation is used');
        assert.strictEqual(fields.targetAccountId, '1a9', 'only the matched account is restored');
        return {
          save() {
            return Ember.RSVP.resolve({status: 'restored'});
          },
        };
      },
      find(type, id, options) {
        assert.strictEqual(type, 'account', 'accounts are reloaded after restoration');
        assert.strictEqual(id, null, 'the account collection is requested');
        assert.ok(options.forceReload, 'the restored state is not served from cache');
        return Ember.RSVP.resolve([restored]);
      },
    }),
  });

  assert.ok(controller.get('canRestoreMatchedAccount'), 'the disabled match exposes the restore action');
  return controller.restoreMatchedIdentityAccount().then(() => {
    assert.strictEqual(controller.get('identityStrategy'), 'useExisting', 'the restored account link is retained');
    assert.strictEqual(controller.get('selectedTargetAccountId'), '1a9', 'the restored account becomes the target');
    Ember.run(() => controller.destroy());
  });
});

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

test('keeps security enabled and restores the local session after provider activation fails', function(assert) {
  assert.expect(10);

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
      login(code, provider, options) {
        events.push(`login:${provider}`);
        if ( provider === 'oidcconfig' ) {
          assert.strictEqual(code, 'one-time-code', 'the fresh authorization code is exchanged');
          assert.strictEqual(options.providerSwitchCode, 'switch-ticket',
            'the account-bound activation ticket accompanies the fresh provider login');
          return Ember.RSVP.reject(new Error('controlled token failure'));
        }
        assert.strictEqual(provider, 'providerSwitch', 'rollback uses the one-use recovery provider');
        assert.strictEqual(code, 'switch-ticket', 'rollback uses the same short-lived switch ticket');
        return Ember.RSVP.resolve();
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
    prepareIdentitySwitch() {
      events.push('prepare-switch');
      return Ember.RSVP.resolve('switch-ticket');
    },
    cancelIdentitySwitch() {
      events.push('cancel-switch');
      return Ember.RSVP.resolve();
    },
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
    assert.deepEqual(saveStates, [true], 'OIDC is enabled without opening an unauthenticated interval');
    assert.ok(events.indexOf('suspend') > events.indexOf('save:true'),
      'the old session is suspended only after the protected provider configuration is saved');
    assert.ok(events.indexOf('restore-provider') > events.indexOf('login:oidcconfig'),
      'the provider is restored after the failed exchange');
    assert.ok(events.indexOf('restore-session') > events.indexOf('restore-provider'), 'the local session returns after provider restoration');
    Ember.run(() => controller.destroy());
  });
});

test('activates OIDC with an identity-bound ticket and never disables security', function(assert) {
  assert.expect(8);

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
      login(code, provider, options) {
        assert.strictEqual(provider, 'oidcconfig', 'the fresh login targets the new provider');
        assert.strictEqual(options.providerSwitchCode, 'switch-ticket',
          'the identity-bound switch ticket is submitted with the authorization response');
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
    prepareIdentitySwitch() {
      events.push('prepare-switch');
      return Ember.RSVP.resolve('switch-ticket');
    },
    cancelIdentitySwitch(code) {
      assert.strictEqual(code, 'switch-ticket', 'the used activation ticket is cancelled if still active');
      events.push('cancel-switch');
      return Ember.RSVP.resolve();
    },
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
    assert.deepEqual(events.slice(0, 5),
      ['prepare-switch', 'save:true', 'suspend', 'login', 'cancel-switch'],
      'the protected switch ceremony completes in order');
    assert.ok(events.indexOf('set-oidc-provider') > events.indexOf('cancel-switch'),
      'the UI provider changes after the fresh provider session exists');
    assert.ok(events.indexOf('refresh') > events.indexOf('set-oidc-provider'), 'the page refreshes after activation completes');
    assert.strictEqual(candidate.get('enabled'), true, 'the final saved model is enabled');
    Ember.run(() => controller.destroy());
  });
});
