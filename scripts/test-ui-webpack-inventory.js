'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {collectInventory} = require('../lib/security-module-inventory-webpack-plugin');

function fixture() {
  const main = {resource: '/source/node_modules/runtime/index.js?loader'},
    child = {resource: 'C:\\source\\node_modules\\nested\\index.js'},
    testing = {resource: '/source/node_modules/test-only/index.js'},
    orphan = {resource: '/source/node_modules/unreachable/index.js'};
  main.modules = [child];
  const chunks = [{files: new Set(['assets/chunk.main.js']), selected: [main]},
    {files: new Set(['assets/chunk.test.js']), selected: [testing]}];
  const bytes = {'assets/chunk.main.js': Buffer.from('retained production'), 'assets/chunk.test.js': 'removed tests'};
  const compilation = {modules: [main, testing, orphan], chunks,
    chunkGraph: {getChunkModulesIterable: chunk => chunk.selected},
    getAsset: file => ({source: {source: () => bytes[file]}})};
  return {compilation, bytes};
}

test('per-asset modules exclude other chunks and orphans without weakening all-module security inventory', () => {
  const {compilation, bytes} = fixture(), inventory = collectInventory(compilation);
  assert.deepEqual(inventory.assetModules['assets/chunk.main.js'], ['node_modules/nested/index.js', 'node_modules/runtime/index.js']);
  assert.deepEqual(inventory.assetModules['assets/chunk.test.js'], ['node_modules/test-only/index.js']);
  assert.ok(inventory.modules.includes('node_modules/unreachable/index.js'));
  for (const [file, content] of Object.entries(bytes)) {
    assert.equal(inventory.assetSHA256[file], crypto.createHash('sha256').update(content).digest('hex'));
  }
});

test('asset inventory is independent of iteration order and does not mutate emitted bytes', () => {
  const {compilation, bytes} = fixture(), before = Object.fromEntries(Object.entries(bytes).map(([file, content]) => [file, Buffer.from(content)])), first = collectInventory(compilation);
  compilation.modules.reverse(); compilation.chunks.reverse();
  assert.deepEqual(collectInventory(compilation), first);
  for (const [file, content] of Object.entries(bytes)) assert.deepEqual(Buffer.from(content), before[file]);
});

test('empty, unsafe or missing emitted assets fail closed', () => {
  const {compilation} = fixture();
  assert.throws(() => collectInventory({...compilation, chunks: []}), /empty/);
  assert.throws(() => collectInventory({...compilation, getAsset: () => null}), /missing/);
  compilation.chunks[0].files = ['../outside.js'];
  assert.throws(() => collectInventory(compilation), /unsafe/);
});
