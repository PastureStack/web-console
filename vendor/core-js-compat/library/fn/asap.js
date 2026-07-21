"use strict";

module.exports = function asap(fn) {
  if (typeof queueMicrotask === "function") { queueMicrotask(fn); return; }
  if (typeof Promise === "function") { Promise.resolve().then(fn); return; }
  setTimeout(fn, 0);
};
