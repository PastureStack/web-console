import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import NewAccountController from 'ui/admin-tab/accounts/new/controller';
import { createOwned, destroyOwned } from '../../../../helpers/owned-subject';

function modelFor(username, name) {
  return EmberObject.create({
    account: EmberObject.create({name}),
    credential: EmberObject.create({
      publicValue: username,
      secretValue: 'valid-test-password',
    }),
  });
}

module('Unit | Controller | admin tab | accounts | new');

test('new local accounts always receive a human-readable name', function(assert) {
  let controller = createOwned(NewAccountController, {
    model: modelFor('alice', ''),
  }, 'controller');

  assert.true(controller.validate(), 'valid credentials pass validation');
  assert.strictEqual(controller.get('model.account.name'), 'alice',
    'a blank display name safely falls back to the login username');

  controller.set('model', modelFor('bob', 'Bob Chen'));
  assert.true(controller.validate(), 'an explicit display name remains valid');
  assert.strictEqual(controller.get('model.account.name'), 'Bob Chen',
    'an explicit human-readable name is preserved');

  destroyOwned(controller);
});
