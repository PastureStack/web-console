import { module, test } from 'qunit';
import { getOwner, setOwner } from '@ember/application';
import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { adoptStoreOwner } from 'ui/utils/initialize-api-store';
import {
  denormalizeId,
  denormalizeIdArray,
  referenceTypeForField,
} from 'ui/utils/api-store-references';

module('Unit | Utility | API store references', function() {
  test('retains the legacy singular type inference on the modern store API', function(assert) {
    assert.strictEqual(referenceTypeForField('serviceId'), 'service');
    assert.strictEqual(referenceTypeForField('serviceIds', true), 'service');
    assert.ok(denormalizeId('serviceId'), 'single reference returns a computed descriptor');
    assert.ok(denormalizeIdArray('serviceIds'), 'reference array returns a computed descriptor');
  });

  test('adopts the store owner through the public Ember API', function(assert) {
    const owner = { lookup() {} };
    const store = {};
    const resource = {};

    setOwner(store, owner);
    assert.strictEqual(adoptStoreOwner(resource, store), resource);
    assert.strictEqual(getOwner(resource), owner);
  });

  test('accepts expanded API relationships without a missing computed setter', function(assert) {
    const Resource = EmberObject.extend({
      mounts: denormalizeIdArray('mountIds'),
      stack: denormalizeId('stackId'),
    });
    const mounts = [{ id: '1m1', type: 'mount' }];
    const stack = { id: '1st1', type: 'stack' };
    const resource = Resource.create({ mounts, stack });

    assert.strictEqual(resource.get('mounts'), mounts, 'retains an expanded array relationship');
    assert.strictEqual(resource.get('stack'), stack, 'retains an expanded singular relationship');

    resource.destroy();
  });

  test('resolves ID relationships and registers reference watches', function(assert) {
    const records = {
      'mount:1m1': { id: '1m1', type: 'mount' },
      'service:1s1': { id: '1s1', type: 'service' },
      'service:1s2': { id: '1s2', type: 'service' },
    };
    const store = {
      _state: {
        missingReference: {},
        watchReference: {},
      },
      getById(type, id) {
        return records[`${ type }:${ id }`];
      },
    };
    const Resource = EmberObject.extend({
      mount: denormalizeId('mountId'),
      services: denormalizeIdArray('serviceIds'),
    });
    const resource = Resource.create({
      id: '1v1',
      mountId: '1m1',
      serviceIds: A(['1s1', '1s2']),
      store,
      type: 'volume',
    });

    assert.strictEqual(resource.get('mount'), records['mount:1m1']);
    assert.deepEqual(resource.get('services'), [records['service:1s1'], records['service:1s2']]);
    assert.strictEqual(store._state.watchReference['mount:1m1'].length, 1);
    assert.strictEqual(store._state.watchReference['service:1s1'].length, 1);
    assert.deepEqual(store._state.missingReference, {});

    resource.destroy();
  });
});
