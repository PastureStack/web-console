import { module, test } from 'qunit';

import Ember from 'ember';
import IndexRoute from 'ui/routes/index';

module('Unit | Route | index');

test('it exists', function(assert) {
  var route = IndexRoute.create();
  assert.ok(route);
  Ember.run(() => route.destroy());
});

test('activate redirects to authenticated route', function(assert) {
  assert.expect(1);

  var route = IndexRoute.create({
    transitionTo(name) {
      assert.equal(name, 'authenticated');
    },
  });

  route.get('actions').activate.call(route);
  Ember.run(() => route.destroy());
});
