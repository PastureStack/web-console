'use strict';

const fs = require('fs');

module.exports = function existsSync(path) {
  return fs.existsSync(path);
};
