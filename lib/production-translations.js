'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

function sortTranslation(value) {
  if (Array.isArray(value)) {
    return value.map(sortTranslation);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = sortTranslation(value[key]);
      return out;
    }, {});
  }

  return value;
}

function serializeTranslation(value) {
  return JSON.stringify(sortTranslation(value));
}

function translationDefinitions(repoRoot, environment = 'production') {
  const translationsDir = path.join(repoRoot, 'translations');
  const locales = new Set();

  return fs.readdirSync(translationsDir)
    .filter((filename) => /\.ya?ml$/.test(filename))
    .sort()
    .filter((filename) => environment !== 'production' || filename !== 'none.yaml')
    .map((filename) => {
      const locale = filename.replace(/\.ya?ml$/, '');

      if (!/^[a-z0-9-]+$/.test(locale)) {
        throw new Error(`Invalid translation locale filename: ${filename}`);
      }

      if (locales.has(locale)) {
        throw new Error(`Duplicate translation locale: ${locale}`);
      }
      locales.add(locale);

      const sourcePath = path.join(translationsDir, filename);
      const translation = YAML.load(sourcePath);

      if (!translation || typeof translation !== 'object' || Array.isArray(translation)) {
        throw new Error(`Translation root must be an object: ${filename}`);
      }

      return {
        locale,
        sourcePath,
        outputPath: `translations/${locale}.json`,
        content: serializeTranslation(translation),
      };
    });
}

function buildTranslationTrees(repoRoot, environment) {
  const createFile = require('broccoli-file-creator');

  return translationDefinitions(repoRoot, environment).map((definition) => {
    return createFile(definition.outputPath, definition.content, {
      annotation: `PastureStack translation ${definition.locale}`,
      encoding: 'utf8',
    });
  });
}

module.exports = {
  buildTranslationTrees,
  serializeTranslation,
  sortTranslation,
  translationDefinitions,
};
