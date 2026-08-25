import { bind, run } from '@ember/runloop';
import { module, test } from 'qunit';

module('Unit | Vendor | Runloop compatibility');

test('Ember.run.bind uses the public runloop helper instead of Function.prototype', function(assert) {
  const target = {
    value: 42,
    read() {
      return this.value;
    },
  };
  const bound = bind(target, target.read);

  assert.true(Object.prototype.hasOwnProperty.call(run, 'bind'));
  assert.strictEqual(bound(), 42);
});
