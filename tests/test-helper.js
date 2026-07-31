import TestLoader from 'ember-cli-test-loader/test-support/index';
import QUnit from 'qunit';

// Direct QUnit tests import the modules they exercise explicitly.
// The old ember-qunit start path used to trigger ember-cli-test-loader.
QUnit.config.autostart = false;

let failedTests = [];
QUnit.on('testEnd', (data) => {
  if ( data.status === 'failed' ) {
    failedTests.push({
      fullName: data.fullName,
      errors: data.errors.map((error) => ({
        message: error.message,
        stack: error.stack,
      })),
    });
  }
});
QUnit.on('runEnd', (data) => {
  let result = document.createElement('pre');
  result.id = 'pasturestack-qunit-result';
  result.textContent = JSON.stringify({
    counts: data.testCounts,
    failedTests,
    runtime: data.runtime,
    status: data.status,
  });
  document.body.appendChild(result);
});

TestLoader.load();
QUnit.start();
