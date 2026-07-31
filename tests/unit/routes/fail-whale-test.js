import { run } from '@ember/runloop';

import { module, test } from 'qunit';
import FailWhaleRoute from 'ui/fail-whale/route';

module('Unit | Route | fail-whale');

test('it exists', function(assert) {
  var route = FailWhaleRoute.create();
  assert.ok(route);
  run(() => route.destroy());
});

test('model returns the application error', function(assert) {
  assert.expect(3);

  var error = { status: 500 };
  var route = FailWhaleRoute.create({
    controllerFor(name) {
      assert.equal(name, 'application');
      return {
        get(key) {
          assert.equal(key, 'error');
          return error;
        },
      };
    },
  });

  assert.strictEqual(route.model(), error);
  run(() => route.destroy());
});

test('afterModel resets store when an error exists', function(assert) {
  assert.expect(1);

  var route = FailWhaleRoute.create({
    storeReset: {
      reset() {
        assert.ok(true);
      },
    },
  });

  route.afterModel({ status: 500 });
  run(() => route.destroy());
});

test('afterModel redirects when no error exists', function(assert) {
  assert.expect(1);

  var route = FailWhaleRoute.create({
    transitionTo(name) {
      assert.equal(name, 'authenticated');
    },
  });

  route.afterModel(null);
  run(() => route.destroy());
});
