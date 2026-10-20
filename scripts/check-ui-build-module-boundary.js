'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const [inventoryFile, concatDirectory] = process.argv.slice(2);
assert.ok(inventoryFile && concatDirectory, 'webpack inventory and concat stats are required');
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
for (const node of pending.nodes) {
  const name = node.path.slice('node_modules/'.length);
  const matcher = new RegExp('(?:^|/)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:/|$)');
  for (const resource of [...inventory.modules, ...concatenated]) {
    assert.equal(matcher.test(resource.replace(/\\/g, '/')), false, 'pending build dependency reached browser: ' + name);
  }
}
console.log(JSON.stringify({ outcome: 'PASS_BROWSER_MODULE_BOUNDARY', lockSha256: inventory.lockSha256,
  webpackModules: inventory.modules.length, concatInputs: concatenated.length, pendingNodesShipped: 0,
  runtimeNotAffectedClaim: false }));
