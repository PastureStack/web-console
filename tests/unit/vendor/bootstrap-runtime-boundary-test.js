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
