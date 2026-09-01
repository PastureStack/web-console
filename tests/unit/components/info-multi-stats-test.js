import { module, test } from 'qunit';
import bb from 'billboard.js';
import { run } from '@ember/runloop';
import EmberObject from '@ember/object';

import {
  HOST_STATS_POINT_OPTIONS,
  graphGradientColor,
  initialGraphData,
  initialGraphGroups,
  default as InfoMultiStatsComponent
} from 'ui/components/info-multi-stats/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

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

test('chart gradients remain bound to the shared SVG across child routes', function(assert) {
  ['cpu', 'memory', 'network', 'storage'].forEach((type) => {
    assert.equal(graphGradientColor(type, 0), `url(#${type}-0-gradient)`, `${type} does not capture a child-route pathname`);
  });
});

test('unchanged parent stats survive child-route attribute refreshes', function(assert) {
  let connects = 0;
  let disconnects = 0;
  let teardowns = 0;
  let first = EmberObject.create({id: '1i1'});
  let second = EmberObject.create({id: '1i2'});
  let component = createOwned(InfoMultiStatsComponent, {
    renderer: inertRenderer(),
    intl: EmberObject.create({t(key) { return key; }}),
    model: first,
    linkName: 'containerStats',
    connect() {
      connects++;
    },
    disconnect() {
      disconnects++;
    },
    tearDown() {
      teardowns++;
    },
  }, 'component');

  run(() => component.didReceiveAttrs());
  run(() => component.set('statsSocket', EmberObject.create({active: false})));
  disconnects = 0;
  teardowns = 0;
  run(() => component.didReceiveAttrs());

  assert.equal(connects, 1, 'the initial resource connects once');
  assert.equal(disconnects, 0, 'a child-route rerender does not disconnect the shared stats stream');
  assert.equal(teardowns, 0, 'a child-route rerender does not clear visible graph history');

  run(() => {
    component.set('model', second);
    component.didReceiveAttrs();
  });

  assert.equal(connects, 2, 'a different container starts a new stream');
  assert.equal(disconnects, 1, 'the old container stream is closed once');
  assert.equal(teardowns, 1, 'graph history resets only when the container identity changes');

  component.set('statsSocket', null);
  destroyOwned(component);
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
