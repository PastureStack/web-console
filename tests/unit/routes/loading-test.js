import { module, test } from 'qunit';

import Ember from 'ember';
import LoadingRoute from 'ui/loading/route';

module('Unit | Route | loading');

test('it exists', function(assert) {
  var route = LoadingRoute.create();
  assert.ok(route);
  Ember.run(() => route.destroy());
});
