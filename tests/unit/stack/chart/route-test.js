import { module, test } from 'qunit';

import Ember from 'ember';
import StackChartRoute from 'ui/stack/chart/route';

module('Unit | Route | stack/chart');

test('it exists', function(assert) {
  var route = StackChartRoute.create();
  assert.ok(route);
  Ember.run(() => route.destroy());
});

test('model returns the parent stack model', function(assert) {
  var stack = { id: '1st1' };
  var route = StackChartRoute.create({
    modelFor(name) {
      assert.equal(name, 'stack');
      return {
        get(key) {
          assert.equal(key, 'stack');
          return stack;
        },
      };
    },
  });

  assert.strictEqual(route.model(), stack);
  Ember.run(() => route.destroy());
});
