import { module, test } from 'qunit';
import bb from 'billboard.js';

import {
  HOST_STATS_POINT_OPTIONS,
  initialGraphData,
  initialGraphGroups
} from 'ui/components/info-multi-stats/component';

module('Unit | Component | info multi stats');

test('single-resource charts start with stable series and no point-node update path', function(assert) {
  assert.false(HOST_STATS_POINT_OPTIONS.show, 'dense area charts do not create per-sample point nodes');

  var expected = {
    cpu: ['System', 'User'],
    memory: ['Used'],
    network: ['Transmit', 'Receive'],
    storage: ['Write', 'Read'],
  };

  Object.keys(expected).forEach((type) => {
    var data = initialGraphData(type, true);

    assert.deepEqual(data.map((row) => row[0]), ['x'].concat(expected[type]), `${type} has stable initial series`);
    assert.deepEqual(initialGraphGroups(type, true), [expected[type]], `${type} stack uses the same series order`);
    data.forEach((row) => assert.equal(row.length, 61, `${type} ${row[0]} starts with 60 samples`));
  });
});

test('multi-resource charts retain dynamic series discovery', function(assert) {
  assert.deepEqual(initialGraphData('cpu', false).map((row) => row[0]), ['x']);
  assert.deepEqual(initialGraphGroups('cpu', false), [[]]);
});

test('Billboard redraws seeded host series without point-node errors', async function(assert) {
  var target = document.createElement('div');
  target.style.width = '540px';
  target.style.height = '110px';
  document.querySelector('#qunit-fixture').appendChild(target);

  var columns = initialGraphData('cpu', true);
  var graph = bb.generate({
    bindto: target,
    size: { height: 110 },
    data: {
      type: 'area-step',
      x: 'x',
      columns,
      groups: initialGraphGroups('cpu', true),
      colors: {
        System: '#27ae60',
        User: '#DBE8B1',
      },
    },
    point: HOST_STATS_POINT_OPTIONS,
    transition: { duration: 0 },
  });

  columns[1][60] = 12;
  columns[2][60] = 28;
  graph.load({ columns });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(target.querySelectorAll('.bb-target').length, 2, 'both host CPU series remain rendered');
  assert.equal(target.querySelectorAll('.bb-area').length, 2, 'both area paths survive the update');
  assert.equal(target.querySelectorAll('.bb-circle').length, 0, 'no unsupported point-node update path is created');

  graph.destroy();
});
