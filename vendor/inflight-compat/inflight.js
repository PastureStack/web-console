'use strict';

const requests = Object.create(null);

module.exports = function inflight(key, callback) {
  if (requests[key]) {
    requests[key].push(callback);
    return null;
  }

  requests[key] = [callback];
  return makeResolver(key);
};

function makeResolver(key) {
  let called = false;

  function resolveInflight() {
    if (called) {
      return;
    }

    called = true;
    const callbacks = requests[key];
    if (!callbacks) {
      return;
    }

    const length = callbacks.length;
    const args = Array.prototype.slice.call(arguments);

    try {
      for (let index = 0; index < length; index += 1) {
        callbacks[index].apply(null, args);
      }
    } finally {
      if (callbacks.length > length) {
        callbacks.splice(0, length);
        called = false;
        process.nextTick(function runRemainingCallbacks() {
          resolveInflight.apply(null, args);
        });
      } else {
        delete requests[key];
      }
    }
  }

  return resolveInflight;
}
