'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function visit(module, modules) {
  if (module.resource) {
    const file = module.resource.split('?')[0].replace(/\\/g, '/');
    const index = file.indexOf('/node_modules/');
    modules.add(index >= 0 ? file.slice(index + 1) : '<generated-or-owned>');
  }
  for (const child of module.modules || []) visit(child, modules);
}

function collectInventory(compilation) {
  const modules = new Set(), byAsset = new Map(), assetSHA256 = {};
  for (const module of compilation.modules) visit(module, modules);
  for (const chunk of compilation.chunks) {
    const selected = new Set();
    for (const module of compilation.chunkGraph.getChunkModulesIterable(chunk)) visit(module, selected);
    for (const file of chunk.files) {
      assert.ok(!file.startsWith('/') && !file.split('/').includes('..'), 'unsafe emitted asset name');
      const asset = compilation.getAsset(file);
      assert.ok(asset && asset.source, 'emitted chunk asset source is missing');
      const content = asset.source.source();
      assetSHA256[file] = crypto.createHash('sha256').update(content).digest('hex');
      if (!byAsset.has(file)) byAsset.set(file, new Set());
      for (const resource of selected) byAsset.get(file).add(resource);
    }
  }
  assert.ok(byAsset.size > 0, 'emitted chunk inventory is empty');
  return {
    modules: [...modules].sort(),
    assetModules: Object.fromEntries([...byAsset].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([file, values]) => [file, [...values].sort()])),
    assetSHA256: Object.fromEntries(Object.entries(assetSHA256).sort(([a], [b]) => a.localeCompare(b, 'en')))
  };
}

// Opt-in build evidence, outside dist. Never alters modules or runtime code.
class SecurityModuleInventoryWebpackPlugin {
  apply(compiler) {
    const captured = new WeakMap();
    // Capture final optimized bytes while sources are still available. At the
    // done hook Webpack may replace emitted sources with SizeOnlySource.
    compiler.hooks.thisCompilation.tap('SecurityModuleInventory', compilation => {
      compilation.hooks.processAssets.tap({
        name: 'SecurityModuleInventory',
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT
      }, () => captured.set(compilation, collectInventory(compilation)));
    });
    compiler.hooks.done.tap('SecurityModuleInventory', stats => {
      if (stats.hasErrors()) return;
      const inventory = captured.get(stats.compilation);
      assert.ok(inventory, 'optimized asset inventory was not captured');
      const directory = path.join(__dirname, '../build/security-browser');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'webpack-modules.json'), JSON.stringify({
        schemaVersion: 1,
        lockSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../package-lock.json'))).digest('hex'),
        ...inventory
      }, null, 2) + '\n');
    });
  }
}
module.exports = SecurityModuleInventoryWebpackPlugin;
module.exports.collectInventory = collectInventory;
