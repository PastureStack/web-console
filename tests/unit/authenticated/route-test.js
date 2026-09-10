import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import AuthenticatedRoute from 'ui/authenticated/route';

module('Unit | Route | authenticated');

test('logs out only for an actual authentication failure', function(assert) {
  assert.expect(4);

  let transition = {targetName: 'authenticated.project.index'};
  let route = AuthenticatedRoute.create({
    access: EmberObject.create({enabled: true}),
  });
  route.send = function(action, sentTransition, timedOut) {
    assert.strictEqual(action, 'logout', 'the logout action is used');
    assert.strictEqual(sentTransition, transition, 'the failed transition is retained');
    assert.strictEqual(timedOut, true, 'the login page explains that authentication expired');
  };

  route.loadingError({xhr: {status: 403}}, transition, EmberObject.create());
  assert.strictEqual(route.get('access.enabled'), true, 'access control remains enabled');
  run(() => route.destroy());
});

test('preserves the session and surfaces non-authentication initialization failures', function(assert) {
  assert.expect(2);

  let failure = {xhr: {status: 502}, message: 'schema request failed'};
  let route = AuthenticatedRoute.create({
    access: EmberObject.create({enabled: true}),
  });
  route.send = function() {
    assert.ok(false, 'a non-authentication failure must not log the user out');
  };

  return route.loadingError(failure, {targetName: 'authenticated.index'}, EmberObject.create()).then(() => {
    assert.ok(false, 'the initialization failure must remain visible');
  }, (actual) => {
    assert.strictEqual(actual, failure, 'the original error reaches the application error page');
    assert.strictEqual(route.get('access.enabled'), true, 'the valid authenticated session is preserved');
    run(() => route.destroy());
  });
});
