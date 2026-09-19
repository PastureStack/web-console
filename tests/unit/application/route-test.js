import $ from 'jquery';
import { run } from '@ember/runloop';
import { Promise } from 'rsvp';
import { module, test } from 'qunit';

import ApplicationRoute from 'ui/application/route';

module('Unit | Route | application');

test('didTransition schedules removal of the initial loading overlay', function(assert) {
  assert.expect(2);

  var hidden = 0;
  var route = ApplicationRoute.create({
    hideLoadingOverlay() {
      hidden++;
    },
  });

  run(() => {
    var bubbles = route.get('actions').didTransition.call(route);
    assert.equal(bubbles, true, 'the transition action continues to bubble');
  });

  assert.equal(hidden, 1, 'the overlay is reconciled after rendering');
  run(() => route.destroy());
});

test('hideLoadingOverlay removes both blocking layers immediately', function(assert) {
  assert.expect(3);

  $('body').append('<div id="loading-underlay"></div><div id="loading-overlay"></div>');

  var route = ApplicationRoute.create({
    loadingShown: true,
  });

  route.hideLoadingOverlay();

  assert.equal(route.get('loadingShown'), false, 'loading state is cleared');
  assert.equal($('#loading-overlay').css('display'), 'none', 'overlay is hidden');
  assert.equal($('#loading-underlay').css('display'), 'none', 'underlay is hidden');

  $('#loading-overlay, #loading-underlay').remove();
  run(() => route.destroy());
});

test('the latest overlapping transition owns the loading overlay', function(assert) {
  assert.expect(4);

  $('body').append('<div id="loading-underlay" class="hide"></div><div id="loading-overlay" class="hide"></div>');

  function fakeTransition() {
    return {
      fulfilled: null,
      rejected: null,
      then(fulfilled, rejected) {
        this.fulfilled = fulfilled;
        this.rejected = rejected;
      },
    };
  }

  var first = fakeTransition();
  var second = fakeTransition();
  var route = ApplicationRoute.create({
    loadingTimeout: 60000,
    access: {captureGeneration() { return 'generation-a'; }},
  });

  run(() => {
    route.get('actions').loading.call(route, first);
    route.get('actions').loading.call(route, second);
  });

  assert.equal(route.get('loadingId'), 2, 'both transitions receive a monotonic id');
  assert.equal(route.get('loadingShown'), true, 'the newest transition keeps the overlay visible');

  run(() => first.fulfilled());
  assert.equal(route.get('loadingShown'), true, 'a stale transition cannot hide the overlay');

  run(() => second.fulfilled());
  assert.equal(route.get('loadingShown'), false, 'the newest transition clears the overlay');

  $('#loading-overlay, #loading-underlay').remove();
  run(() => route.destroy());
});

test('a rejected transition clears the loading overlay', function(assert) {
  assert.expect(2);

  $('body').append('<div id="loading-underlay" class="hide"></div><div id="loading-overlay" class="hide"></div>');

  var transition = {
    then(fulfilled, rejected) {
      this.rejected = rejected;
    },
  };
  var route = ApplicationRoute.create({
    loadingTimeout: 60000,
    access: {captureGeneration() { return 'generation-a'; }},
  });

  run(() => route.get('actions').loading.call(route, transition));
  assert.equal(route.get('loadingShown'), true, 'the loading overlay is shown');

  run(() => transition.rejected());
  assert.equal(route.get('loadingShown'), false, 'the rejected transition clears the overlay');

  $('#loading-overlay, #loading-underlay').remove();
  run(() => route.destroy());
});

test('a route 401 uses passive generation-aware reconciliation', function(assert) {
  assert.expect(5);
  let transition = {
    authGeneration: 'request-generation',
    abort() {
      assert.ok(true, 'the failed transition is stopped');
    },
    send(action, sentTransition, timedOut, error, generation) {
      assert.strictEqual(action, 'sessionInvalid', 'route failures cannot invoke explicit logout');
      assert.strictEqual(sentTransition, transition, 'the failed transition is retained');
      assert.strictEqual(timedOut, true, 'the user sees the expired-session reason if ownership is confirmed');
      assert.strictEqual(generation, 'request-generation', 'the request starting generation is retained');
    },
  };
  let route = ApplicationRoute.create();
  route.hideLoadingOverlay = function() {};
  route.send = function() {
    assert.ok(false, 'the application route must not dispatch into an uncommitted route hierarchy');
  };

  route.get('actions').error.call(route, {xhr: {status: 401}}, transition);
  run(() => route.destroy());
});

test('an initial 401 without a transition uses direct passive recovery', async function(assert) {
  let loginTransitions = 0;
  let route = ApplicationRoute.create({
    access: {
      captureGeneration() {
        return 'initial-generation';
      },
      handlePassiveFailure(generation, status) {
        assert.strictEqual(generation, 'initial-generation', 'the current tab generation is retained');
        assert.strictEqual(status, 401, 'the failure remains passive authentication recovery');
        return Promise.resolve({status: 'invalid'});
      },
    },
  });
  route.hideLoadingOverlay = function() {};
  route.send = function() {
    assert.ok(false, 'Route#send is illegal before the first hierarchy commits');
  };
  route.transitionToLogin = function(transition, timedOut) {
    assert.strictEqual(transition, null, 'there is no fabricated transition');
    assert.strictEqual(timedOut, true, 'confirmed invalid ownership preserves the timeout reason');
    loginTransitions++;
  };

  let handled = route.get('actions').error.call(route, {xhr: {status: 401}}, null);
  assert.strictEqual(handled, false, 'the initial error is handled without bubbling');
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(loginTransitions, 1, 'direct recovery reaches the login route exactly once');
  run(() => route.destroy());
});

test('a restored current session resumes an aborted route without another login', async function(assert) {
  let reloads = 0;
  let loginTransitions = 0;
  let transition = {authGeneration: 'current-generation'};
  let route = ApplicationRoute.create({
    access: {
      handlePassiveFailure(generation, status) {
        assert.strictEqual(generation, 'current-generation', 'the failed request keeps its owner');
        assert.strictEqual(status, 401, 'only authentication failure enters recovery');
        return Promise.resolve({status: 'active', generation});
      },
    },
  });
  route.reloadForSession = function() {
    reloads++;
  };
  route.transitionToLogin = function() {
    loginTransitions++;
  };

  await route.get('actions').sessionInvalid.call(
    route, transition, true, null, transition.authGeneration, 401
  );

  assert.strictEqual(reloads, 1, 'the aborted route is retried after cookie recovery');
  assert.strictEqual(loginTransitions, 0, 'a valid recovered session never shows login');
  run(() => route.destroy());
});

test('duplicate cross-tab generation events validate and reload exactly once', async function(assert) {
  let resolveAdoption;
  let adoption = new Promise((resolve) => {
    resolveAdoption = resolve;
  });
  let validations = 0;
  let reloads = 0;
  let generation = '1726358400000.' + 'a'.repeat(64);
  let route = ApplicationRoute.create({
    access: {
      adoptSharedSession() {
        validations++;
        return adoption;
      },
      authSession: {
        readShared() {
          return {generation, accountId: '1a1', committedAt: 1726358400000};
        },
      },
    },
  });
  route.reloadForSession = function() {
    reloads++;
  };

  let first = route.get('actions').authSessionChanged.call(route, {
    newRecord: {generation},
  });
  let duplicate = route.get('actions').authSessionChanged.call(route, {
    newRecord: {generation},
  });
  assert.strictEqual(first, duplicate, 'overlapping events share the same reconciliation promise');

  resolveAdoption({status: 'adopted', generation});
  await first;
  run(() => {});

  assert.strictEqual(validations, 1, 'the shared cookie is validated once');
  assert.strictEqual(reloads, 1, 'the route reloads once without a generation loop');
  assert.strictEqual(route.get('lastSyncedGeneration'), generation, 'the applied generation is remembered');
  run(() => route.destroy());
});

test('a login generation queued behind logout removal is reconciled after the barrier releases', async function(assert) {
  let releaseRemoval;
  let removal = new Promise((resolve) => {
    releaseRemoval = resolve;
  });
  let generation = '1726358400001.' + 'b'.repeat(64);
  let calls = 0;
  let reloads = 0;
  let loginTransitions = 0;
  let route = ApplicationRoute.create({
    authSession: {
      readShared() {
        return {generation, accountId: '1a1', committedAt: 1726358400100};
      },
    },
    access: {
      adoptSharedSession() {
        calls++;
        return calls === 1 ? removal : Promise.resolve({status: 'adopted', generation});
      },
    },
  });
  route.reloadForSession = function() {
    reloads++;
  };
  route.transitionToLogin = function() {
    loginTransitions++;
  };

  let removing = route.syncAuthSessionChange({newRecord: null});
  let queued = route.syncAuthSessionChange({newRecord: {generation}});
  assert.strictEqual(queued, removing, 'the login event waits behind the active removal reconciliation');
  releaseRemoval({status: 'invalid'});
  await removing;
  let adopting = route.get('sessionSyncPromise');
  if ( adopting ) {
    await adopting;
  }

  assert.strictEqual(calls, 2, 'the latest shared generation is validated after removal settles');
  assert.strictEqual(loginTransitions, 1, 'the confirmed removal may show the login route once');
  assert.strictEqual(reloads, 1, 'the queued login then reloads the tab into the authenticated session');
  assert.strictEqual(route.get('lastSyncedGeneration'), generation, 'the queued generation becomes the applied owner');
  run(() => route.destroy());
});

test('the application route subscribes with a stable Evented callback', function(assert) {
  let listener;
  let removed;
  let service = {
    on(name, callback) {
      assert.strictEqual(name, 'changed', 'the route subscribes to ownership changes');
      assert.strictEqual(typeof callback, 'function', 'the compatible two-argument Evented form receives a callback');
      listener = callback;
    },
    off(name, callback) {
      removed = {name, callback};
    },
  };
  let received;
  let route = ApplicationRoute.create({authSession: service});
  route.syncAuthSessionChange = function(change) {
    received = change;
  };

  route.ensureAuthSessionSubscription();
  let change = {newRecord: {generation: '1726358400002.' + 'c'.repeat(64)}};
  listener(change);
  assert.strictEqual(received, change, 'the Evented callback reaches reconciliation directly');
  let stable = listener;
  route.ensureAuthSessionSubscription();
  assert.strictEqual(listener, stable, 'repeated route hooks do not replace or duplicate the listener');
  run(() => route.destroy());
  assert.deepEqual(removed, {name: 'changed', callback: stable}, 'destruction removes the exact callback');
});
