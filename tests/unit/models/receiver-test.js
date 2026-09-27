import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import Receiver from 'ui/models/receiver';

module('Unit | Model | receiver');

test('Clone and Remove follow the webhook schema and receiver self link', function(assert) {
  let schema = EmberObject.create({
    collectionMethods: A(['GET']),
    resourceMethods: A(['GET']),
  });
  let store = EmberObject.create({
    getById(type, id) {
      assert.deepEqual([type, id], ['schema', 'receiver']);
      return schema;
    },
    canCreate(type) {
      assert.strictEqual(type, 'receiver');
      return schema.get('collectionMethods').includes('POST');
    },
  });
  let receiver = Receiver.create({
    type: 'receiver',
    id: 'r1',
    store,
    links: {self: '/v1-webhooks/receivers/r1'},
  });
  let enabled = (name) => receiver.get('availableActions').findBy('action', name).enabled;

  assert.false(enabled('clone'), 'GET-only collection cannot clone');
  assert.false(enabled('promptDelete'), 'GET-only resource cannot delete');
  schema.set('collectionMethods', A(['GET', 'POST']));
  assert.true(enabled('clone'), 'POST enables Clone for a readable receiver');
  schema.set('resourceMethods', A(['GET', 'DELETE']));
  assert.true(enabled('promptDelete'), 'DELETE enables Remove with a self link');
  schema.set('resourceMethods', A(['DELETE']));
  assert.false(enabled('clone'), 'Clone also needs to read the source receiver');
  receiver.set('links', {});
  assert.false(enabled('promptDelete'), 'no self link means no DELETE target');
  receiver.destroy();
});
