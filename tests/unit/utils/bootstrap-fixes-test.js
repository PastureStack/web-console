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

test('legacy global action positioning clears Bootstrap end alignment', function(assert) {
  let fixture = document.getElementById('qunit-fixture');
  let originalCalculator = $.PositionCalculator;

  fixture.innerHTML = '<button type="button">Open</button><ul class="dropdown-menu" style="right:0"></ul>';
  $.PositionCalculator = function() {
    this.calculate = function() {
      return {moveBy: {x: 25, y: 40}};
    };
  };

  try {
    bootstrapFixes.positionDropdown($(fixture.querySelector('ul')), fixture.querySelector('button'), true);
    assert.strictEqual(fixture.querySelector('ul').style.right, 'auto', 'the menu is not stretched between left and right');
    assert.strictEqual(fixture.querySelector('ul').style.left, '25px', 'the calculated horizontal anchor is applied');
    assert.strictEqual(fixture.querySelector('ul').style.top, '40px', 'the calculated vertical anchor is applied');
  } finally {
    $.PositionCalculator = originalCalculator;
  }
});

test('a global action menu moves beside overlapping action triggers', function(assert) {
  let fixture = document.getElementById('qunit-fixture');

  fixture.innerHTML = `
    <button class="more-actions">First</button>
    <button class="more-actions">Second</button>
    <ul class="global-actions" style="left: 100px"></ul>
  `;

  let menu = fixture.querySelector('.global-actions');
  let triggers = fixture.querySelectorAll('.more-actions');

  menu.getBoundingClientRect = () => ({left: 100, right: 200, top: 40, bottom: 140, width: 100, height: 100});
  triggers[0].getBoundingClientRect = () => ({left: 180, right: 200, top: 10, bottom: 30, width: 20, height: 20});
  triggers[1].getBoundingClientRect = () => ({left: 180, right: 200, top: 80, bottom: 100, width: 20, height: 20});

  assert.strictEqual(bootstrapFixes.avoidDropdownTriggerOverlap($(menu)), 76, 'the menu is placed four pixels left of the overlapping trigger column');
  assert.strictEqual(menu.style.left, '76px', 'the corrected left coordinate is applied');
});
