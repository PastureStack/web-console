// Load the compiled test modules directly from Ember's AMD registry. This is
// the only behavior the retired ember-cli-test-loader addon provided here.
Object.keys(window.requirejs.entries)
  .filter((name) => /(?:^|\/)(?:test|tests)\/.+-test$/.test(name))
  .sort()
  .forEach((name) => window.require(name));
