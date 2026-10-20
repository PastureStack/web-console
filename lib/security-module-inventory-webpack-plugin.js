'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Opt-in build evidence, outside dist. Never alters modules or runtime code.
class SecurityModuleInventoryWebpackPlugin {
  apply(compiler) {
    compiler.hooks.done.tap('SecurityModuleInventory', stats => {
      if (stats.hasErrors()) return;
      const modules = new Set();
      function visit(module) {
        if (module.resource) {
          const file = module.resource.split('?')[0].replace(/\\/g, '/');
          const index = file.indexOf('/node_modules/');
          modules.add(index >= 0 ? file.slice(index + 1) : '<generated-or-owned>');
        }
        for (const child of module.modules || []) visit(child);
      }
      for (const module of stats.compilation.modules) visit(module);
      const directory = path.join(__dirname, '../build/security-browser');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'webpack-modules.json'), JSON.stringify({
        schemaVersion: 1,
        lockSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../package-lock.json'))).digest('hex'),
        modules: [...modules].sort()
      }, null, 2) + '\n');
    });
  }
}
module.exports = SecurityModuleInventoryWebpackPlugin;
