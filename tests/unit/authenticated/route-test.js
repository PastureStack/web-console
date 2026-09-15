import EmberObject from '@ember/object';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import AuthenticatedRoute from 'ui/authenticated/route';

module('Unit | Route | authenticated');

test('logs out only for an actual authentication failure', function(assert) {
  assert.expect(5);

  let transition = {targetName: 'authenticated.project.index', authGeneration: 'generation-a'};
  let route = AuthenticatedRoute.create({
    access: EmberObject.create({enabled: true}),
  });
  route.send = function(action, sentTransition, timedOut, error, generation) {
    assert.strictEqual(action, 'sessionInvalid', 'the passive session action is used');
    assert.strictEqual(sentTransition, transition, 'the failed transition is retained');
    assert.strictEqual(timedOut, true, 'the login page explains that authentication expired');
    assert.strictEqual(generation, 'generation-a', 'the request generation is retained');
  };

  route.loadingError({xhr: {status: 401}}, transition, EmberObject.create(), 'generation-a');
  assert.strictEqual(route.get('access.enabled'), true, 'access control remains enabled');
  run(() => route.destroy());
});

test('a 403 remains a permission failure and does not invalidate the session', function(assert) {
  assert.expect(1);
  let failure = {xhr: {status: 403}};
  let route = AuthenticatedRoute.create({access: EmberObject.create({enabled: true})});
  route.send = function() {
    assert.ok(false, '403 must not become logout or session invalidation');
  };

  return route.loadingError(failure, {targetName: 'authenticated.project.index'}).catch((actual) => {
    assert.strictEqual(actual, failure, 'the permission failure is surfaced unchanged');
    run(() => route.destroy());
  });
});

test('a timer response keeps its starting generation and never calls explicit logout', function(assert) {
  assert.expect(5);
  let access = EmberObject.create({
    captureGeneration() {
      return 'generation-a';
    },
    testAuth(generation) {
      assert.strictEqual(generation, 'generation-a', 'the timer uses the captured generation');
      return Promise.reject({xhr: {status: 401}});
    },
  });
  let route = AuthenticatedRoute.create({access});
  route.send = function(action, transition, timedOut, error, generation) {
    assert.strictEqual(action, 'sessionInvalid', 'the timer uses passive invalidation');
    assert.strictEqual(timedOut, true, 'the expired-session explanation is retained');
    assert.strictEqual(generation, 'generation-a', 'the delayed timer cannot change ownership');
    assert.strictEqual(arguments[5], 401, 'the authentication status is preserved');
  };

  return route.checkAuthToken('generation-a').then(() => run(() => route.destroy()));
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
