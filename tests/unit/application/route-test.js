import { module, test } from 'qunit';

import Ember from 'ember';
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

  Ember.run(() => {
    var bubbles = route.get('actions').didTransition.call(route);
    assert.equal(bubbles, true, 'the transition action continues to bubble');
  });

  assert.equal(hidden, 1, 'the overlay is reconciled after rendering');
  Ember.run(() => route.destroy());
});

test('hideLoadingOverlay removes both blocking layers immediately', function(assert) {
  assert.expect(3);

  Ember.$('body').append('<div id="loading-underlay"></div><div id="loading-overlay"></div>');

  var route = ApplicationRoute.create({
    loadingShown: true,
  });

  route.hideLoadingOverlay();

  assert.equal(route.get('loadingShown'), false, 'loading state is cleared');
  assert.equal(Ember.$('#loading-overlay').css('display'), 'none', 'overlay is hidden');
  assert.equal(Ember.$('#loading-underlay').css('display'), 'none', 'underlay is hidden');

  Ember.$('#loading-overlay, #loading-underlay').remove();
  Ember.run(() => route.destroy());
});
