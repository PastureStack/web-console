import { run } from '@ember/runloop';
import { reject, resolve } from 'rsvp';

import { module, test } from 'qunit';
import LogoutRoute from 'ui/logout/route';

module('Unit | Route | logout');

test('it exists', function(assert) {
  var route = LogoutRoute.create();
  assert.ok(route);
  run(() => route.destroy());
});

test('beforeModel adopts the current session before sending logout to transition', async function(assert) {
  assert.expect(3);

  var route = LogoutRoute.create({
    access: {
      ensureSession() {
        assert.ok(true, 'the explicit logout route first rebuilds in-memory ownership');
        return resolve({status: 'active'});
      },
    },
  });
  let pendingLogout = {};
  let result = await route.beforeModel({
    send(name) {
      assert.equal(name, 'logout');
      return pendingLogout;
    },
  });
  assert.strictEqual(result, pendingLogout, 'the route waits for explicit logout to finish');
  run(() => route.destroy());
});

test('beforeModel still finishes logout when no session cookie exists', async function(assert) {
  assert.expect(2);

  var route = LogoutRoute.create({
    access: {
      ensureSession() {
        return reject({status: 401});
      },
    },
  });
  let pendingLogout = {};
  let result = await route.beforeModel({
    send(name) {
      assert.equal(name, 'logout');
      return pendingLogout;
    },
  });
  assert.strictEqual(result, pendingLogout, 'an already logged-out browser reaches the login transition');
  run(() => route.destroy());
});
