"use strict";

module.exports = typeof globalThis !== "undefined" ? globalThis : (typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : global));
