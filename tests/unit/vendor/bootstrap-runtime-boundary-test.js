import $ from 'jquery';
import { module, test } from 'qunit';
import installBootstrapRuntime from 'ui/utils/bootstrap-runtime';

module('Unit | Vendor | Bootstrap runtime boundary');

test('the maintained Bootstrap runtime is registered', function(assert) {
  installBootstrapRuntime();
  let runtime = window.bootstrap;

  ['Button', 'Collapse', 'Dropdown', 'Tooltip', 'Popover'].forEach((name) => {
    assert.equal(typeof runtime[name], 'function', `${name} is registered by Bootstrap 5`);
    assert.equal(runtime[name].VERSION, '5.3.8', `${name} comes from Bootstrap 5.3.8`);
  });
});

test('the Bootstrap collapse data API handles the production header contract', function(assert) {
  let done = assert.async();
  let fixture = document.getElementById('qunit-fixture');

  installBootstrapRuntime();
  fixture.innerHTML = '<button type="button" data-bs-toggle="collapse" data-bs-target="#bootstrap-runtime-panel" aria-expanded="false"></button><div id="bootstrap-runtime-panel" class="collapse">Navigation</div>';

  let trigger = fixture.querySelector('button');
  let panel = fixture.querySelector('#bootstrap-runtime-panel');

  trigger.click();
  setTimeout(() => {
    assert.true(panel.classList.contains('show'), 'the maintained runtime opens the collapsed navigation');
    assert.strictEqual(window.getComputedStyle(panel).display, 'block', 'the presentation bridge renders Bootstrap 5 show state');
    assert.strictEqual(trigger.getAttribute('aria-expanded'), 'true', 'the trigger exposes its expanded state');

    trigger.click();
    setTimeout(() => {
      assert.false(panel.classList.contains('show'), 'the maintained runtime closes the navigation again');
      assert.strictEqual(trigger.getAttribute('aria-expanded'), 'false', 'the trigger exposes its collapsed state');
      done();
    }, 450);
  }, 450);
});

test('the legacy hide contract keeps inactive overlays non-interactive', function(assert) {
  let fixture = document.getElementById('qunit-fixture');

  fixture.innerHTML = '<div class="underlay hide">Inactive overlay</div>';

  assert.strictEqual(
    window.getComputedStyle(fixture.firstElementChild).display,
    'none',
    'the Bootstrap 3 compatibility class still removes inactive overlays from hit testing'
  );
});

test('the Bootstrap 5 dropdown state keeps the established menu presentation', function(assert) {
  let fixture = document.getElementById('qunit-fixture');

  installBootstrapRuntime();
  fixture.innerHTML = '<div class="dropdown"><button type="button" data-bs-toggle="dropdown" aria-expanded="false">Language</button><div class="dropdown-menu dropdown-menu-end"><a class="dropdown-item" href="#">English</a></div></div>';

  let trigger = fixture.querySelector('button');
  let menu = fixture.querySelector('.dropdown-menu');
  let dropdown = window.bootstrap.Dropdown.getOrCreateInstance(trigger);

  dropdown.show();
  assert.true(menu.classList.contains('show'), 'Bootstrap 5 marks the menu open');
  assert.strictEqual(window.getComputedStyle(menu).display, 'block', 'the presentation bridge displays the open menu');
  assert.strictEqual(trigger.getAttribute('aria-expanded'), 'true', 'the trigger exposes its open state');

  dropdown.hide();
  assert.false(menu.classList.contains('show'), 'Bootstrap 5 closes the menu');
  dropdown.dispose();
});

test('the footer language menu stays above its trigger and inside the viewport', function(assert) {
  let fixture = document.getElementById('qunit-fixture');

  installBootstrapRuntime();
  fixture.innerHTML = '<footer><div style="float:right"><div class="dropdown language-dropdown inline-block"><button type="button" class="lang-select" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false">Deutsch</button><ul class="dropdown-menu dropdown-menu-end text-right" style="width:349px"><li><a href="#">Deutsch (Deutschland)</a></li></ul></div></div></footer>';

  let trigger = fixture.querySelector('button');
  let menu = fixture.querySelector('.dropdown-menu');
  let dropdown = window.bootstrap.Dropdown.getOrCreateInstance(trigger);

  dropdown.show();

  let menuRect = menu.getBoundingClientRect();
  let triggerRect = trigger.getBoundingClientRect();

  assert.ok(menuRect.right <= window.innerWidth, 'the menu right edge does not overflow the viewport');
  assert.ok(Math.abs(menuRect.right - triggerRect.right) < 2, 'the menu is anchored to the trigger right edge');
  assert.ok(menuRect.bottom <= triggerRect.top, 'the footer menu opens upward');

  dropdown.hide();
  dropdown.dispose();
});

test('security actions render a visible icon from the current icon font', function(assert) {
  let fixture = document.getElementById('qunit-fixture');

  fixture.innerHTML = '<button class="btn btn-default"><i class="icon icon-shield"></i><span class="sr-only">Security</span></button>';
  let icon = fixture.querySelector('.icon-shield');
  let glyph = window.getComputedStyle(icon, '::before');

  assert.notStrictEqual(glyph.content, 'none', 'the shield compatibility alias has a glyph');
  assert.ok(icon.getBoundingClientRect().width > 0, 'the security glyph occupies visible space');
});

test('Bootstrap 5 multiselect preserves the application command surface', function(assert) {
  let select = $('<select multiple><option value="read" selected>Read</option><option value="write">Write</option></select>');

  select.appendTo('#qunit-fixture');
  select.multiselect({ buttonClass: 'btn btn-default' });

  assert.ok(select.next('.btn-group').length, 'the plugin creates its Bootstrap 5 control');
  select.multiselect('setOptions', { buttonClass: 'btn btn-primary' });
  select.multiselect('rebuild');
  select.multiselect('refresh');
  select.multiselect('disable');
  assert.ok(select.prop('disabled'), 'disable keeps the native select in sync');
  select.multiselect('enable');
  assert.notOk(select.prop('disabled'), 'enable keeps the native select in sync');
  select.multiselect('destroy');
  assert.notOk(select.next('.btn-group').length, 'destroy removes the generated control');
});
