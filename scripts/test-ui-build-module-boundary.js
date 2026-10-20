'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assertNoPendingModules } = require('./check-ui-build-module-boundary');
const pending = require('../docs/security/npm-vendor-pending.json');

test('only exact native framework bootstrap wrappers are permitted in concat', () => {
  const wrappers = ['app-prefix', 'app-suffix', 'app-config', 'app-boot', 'vendor-prefix', 'vendor-suffix']
    .map(name => 'vendor/ember-cli/' + name + '.js');
  assert.equal(assertNoPendingModules(['node_modules/ember-source/dist/ember.js'], wrappers, pending), 6);
  for (const file of ['vendor/ember-cli/index.js', 'vendor/ember-cli/vendor-prefix.js/extra',
    'vendor/ember-cli/lib/broccoli/ember-app.js', 'node_modules/ember-cli/vendor-prefix.js']) {
    assert.throws(() => assertNoPendingModules([], [file], pending), /pending build dependency/);
  }
  assert.throws(() => assertNoPendingModules(wrappers, [], pending), /pending build dependency/);
});

test('all pending dependency nodes are denied in both webpack and renamed concat input trees', () => {
  for (const node of pending.nodes) {
    const name = node.path.slice('node_modules/'.length);
    assert.throws(() => assertNoPendingModules([node.path + '/index.js'], [], pending), /pending build dependency/);
    assert.throws(() => assertNoPendingModules([], ['vendor/' + name + '/index.js'], pending), /pending build dependency/);
  }
});
