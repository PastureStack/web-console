'use strict';

const fs = require('fs');
const path = require('path');
const BroccoliPlugin = require('broccoli-plugin');
const Plugin = BroccoliPlugin.default || BroccoliPlugin;
const YAML = require('yamljs');

class TranslationJsonTree extends Plugin {
  constructor(inputNode) {
    super([inputNode], {
      annotation: 'PastureStack translation JSON',
    });
  }

  build() {
    const inputPath = this.inputPaths[0];
    const outputPath = path.join(this.outputPath, 'translations');

    fs.mkdirSync(outputPath, { recursive: true });
    fs.readdirSync(inputPath)
      .filter((name) => name.endsWith('.yaml'))
      .sort()
      .forEach((name) => {
        const source = fs.readFileSync(path.join(inputPath, name), 'utf8');
        const translations = YAML.parse(source);
        const outputName = `${path.basename(name, '.yaml')}.json`;

        fs.writeFileSync(
          path.join(outputPath, outputName),
          `${JSON.stringify(translations)}\n`,
          'utf8'
        );
      });
  }
}

module.exports = TranslationJsonTree;
