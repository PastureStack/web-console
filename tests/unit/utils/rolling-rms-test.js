import { module, test } from 'qunit';
import RollingRms from 'ui/utils/rolling-rms';

module('Unit | Utility | rolling rms');

test('it calculates RMS from the actual samples in the current window', function(assert) {
  let window = new RollingRms(3);

  window.push(3);
  window.push(4);

  assert.equal(window.samples.length, 2, 'startup padding is not counted as monitored data');
  assert.ok(Math.abs(window.rms - Math.sqrt(12.5)) < 1e-10, 'uses the root mean square');
  assert.deepEqual(window.toArray(true), [0, 3, 4], 'only the chart representation is padded');
});

test('it evicts samples that leave the chart window', function(assert) {
  let window = new RollingRms(2);

  window.push(3);
  window.push(4);
  window.push(12);

  assert.deepEqual(window.toArray(), [4, 12], 'keeps the same interval as the chart');
  assert.ok(Math.abs(window.rms - Math.sqrt(80)) < 1e-10, 'removes the expired square from the aggregate');
});

test('it normalizes invalid or negative usage samples', function(assert) {
  let window = new RollingRms(3);

  window.push(NaN);
  window.push(-5);
  window.push('2');

  assert.deepEqual(window.toArray(), [0, 0, 2]);
});
