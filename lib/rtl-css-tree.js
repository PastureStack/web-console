'use strict';

const fs = require('fs');
const path = require('path');
const BroccoliPlugin = require('broccoli-plugin');
const Plugin = BroccoliPlugin.default || BroccoliPlugin;
const rtlcss = require('rtlcss');

function visitCss(root, relative = '') {
  const directory = path.join(root, relative);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    const entryType = entry.isSymbolicLink()
      ? fs.statSync(path.join(directory, entry.name))
      : entry;
    if (entryType.isDirectory()) {
      return visitCss(root, child);
    }
    return entryType.isFile() && entry.name.endsWith('.css') && !entry.name.endsWith('.rtl.css')
      ? [child]
      : [];
  });
}

module.exports = class RtlCssTree extends Plugin {
  constructor(inputNode) {
    super([inputNode], { annotation: 'PastureStack RTL CSS' });
  }

  build() {
    const cssFiles = visitCss(this.inputPaths[0]);
    if (cssFiles.length === 0) {
      throw new Error('PastureStack RTL CSS build received no compiled CSS input');
    }

    for (const relative of cssFiles) {
      const source = fs.readFileSync(path.join(this.inputPaths[0], relative), 'utf8');
      const destination = path.join(this.outputPath, relative.replace(/\.css$/, '.rtl.css'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, rtlcss.process(source), 'utf8');
    }
  }
};
