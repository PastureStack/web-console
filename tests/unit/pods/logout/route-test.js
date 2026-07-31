import { run } from '@ember/runloop';

import { module, test } from 'qunit';
import LogoutRoute from 'ui/logout/route';

module('Unit | Route | logout');

test('it exists', function(assert) {
  var route = LogoutRoute.create();
  assert.ok(route);
  run(() => route.destroy());
});

test('beforeModel sends logout to transition', function(assert) {
  assert.expect(1);

  var route = LogoutRoute.create();
  route.beforeModel({
    send(name) {
      assert.equal(name, 'logout');
    },
  });
  run(() => route.destroy());
});
