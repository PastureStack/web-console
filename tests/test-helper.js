import TestLoader from 'ember-cli-test-loader/test-support/index';

// Direct QUnit tests import the modules they exercise explicitly.
// The old ember-qunit start path used to trigger ember-cli-test-loader.
TestLoader.load();
