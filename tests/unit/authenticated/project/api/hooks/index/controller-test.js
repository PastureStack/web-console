import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import HooksIndexController from 'ui/authenticated/project/api/hooks/index/controller';
import { createOwned, destroyOwned } from '../../../../../../helpers/owned-subject';

module('Unit | Controller | authenticated/project/api/hooks/index');

test('Add Receiver follows the current webhook schema POST capability', function(assert) {
  let schema = EmberObject.create({collectionMethods: A(['GET'])});
  let store = EmberObject.create({
    canCreate(type) {
      assert.strictEqual(type, 'receiver');
      return schema.get('collectionMethods').includes('POST');
    },
  });
  let controller = createOwned(HooksIndexController, {
    webhookStore: store,
    model: EmberObject.create({receiverSchema: schema, receivers: A([])}),
  }, 'controller');

  assert.false(controller.get('canAddReceiver'), 'read-only schema hides Add Receiver');
  schema.set('collectionMethods', A(['GET', 'POST']));
  assert.true(controller.get('canAddReceiver'), 'POST capability reveals Add Receiver');
  schema.set('collectionMethods', A(['GET']));
  assert.false(controller.get('canAddReceiver'), 'a capability change hides the action again');
  destroyOwned(controller);
});
