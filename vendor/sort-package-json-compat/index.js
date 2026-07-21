'use strict';

const upstream = require('sort-package-json-upstream');
const sortPackageJson = upstream.sortPackageJson || upstream.default || upstream;

if (typeof sortPackageJson !== 'function') {
  throw new TypeError('sort-package-json-upstream did not expose a sorting function');
}

function sortPackageJsonCompat(packageJson, ...args) {
  return sortPackageJson(packageJson, ...args);
}

sortPackageJsonCompat.default = sortPackageJson;
sortPackageJsonCompat.sortPackageJson = sortPackageJson;
sortPackageJsonCompat.sortOrder = upstream.sortOrder;

module.exports = sortPackageJsonCompat;
