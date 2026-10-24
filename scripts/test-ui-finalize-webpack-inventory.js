'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { finalize, STAGE } = require('./finalize-ui-webpack-inventory');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-final-webpack-'));
  const file = path.join(root, 'build/security-browser/webpack-modules.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(path.join(root, 'dist/assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
  const inventory = { schemaVersion: 1, lockSha256: hash(fs.readFileSync(path.join(root, 'package-lock.json'))),
    modules: ['node_modules/runtime/index.js'],
    assetModules: { 'chunk.524.abc.js': ['node_modules/runtime/index.js'], 'assets/chunk.other.js': ['node_modules/other/index.js'] },
    assetSHA256: { 'chunk.524.abc.js': hash('webpack unminified bytes'), 'assets/chunk.other.js': hash('webpack other bytes') } };
  const write = () => fs.writeFileSync(file, JSON.stringify(inventory, null, 2) + '\n');
  write();
  fs.writeFileSync(path.join(root, 'dist/assets/chunk.524.abc.js'), 'final Ember minified bytes');
  fs.writeFileSync(path.join(root, 'dist/assets/chunk.other.js'), 'other final bytes');
  try { run({ root, file, inventory, write }); }
  finally {
    assert.ok(path.dirname(root) === os.tmpdir() && path.basename(root).startsWith('ui-final-webpack-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('Ember final bytes retain the original Webpack hashes and module identities', () => fixture(({ root, inventory }) => {
  const original = structuredClone(inventory), output = finalize(root);
  assert.deepEqual(output.webpackAssetSHA256, original.assetSHA256);
  assert.equal(output.assetSHA256['chunk.524.abc.js'], hash('final Ember minified bytes'));
  assert.equal(output.assetSHA256['assets/chunk.other.js'], hash('other final bytes'));
  assert.notEqual(output.assetSHA256['chunk.524.abc.js'], output.webpackAssetSHA256['chunk.524.abc.js']);
  assert.equal(output.finalProductionStage, STAGE);
  for (const key of ['schemaVersion', 'lockSha256', 'modules', 'assetModules']) assert.deepEqual(output[key], original[key]);
}));

test('finalization changes only the inventory and repeated output is deterministic', () => fixture(({ root, file }) => {
  const assets = fs.readdirSync(path.join(root, 'dist/assets')).map(name => path.join(root, 'dist/assets', name));
  const before = assets.map(name => fs.readFileSync(name)), lock = fs.readFileSync(path.join(root, 'package-lock.json'));
  finalize(root);
  const first = fs.readFileSync(file);
  finalize(root);
  assert.deepEqual(fs.readFileSync(file), first);
  for (let i = 0; i < assets.length; i++) assert.deepEqual(fs.readFileSync(assets[i]), before[i]);
  assert.deepEqual(fs.readFileSync(path.join(root, 'package-lock.json')), lock);
}));

test('missing final file, unknown identity and lock drift fail without rewriting inventory', () => fixture(({ root, file, inventory, write }) => {
  const check = pattern => { write(); const before = fs.readFileSync(file); assert.throws(() => finalize(root), pattern); assert.deepEqual(fs.readFileSync(file), before); };
  inventory.assetModules['missing.js'] = [];
  inventory.assetSHA256['missing.js'] = hash('missing');
  check(/ENOENT/);
  delete inventory.assetModules['missing.js']; delete inventory.assetSHA256['missing.js'];
  inventory.assetModules['unknown/chunk.524.abc.js'] = inventory.assetModules['chunk.524.abc.js'];
  inventory.assetSHA256['unknown/chunk.524.abc.js'] = inventory.assetSHA256['chunk.524.abc.js'];
  delete inventory.assetModules['chunk.524.abc.js']; delete inventory.assetSHA256['chunk.524.abc.js'];
  check(/ENOENT/);
  inventory.lockSha256 = '0'.repeat(64);
  check(/lock drift/);
}));

test('unsafe names, traversal and source links fail closed', () => fixture(({ root, file, inventory, write }) => {
  for (const name of ['../outside.js', '/outside.js', 'C:/private.js', 'assets/../outside.js', 'assets\\outside.js', 'assets//chunk.js', './chunk.js']) {
    inventory.assetModules = { [name]: [] }; inventory.assetSHA256 = { [name]: hash('unsafe') }; write();
    const before = fs.readFileSync(file);
    assert.throws(() => finalize(root), /unsafe/);
    assert.deepEqual(fs.readFileSync(file), before);
  }
  inventory.assetModules = { 'linked/chunk.js': [] }; inventory.assetSHA256 = { 'linked/chunk.js': hash('link') }; write();
  const outside = path.join(root, 'outside'); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'chunk.js'), 'outside');
  const link = path.join(root, 'dist/assets/linked');
  fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => finalize(root), /links/);
}));
