'use strict';

// Webpack's REPORT stage precedes Ember's production post-processing. Retain
// those original hashes and bind the same asset/module identities to final
// Ember bytes. Only the inventory sidecar is written; dist stays untouched.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const STAGE = 'ember-production-post-processing-before-packaging';

function plain(value) { return value && typeof value === 'object' && !Array.isArray(value); }

function checkedFile(root, name) {
  assert.equal(typeof name, 'string', 'unsafe inventory asset name');
  const parts = name.split('/');
  assert.ok(name && !/[\\:\x00-\x1f\x7f?#]/.test(name) &&
    parts.every(part => part && part !== '.' && part !== '..'), 'unsafe inventory asset name');
  let current = root;
  assert.ok(!fs.lstatSync(current).isSymbolicLink(), 'inventory root must not be a link');
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    const item = fs.lstatSync(current);
    assert.ok(!item.isSymbolicLink(), 'inventory source path must not contain links');
    assert.ok(index === parts.length - 1 ? item.isFile() : item.isDirectory(), 'inventory source must be a regular file');
  }
  return current;
}

function finalize(root = path.resolve(__dirname, '..')) {
  root = path.resolve(root);
  const inventoryFile = checkedFile(root, 'build/security-browser/webpack-modules.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
  assert.equal(inventory.schemaVersion, 1, 'unsupported webpack inventory');
  assert.equal(inventory.lockSha256, hash(fs.readFileSync(checkedFile(root, 'package-lock.json'))), 'webpack inventory lock drift');
  assert.ok(Array.isArray(inventory.modules) && inventory.modules.length, 'webpack module inventory is empty');
  assert.ok(plain(inventory.assetModules) && Object.keys(inventory.assetModules).length, 'webpack per-asset inventory is missing');
  assert.ok(plain(inventory.assetSHA256), 'webpack per-asset hashes are missing');
  const names = Object.keys(inventory.assetModules).sort();
  assert.deepEqual(Object.keys(inventory.assetSHA256).sort(), names, 'webpack asset/hash identities differ');
  const originalHashes = inventory.webpackAssetSHA256 || inventory.assetSHA256;
  assert.ok(plain(originalHashes), 'original webpack asset hashes are missing');
  assert.deepEqual(Object.keys(originalHashes).sort(), names, 'original webpack asset/hash identities differ');
  if (inventory.finalProductionStage !== undefined) {
    assert.equal(inventory.finalProductionStage, STAGE, 'unknown final production stage');
    assert.ok(inventory.webpackAssetSHA256, 'finalized inventory lost its original webpack hashes');
  } else assert.equal(inventory.webpackAssetSHA256, undefined, 'original hashes require an explicit final production stage');

  const finalHashes = {};
  for (const name of names) {
    assert.ok(Array.isArray(inventory.assetModules[name]), 'invalid webpack per-asset module list');
    assert.match(originalHashes[name], /^[a-f0-9]{64}$/i, 'invalid original webpack asset SHA-256');
    // These are the only supported identities. No search, basename fallback,
    // fingerprint inference, or missing-file exemption is used at this stage.
    const target = name.startsWith('assets/') ? name : 'assets/' + name;
    finalHashes[name] = hash(fs.readFileSync(checkedFile(root, 'dist/' + target)));
  }
  const finalized = { ...inventory, webpackAssetSHA256: { ...originalHashes },
    assetSHA256: finalHashes, finalProductionStage: STAGE };
  fs.writeFileSync(inventoryFile, JSON.stringify(finalized, null, 2) + '\n');
  return finalized;
}

module.exports = { finalize, STAGE };
if (require.main === module) {
  try {
    assert.equal(process.argv.length, 2, 'finalizer uses only the fixed repository inventory and dist paths');
    const inventory = finalize();
    console.log(JSON.stringify({ outcome: 'PASS_UI_WEBPACK_FINAL_BYTES', assets: Object.keys(inventory.assetSHA256).length,
      finalProductionStage: inventory.finalProductionStage, lockSha256: inventory.lockSha256 }));
  } catch (error) { console.error('UI_WEBPACK_FINALIZE_FAILED: ' + error.message); process.exitCode = 1; }
}
