import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import { naturalCompare, naturalSort } from 'ui/utils/natural-sort';

module('Unit | Utility | natural sort');

test('it compares names, addresses, and versions naturally', function(assert) {
  assert.ok(naturalCompare('container-2', 'container-10') < 0, 'numeric name segments use numeric order');
  assert.ok(naturalCompare('10.0.0.2', '10.0.0.10') < 0, 'IP address octets use numeric order');
  assert.ok(naturalCompare('v1.6.9', 'v1.6.10') < 0, 'version segments use numeric order');
});

test('it supports nested fields, descriptor direction, and stable ties', function(assert) {
  let items = [
    EmberObject.create({id: '2', host: EmberObject.create({name: 'node-10'}), score: 4}),
    EmberObject.create({id: '1', host: EmberObject.create({name: 'node-2'}), score: 4}),
    EmberObject.create({id: '3', host: EmberObject.create({name: 'node-1'}), score: 7}),
  ];

  assert.deepEqual(
    naturalSort(items, ['host.name']).map((item) => item.get('id')),
    ['3', '1', '2'],
    'reads nested properties'
  );
  assert.deepEqual(
    naturalSort(items, ['score:desc']).map((item) => item.get('id')),
    ['3', '2', '1'],
    'honours an explicit descending descriptor and preserves equal input order'
  );
});

test('it applies hysteresis to live metric ordering', function(assert) {
  let items = [
    EmberObject.create({id: 'a', cpuRms: 100}),
    EmberObject.create({id: 'b', cpuRms: 103}),
  ];

  assert.deepEqual(
    naturalSort(items, ['cpuRms'], {
      descending: true,
      hysteresis: 0.05,
      previousOrder: ['a', 'b'],
    }).map((item) => item.get('id')),
    ['a', 'b'],
    'near-equal values retain the prior rank'
  );

  items[1].set('cpuRms', 120);

  assert.deepEqual(
    naturalSort(items, ['cpuRms'], {
      descending: true,
      hysteresis: 0.05,
      previousOrder: ['a', 'b'],
    }).map((item) => item.get('id')),
    ['b', 'a'],
    'a meaningful difference changes the rank'
  );
});
