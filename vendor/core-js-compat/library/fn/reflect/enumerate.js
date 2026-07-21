"use strict";

module.exports = Reflect.enumerate || function enumerate(target) { return Object.keys(target)[Symbol.iterator](); };
