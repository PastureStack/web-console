import Ember from 'ember';
import { module, test } from 'qunit';

module('Unit | Vendor | Bootstrap runtime boundary');

test('only the required compatibility plugins are registered', function(assert) {
  let plugins = Ember.$.fn;

  assert.equal(typeof plugins.collapse, 'function', 'responsive navigation keeps collapse support');
  assert.equal(typeof plugins.dropdown, 'function', 'menus keep dropdown support');
  assert.strictEqual(plugins.button, undefined, 'the vulnerable Button plugin is not shipped');
  assert.strictEqual(plugins.tooltip, undefined, 'the vulnerable Tooltip plugin is not shipped');
  assert.strictEqual(plugins.popover, undefined, 'the vulnerable Popover plugin is not shipped');
});
