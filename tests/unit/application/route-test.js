import $ from 'jquery';
import { run } from '@ember/runloop';
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
  });

  run(() => route.get('actions').loading.call(route, transition));
  assert.equal(route.get('loadingShown'), true, 'the loading overlay is shown');

  run(() => transition.rejected());
  assert.equal(route.get('loadingShown'), false, 'the rejected transition clears the overlay');

  $('#loading-overlay, #loading-underlay').remove();
  run(() => route.destroy());
});
