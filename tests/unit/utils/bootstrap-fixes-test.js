import $ from 'jquery';
import bootstrapFixes from '../../../utils/bootstrap-fixes';
import { module, test } from 'qunit';

module('Unit | Utility | bootstrap fixes');

// Replace this with your real tests.
test('it works', function(assert) {
  var result = bootstrapFixes.resizeDropdown;
  assert.ok(result);
});

test('Bootstrap 5 toggle events do not invoke the legacy position calculator', function(assert) {
  let fixture = document.getElementById('qunit-fixture');
  let originalCalculator = $.PositionCalculator;
  let called = false;

  fixture.innerHTML = '<div class="dropdown"><button class="dropdown-toggle">Open</button><ul class="dropdown-menu"></ul></div>';
  $.PositionCalculator = function() {
    called = true;
  };

  try {
    assert.strictEqual(bootstrapFixes.resizeDropdown({
      target: fixture.querySelector('.dropdown-toggle'),
      relatedTarget: fixture.querySelector('.dropdown-toggle'),
    }), null, 'Bootstrap 5 keeps ownership of its own menu positioning');
    assert.false(called, 'the legacy calculator is not called with an empty menu');
  } finally {
    $.PositionCalculator = originalCalculator;
  }
});

test('a missing position result fails closed without throwing', function(assert) {
  let fixture = document.getElementById('qunit-fixture');
  let originalCalculator = $.PositionCalculator;

  fixture.innerHTML = '<div class="dropdown"><button class="dropdown-toggle">Open</button><ul class="dropdown-menu"></ul></div>';
  $.PositionCalculator = function() {
    this.calculate = function() {
      return null;
    };
  };

  try {
    assert.strictEqual(bootstrapFixes.resizeDropdown({
      target: fixture.querySelector('.dropdown'),
      relatedTarget: fixture.querySelector('.dropdown-toggle'),
    }), null, 'an unavailable legacy position is ignored');
  } finally {
    $.PositionCalculator = originalCalculator;
  }
});
