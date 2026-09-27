import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { resolve } from 'rsvp';
import { module, test } from 'qunit';
import HooksRoute from 'ui/authenticated/project/api/hooks/route';
import { createOwned, destroyOwned } from '../../../../../helpers/owned-subject';

module('Unit | Route | authenticated/project/api/hooks');

test('the receiver capability comes from the webhook schema response', async function(assert) {
  let receiverSchema = EmberObject.create({
    id: 'receiver',
    collectionMethods: A(['GET']),
    resourceFields: {name: {}},
  });
  let schemas = A([
    receiverSchema,
    EmberObject.create({id: 'scaleservice', resourceFields: {serviceId: {}}}),
    EmberObject.create({id: 'scalehost', resourceFields: {hostSelector: {}}}),
    EmberObject.create({id: 'serviceupgrade', resourceFields: {serviceSelector: {}}}),
  ]);
  let calls = [];
  let store = EmberObject.create({
    findAll(type, options) {
      calls.push({type, options});
      return resolve(type === 'schema' ? schemas : A([]));
    },
  });
  let route = createOwned(HooksRoute, {webhookStore: store}, 'route');

  let model = await route.model();
  assert.strictEqual(model.receiverSchema, receiverSchema, 'the loaded schema reaches the index controller');
  assert.true(receiverSchema.resourceFields.name.required, 'the existing field validation remains applied');
  assert.deepEqual(calls, [
    {type: 'schema', options: {url: 'schemas'}},
    {type: 'receiver', options: {forceReload: true}},
  ], 'the schema is loaded before the receiver collection');
  destroyOwned(route);
});
