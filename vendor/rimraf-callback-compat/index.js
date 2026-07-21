"use strict";

const real = require("rimraf-real");
const realAsync = real.rimraf || real.default || real;
const realSync = real.rimrafSync || real.sync;

function rimraf(path, options, callback) {
  let opts = options;
  let cb = callback;
  if (typeof opts === "function") {
    cb = opts;
    opts = undefined;
  }

  const promise = Promise.resolve(realAsync(path, opts));
  if (typeof cb === "function") {
    promise.then(() => cb(null), cb);
    return undefined;
  }

  return promise;
}

rimraf.sync = function rimrafSync(path, options) {
  return realSync(path, options);
};
rimraf.rimraf = rimraf;
rimraf.rimrafSync = rimraf.sync;

for (const key of Reflect.ownKeys(real)) {
  if (key === "__esModule" || key in rimraf) {
    continue;
  }

  Object.defineProperty(rimraf, key, Object.getOwnPropertyDescriptor(real, key));
}

Object.defineProperty(rimraf, "default", {
  enumerable: false,
  configurable: true,
  value: rimraf,
});

module.exports = rimraf;
