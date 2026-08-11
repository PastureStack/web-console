#!/usr/bin/env node
"use strict";

const rimraf = require("./index");
const targets = process.argv.slice(2).filter((arg) => arg && !arg.startsWith("-"));

Promise.all(targets.map((target) => rimraf(target))).catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
