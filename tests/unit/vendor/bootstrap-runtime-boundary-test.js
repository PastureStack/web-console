import $ from 'jquery';
import { module, test } from 'qunit';

module('Unit | Vendor | Bootstrap runtime boundary');

test('the maintained Bootstrap runtime is registered', function(assert) {
  let plugins = $.fn;

  ['button', 'collapse', 'dropdown', 'tooltip', 'popover'].forEach((name) => {
    assert.equal(typeof plugins[name], 'function', `${name} is registered by Bootstrap 5`);
    assert.equal(plugins[name].Constructor.VERSION, '5.3.8', `${name} comes from Bootstrap 5.3.8`);
  });
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
