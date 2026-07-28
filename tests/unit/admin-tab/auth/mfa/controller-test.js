import Ember from 'ember';
import { module, test } from 'qunit';
import MfaController from 'ui/admin-tab/auth/mfa/controller';

module('Unit | Controller | admin tab | auth | mfa');

test('does not reload with a session that a self-security change revoked', function(assert) {
  assert.expect(3);

  let reloaded = false;
  let controller = MfaController.create({
    selectedAccountId: '1a1',
    session: Ember.Object.create({accountId: '1a1'}),
    reloadAccount() {
      reloaded = true;
      return Ember.RSVP.resolve();
    },
  });

  return controller.afterSessionRevocation().then(() => {
    assert.ok(controller.get('isCurrentAccount'), 'the selected account is the signed-in account');
    assert.ok(controller.get('reauthenticationRequired'), 'the UI requires a fresh sign-in');
    assert.notOk(reloaded, 'the revoked session is not used for another API request');
    Ember.run(() => controller.destroy());
  });
});

test('reloads normally when an administrator changes another account', function(assert) {
  assert.expect(2);

  let reloadCount = 0;
  let controller = MfaController.create({
    selectedAccountId: '1a2',
    session: Ember.Object.create({accountId: '1a1'}),
    reloadAccount() {
      reloadCount++;
      return Ember.RSVP.resolve();
    },
  });

  return controller.afterSessionRevocation().then(() => {
    assert.strictEqual(reloadCount, 1, 'the administrator session remains valid and reloads the target');
    assert.notOk(controller.get('reauthenticationRequired'), 'no unnecessary sign-in is requested');
    Ember.run(() => controller.destroy());
  });
});
