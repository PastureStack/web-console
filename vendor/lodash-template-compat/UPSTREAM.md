# lodash.template Compatibility Wrapper

This package is a Rancher 1.6 UI build-chain compatibility wrapper named
`lodash.template`.

It depends on upstream `lodash@4.17.21` through the npm alias `lodash-real` and
exports `lodash-real/template`. This keeps legacy CommonJS callers such as
Ember CLI 2.x, Broccoli Templater, and Sourcemap Validator on the same function
export shape while avoiding the deprecated standalone `lodash.template` package.

License: MIT, matching upstream Lodash.
