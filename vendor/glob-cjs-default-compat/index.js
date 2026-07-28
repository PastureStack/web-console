"use strict";

const modernGlob = require("glob-real");
const source = modernGlob && modernGlob.default && typeof modernGlob.default.hasMagic === "function"
  ? modernGlob.default
  : modernGlob;

function api(pattern, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }

  const promise = source.glob(pattern, options);
  if (typeof callback === "function") {
    promise.then(
      (matches) => callback(null, matches),
      (err) => callback(err)
    );
  }

  return promise;
}

for (const key of Reflect.ownKeys(source)) {
  if (key === "__esModule") {
    continue;
  }

  Object.defineProperty(api, key, Object.getOwnPropertyDescriptor(source, key));
}

Object.defineProperty(api, "default", {
  enumerable: false,
  configurable: true,
  value: api,
});

module.exports = api;
