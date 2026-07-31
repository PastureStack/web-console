import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { resolve, all, reject } from 'rsvp';
import { module, test } from 'qunit';
import OidcController from 'ui/admin-tab/auth/oidc/controller';

module('Unit | Controller | admin tab | auth | oidc');

test('requires a fresh local administrator verification when preparing activation', function(assert) {
  assert.expect(7);

  let controller = OidcController.create({
    identityMatchAccountId: null,
    identityStrategy: 'bind',
    localRecoveryUsername: 'break-glass-admin',
    localRecoveryPassword: 'current-local-password',
    selectedTargetAccountId: '1a1',
    testedIdentityProof: 'signed-proof',
    identityOperation(fields) {
      assert.strictEqual(fields.operation, 'bind', 'the tested identity is bound normally');
      assert.strictEqual(fields.identityProof, 'signed-proof', 'the verified identity proof is retained');
      assert.strictEqual(fields.targetAccountId, '1a1', 'the intended target account is retained');
      assert.strictEqual(fields.prepareProviderSwitch, true, 'the request prepares provider activation');
      assert.strictEqual(fields.localUsername, 'break-glass-admin',
        'the local administrator username is verified by the server');
      assert.strictEqual(fields.localPassword, 'current-local-password',
        'the current password is sent only in the verification request');
      return resolve({providerSwitchCode: 'switch-ticket'});
    },
  });

  return controller.prepareIdentitySwitch().then((code) => {
    assert.strictEqual(code, 'switch-ticket', 'activation receives the one-use switch ticket');
    run(() => controller.destroy());
  });
});

test('requires confirmation for the exact identity and permission reassignment', function(assert) {
  let source = EmberObject.create({id: '1a1', name: 'Old account', kind: 'admin', state: 'active'});
  let target = EmberObject.create({id: '1a2', name: 'New account', kind: 'user', state: 'active'});
  let controller = OidcController.create({
    access: EmberObject.create({
      enabled: true,
      provider: 'oidcconfig',
    }),
    accounts: [source, target],
    identityMatchAccountId: '1a1',
    identityStrategy: 'reassign',
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
  run(() => controller.destroy());
});

test('restores a disabled matched account before retaining its identity link', function(assert) {
  assert.expect(8);

  let disabled = EmberObject.create({id: '1a9', name: 'Disabled account', kind: 'admin', state: 'inactive'});
  let restored = EmberObject.create({id: '1a9', name: 'Disabled account', kind: 'admin', state: 'active'});
  let controller = OidcController.create({
    accounts: [disabled],
    identityMatchAccountId: '1a9',
    selectedTargetAccountId: '1a1',
    testedIdentityProof: 'signed-proof',
    userStore: EmberObject.create({
      createRecord(fields) {
        assert.strictEqual(fields.operation, 'restore', 'the explicit restore operation is used');
        assert.strictEqual(fields.targetAccountId, '1a9', 'only the matched account is restored');
        return {
          save() {
            return resolve({status: 'restored'});
          },
        };
      },
      find(type, id, options) {
        assert.strictEqual(type, 'account', 'accounts are reloaded after restoration');
        assert.strictEqual(id, null, 'the account collection is requested');
        assert.ok(options.forceReload, 'the restored state is not served from cache');
        return resolve([restored]);
      },
    }),
  });

  assert.ok(controller.get('canRestoreMatchedAccount'), 'the disabled match exposes the restore action');
  return controller.restoreMatchedIdentityAccount().then(() => {
    assert.strictEqual(controller.get('identityStrategy'), 'useExisting', 'the restored account link is retained');
    assert.strictEqual(controller.get('selectedTargetAccountId'), '1a9', 'the restored account becomes the target');
    run(() => controller.destroy());
  });
});

test('restores the existing local provider without replacing its password', function(assert) {
  assert.expect(5);

  let fallbackSaved = false;
  let restored;
  let localRecoveryModel = EmberObject.create({
    clone() {
      return EmberObject.create({
        enabled: false,
        username: 'not-returned-by-api',
        password: 'not-returned-by-api',
        save() {
          restored = this.getProperties('enabled', 'username', 'password');
          return resolve(this);
        },
      });
    },
  });
  let fallbackModel = EmberObject.create({
    save() {
      fallbackSaved = true;
      return resolve(this);
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
    run(() => controller.destroy());
  });
});

test('persists the browser origin before preparing an OIDC provider', function(assert) {
  assert.expect(5);

  let savedValue;
  let setting = EmberObject.create({
    value: '',
    save() {
      savedValue = this.get('value');
      return resolve(this);
    },
  });
  let controller = OidcController.create({
    settings: EmberObject.create({
      get(key) {
        assert.strictEqual(key, 'api$host', 'the canonical API host setting is checked');
        return '';
      },
    }),
    userStore: EmberObject.create({
      find(type, id) {
        assert.strictEqual(type, 'setting', 'the persistent setting resource is used');
        assert.strictEqual(id, 'api.host', 'the normalized setting name is converted for the API');
        return resolve(setting);
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
    run(() => controller.destroy());
  });
});

test('keeps the configured external platform URL when the console is opened by IP', function(assert) {
  assert.expect(2);

  let controller = OidcController.create({
    settings: EmberObject.create({
      get(key) {
        assert.strictEqual(key, 'api$host', 'the canonical API host setting is checked');
        return 'https://console.example.test';
      },
    }),
    userStore: EmberObject.create({
      find() {
        assert.ok(false, 'the configured external platform URL must not be replaced');
      },
    }),
    platformHostname() {
      return '192.0.2.125';
    },
    platformOrigin() {
      return 'http://192.0.2.125:8080';
    },
  });

  return controller.ensureApiHost().then((value) => {
    assert.strictEqual(value, 'https://console.example.test',
      'the configured HTTPS domain remains canonical');
    run(() => controller.destroy());
  });
});

test('rejects automatic HTTP and IP external platform URLs', function(assert) {
  assert.expect(6);

  let origins = [
    {hostname: 'console.example.test', origin: 'http://console.example.test'},
    {hostname: '192.0.2.125', origin: 'https://192.0.2.125'},
  ];

  return all(origins.map((candidate) => {
    let saved = false;
    let setting = EmberObject.create({
      value: '',
      save() {
        saved = true;
        return resolve(this);
      },
    });
    let controller = OidcController.create({
      intl: EmberObject.create({
        t(key) {
          assert.strictEqual(key, 'authPage.oidc.validation.externalPlatformUrl',
            'the localized canonical URL error is used');
          return 'A stable HTTPS domain is required.';
        },
      }),
      settings: EmberObject.create({
        get() {
          return '';
        },
      }),
      userStore: EmberObject.create({
        find() {
          return resolve(setting);
        },
      }),
      platformHostname() {
        return candidate.hostname;
      },
      platformOrigin() {
        return candidate.origin;
      },
    });

    return controller.ensureApiHost().then(() => {
      assert.ok(false, `${candidate.origin} must not become the canonical external platform URL`);
    }).catch((err) => {
      assert.strictEqual(err.message, 'A stable HTTPS domain is required.',
        'configuration stops before preparing the provider');
      assert.notOk(saved, 'the unsafe browser origin is not persisted');
    }).then(() => run(() => controller.destroy()));
  }));
});

test('keeps security enabled and restores the local session after provider activation fails', function(assert) {
  assert.expect(10);

  let events = [];
  let saveStates = [];
  let snapshot = {token: 'existing-local-session', values: {accountId: '1a1'}};
  let candidate = EmberObject.create({
    enabled: null,
    save() {
      saveStates.push(this.get('enabled'));
      events.push(`save:${this.get('enabled')}`);
      return resolve(this);
    },
  });
  let controller = OidcController.create({
    access: EmberObject.create({
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
          return reject(new Error('controlled token failure'));
        }
        assert.strictEqual(provider, 'providerSwitch', 'rollback uses the one-use recovery provider');
        assert.strictEqual(code, 'switch-ticket', 'rollback uses the same short-lived switch ticket');
        return resolve();
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
    intl: EmberObject.create({
      t() {
        return 'The failed activation was rolled back.';
      },
    }),
    recoveryModel: EmberObject.create({
      clone() {
        return EmberObject.create();
      },
    }),
    recoveryEnabled: true,
    recoveryProvider: 'localauthconfig',
    testedIdentity: {externalId: 'test-user'},
    prepareIdentitySwitch() {
      events.push('prepare-switch');
      return resolve('switch-ticket');
    },
    cancelIdentitySwitch() {
      events.push('cancel-switch');
      return resolve();
    },
    buildCandidateConfig() {
      return candidate;
    },
    restorePreviousProvider() {
      events.push('restore-provider');
      return resolve();
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
    run(() => controller.destroy());
  });
});

test('activates OIDC with an identity-bound ticket and never disables security', function(assert) {
  assert.expect(8);

  let events = [];
  let candidate = EmberObject.create({
    enabled: null,
    save() {
      events.push(`save:${this.get('enabled')}`);
      return resolve(this);
    },
  });
  let controller = OidcController.create({
    access: EmberObject.create({
      suspendSession() {
        events.push('suspend');
        return {token: 'local'};
      },
      login(code, provider, options) {
        assert.strictEqual(provider, 'oidcconfig', 'the fresh login targets the new provider');
        assert.strictEqual(options.providerSwitchCode, 'switch-ticket',
          'the identity-bound switch ticket is submitted with the authorization response');
        events.push('login');
        return resolve();
      },
      setProperties(values) {
        assert.strictEqual(values.provider, 'oidcconfig', 'OIDC becomes the active provider');
        events.push('set-oidc-provider');
      },
    }),
    recoveryModel: EmberObject.create({
      clone() {
        return EmberObject.create();
      },
    }),
    testedIdentity: {externalId: 'test-user'},
    prepareIdentitySwitch() {
      events.push('prepare-switch');
      return resolve('switch-ticket');
    },
    cancelIdentitySwitch(code) {
      assert.strictEqual(code, 'switch-ticket', 'the used activation ticket is cancelled if still active');
      events.push('cancel-switch');
      return resolve();
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
    run(() => controller.destroy());
  });
});
