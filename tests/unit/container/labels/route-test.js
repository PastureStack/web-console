import { module, test } from 'qunit';

import Ember from 'ember';
import ContainerLabelsRoute from 'ui/container/labels/route';

module('Unit | Route | container/labels');

test('it exists', function(assert) {
  var route = ContainerLabelsRoute.create();
  assert.ok(route);
  Ember.run(() => route.destroy());
});

test('model returns the parent container model', function(assert) {
  var container = { id: '1i1' };
  var route = ContainerLabelsRoute.create({
    modelFor(name) {
      assert.equal(name, 'container');
      return container;
    },
  });

  assert.strictEqual(route.model(), container);
  Ember.run(() => route.destroy());
});
