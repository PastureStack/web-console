#!/usr/bin/env node
'use strict';

const fs = require('fs');

const componentPath = 'vendor/lacsso/addon/components/sortable-table.js';
const testPath = 'tests/unit/components/sortable-table-test.js';
const hostRoutePath = 'app/host/containers/route.js';
const hostRouteTestPath = 'tests/unit/host/containers/route-test.js';
const ciPath = 'scripts/ci';
const component = fs.readFileSync(componentPath, 'utf8');
const test = fs.readFileSync(testPath, 'utf8');
const hostRoute = fs.readFileSync(hostRoutePath, 'utf8');
const hostRouteTest = fs.readFileSync(hostRouteTestPath, 'utf8');
const ci = fs.readFileSync(ciPath, 'utf8');
const failures = [];

for (const marker of [
  "'body.[]'",
  'Ember.run.throttle(this, this._updateFiltered, 100, false)',
  'Ember.run.debounce(this, this._updateFiltered, 100, false)',
]) {
  if (!component.includes(marker)) {
    failures.push('SORTABLE_TABLE_REFRESH_CONTRACT_MISSING=' + marker);
  }
}

for (const marker of [
  "findAll('instance', {",
  "filter: {hostId: host.get('id')}",
  ".then(() => host)",
]) {
  if (!hostRoute.includes(marker)) {
    failures.push('HOST_CONTAINER_PRELOAD_CONTRACT_MISSING=' + marker);
  }
}

for (const marker of [
  'loads only the selected host instances before rendering',
  "assert.equal(type, 'instance')",
  "{filter: {hostId: '1h1'}}",
  'assert.strictEqual(result, host',
]) {
  if (!hostRouteTest.includes(marker)) {
    failures.push('HOST_CONTAINER_PRELOAD_TEST_MISSING=' + marker);
  }
}

for (const forbidden of [
  "Ember.run.throttle(this, '_updateFiltered'",
  "Ember.run.debounce(this, '_updateFiltered'",
]) {
  if (component.includes(forbidden)) {
    failures.push('SORTABLE_TABLE_LEGACY_RUNLOOP_CALL=' + forbidden);
  }
}

for (const marker of [
  'relationship is populated after initialization',
  "body.pushObjects([",
  "component.set('searchText', 'beta')",
  "component.set('searchText', '')",
]) {
  if (!test.includes(marker)) {
    failures.push('SORTABLE_TABLE_REFRESH_TEST_MISSING=' + marker);
  }
}

if (!ci.includes('node ./scripts/check-ui-sortable-table-refresh.js')) {
  failures.push('SORTABLE_TABLE_REFRESH_CI_GATE_MISSING');
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error('failure_count=' + failures.length);
  process.exit(1);
}

console.log('UI_SORTABLE_TABLE_REFRESH_OK late_body=true host_preload=filtered search=true runloop=function-reference');
console.log('failure_count=0');
