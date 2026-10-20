'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const BOOTSTRAP = /^vendor\/ember-cli\/(?:app-prefix|app-suffix|app-config|app-boot|vendor-prefix|vendor-suffix)\.js$/;

function assertNoPendingModules(webpackModules, concatenated, pending) {
  const frameworkBootstrapInputs = concatenated.filter(resource => BOOTSTRAP.test(resource.replace(/\\/g, '/')));
  for (const node of pending.nodes) {
    const name = node.path.slice('node_modules/'.length);
    const matcher = new RegExp('(?:^|/)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:/|$)');
    for (const resource of webpackModules) {
      assert.equal(matcher.test(resource.replace(/\\/g, '/')), false, 'pending build dependency reached browser: ' + name);
    }
    for (const resource of concatenated) {
      const normalized = resource.replace(/\\/g, '/');
      // These six exact framework bootstrap wrappers are copied by Ember's
      // default packager, not the CLI/watcher/micromatch execution path.
      if (BOOTSTRAP.test(normalized)) continue;
      assert.equal(matcher.test(normalized), false, 'pending build dependency reached browser: ' + name);
    }
  }
  return frameworkBootstrapInputs.length;
}

module.exports = { assertNoPendingModules };
if (require.main === module) {
const inventoryFile = path.join(root, 'build/security-browser/webpack-modules.json');
const concatDirectory = path.join(root, 'build/security-browser/concat-stats');
const inventory = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
const pending = require('../docs/security/npm-vendor-pending.json');
assert.equal(inventory.schemaVersion, 1);
assert.equal(inventory.lockSha256, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'package-lock.json'))).digest('hex'));
assert.ok(Array.isArray(inventory.modules) && inventory.modules.length > 0);
const files = fs.readdirSync(concatDirectory).filter(file => file.endsWith('.json'));
assert.ok(files.length > 0, 'concat inventory must not be missing');
const concatenated = [];
let vendorSeen = false;
let appSeen = false;
for (const file of files) {
  const stats = JSON.parse(fs.readFileSync(path.join(concatDirectory, file), 'utf8'));
  assert.ok(stats.outputFile && stats.sizes && Object.keys(stats.sizes).length > 0);
  vendorSeen ||= /(?:^|\/)vendor\.js$/.test(stats.outputFile);
  appSeen ||= /(?:^|\/)ui\.js$/.test(stats.outputFile);
  concatenated.push(...Object.keys(stats.sizes));
}
assert.ok(vendorSeen && appSeen, 'both final application and vendor concat inventories are required');
const frameworkBootstrapInputs = assertNoPendingModules(inventory.modules, concatenated, pending);
console.log(JSON.stringify({ outcome: 'PASS_BROWSER_MODULE_BOUNDARY', lockSha256: inventory.lockSha256,
  webpackModules: inventory.modules.length, concatInputs: concatenated.length, frameworkBootstrapInputs, pendingNodesShipped: 0,
  runtimeNotAffectedClaim: false }));
}
