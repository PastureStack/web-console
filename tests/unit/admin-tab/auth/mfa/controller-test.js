import { run } from '@ember/runloop';
import { resolve, reject } from 'rsvp';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import MfaController from 'ui/admin-tab/auth/mfa/controller';

module('Unit | Controller | admin tab | auth | mfa');

test('MFA settings opens step-up on a wrapped API error and retries only after confirmation', function(assert) {
  let requests = [];
  let controller = MfaController.create({
    settingsForm: EmberObject.create({origin: 'https://example.test', smtpPassword: 'test-only'}),
    userStore: {
      rawRequest(options) {
        requests.push(options);
        return requests.length === 1 ? reject({type: 'error', body: {
          status: 401, code: 'MfaReauthenticationRequired',
        }}) : resolve();
      },
    },
    modalService: {
      toggleModal(name, options) {
        assert.strictEqual(name, 'mfa-security-confirmation');
        assert.strictEqual(requests.length, 1, 'no retry before the user confirms');
        options.onComplete('one-use-ticket');
      },
    },
    reloadSettings() { return resolve(); },
  });
  return controller.actions.saveSettings.call(controller, false).then(() => {
    assert.strictEqual(requests.length, 2);
    assert.strictEqual(requests[1].method, 'PUT');
    assert.strictEqual(requests[1].data.origin, 'https://example.test');
    assert.strictEqual(requests[1].data.securityConfirmation, 'one-use-ticket');
    assert.notOk(requests[0].data.securityConfirmation, 'initial payload was not mutated');
    assert.strictEqual(controller.get('settingsForm.smtpPassword'), '', 'password cleared after success');
    assert.notOk(controller.get('busy'));
    run(() => controller.destroy());
  });
});

test('cancelling security confirmation never resubmits MFA settings', function(assert) {
  let count = 0;
  let controller = MfaController.create({
    settingsForm: EmberObject.create({}),
    userStore: {rawRequest() {
      count++;
      return reject({body: {code: 'MfaReauthenticationRequired'}});
    }},
    modalService: {toggleModal(name, options) { options.onCancel(); }},
  });
  return controller.actions.saveSettings.call(controller, false).then(() => {
    assert.strictEqual(count, 1);
    assert.notOk(controller.get('busy'));
    assert.notOk(controller.get('errors'));
    run(() => controller.destroy());
  });
});

test('updates the global MFA and SMTP settings resource', function(assert) {
  assert.expect(3);

  let requestOptions;
  let controller = MfaController.create({
    settingsForm: EmberObject.create({
      enforcement: 'optional',
      smtpEnabled: true,
      smtpHost: 'smtp.example.test',
      smtpPort: 587,
      smtpFrom: 'security@example.test',
      smtpStartTls: true,
      smtpSsl: false,
      securityEmailLocale: 'zh-tw',
    }),
    testRecipient: '',
    userStore: {
      rawRequest(options) {
        requestOptions = options;
        return resolve();
      },
    },
    withSecurityConfirmation(callback) {
      return callback('one-use-confirmation');
    },
    reloadSettings() {
      return resolve();
    },
  });

  return controller.actions.saveSettings.call(controller, false).then(() => {
    assert.strictEqual(requestOptions.url, 'mfaSettings/global',
      'the singleton settings resource is addressed explicitly');
    assert.strictEqual(requestOptions.method, 'PUT',
      'an update does not use collection-create semantics');
    assert.strictEqual(requestOptions.data.securityConfirmation, 'one-use-confirmation',
      'the sensitive update carries its one-use confirmation');
    run(() => controller.destroy());
  });
});

test('does not reload with a session that a self-security change revoked', function(assert) {
  assert.expect(3);

  let reloaded = false;
  let controller = MfaController.create({
    selectedAccountId: '1a1',
    session: EmberObject.create({accountId: '1a1'}),
    reloadAccount() {
      reloaded = true;
      return resolve();
    },
  });

  return controller.afterSessionRevocation().then(() => {
    assert.ok(controller.get('isCurrentAccount'), 'the selected account is the signed-in account');
    assert.ok(controller.get('reauthenticationRequired'), 'the UI requires a fresh sign-in');
    assert.notOk(reloaded, 'the revoked session is not used for another API request');
    run(() => controller.destroy());
  });
});

test('reloads normally when an administrator changes another account', function(assert) {
  assert.expect(2);

  let reloadCount = 0;
  let controller = MfaController.create({
    selectedAccountId: '1a2',
    session: EmberObject.create({accountId: '1a1'}),
    reloadAccount() {
      reloadCount++;
      return resolve();
    },
  });

  return controller.afterSessionRevocation().then(() => {
    assert.strictEqual(reloadCount, 1, 'the administrator session remains valid and reloads the target');
    assert.notOk(controller.get('reauthenticationRequired'), 'no unnecessary sign-in is requested');
    run(() => controller.destroy());
  });
});
