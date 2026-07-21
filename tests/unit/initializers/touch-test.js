import { module, test } from 'qunit';

import { initialize } from 'ui/initializers/touch';

module('Initializer | touch');

// Replace this with your real tests.
test('it marks the body for touch-aware styling', function(assert) {
  var body = $('BODY');

  body.removeClass('touch no-touch');
  initialize();

  assert.ok(body.hasClass('touch') || body.hasClass('no-touch'));
  body.removeClass('touch no-touch');
});
