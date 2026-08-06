# lodash.template Compatibility Wrapper

This package is a PastureStack build-chain compatibility wrapper named
`lodash.template`.

It depends on upstream `lodash@4.18.1` through the npm alias `lodash-real` and
exports `lodash-real/template`. This keeps legacy CommonJS callers such as
Broccoli Templater and Sourcemap Validator on the same function
export shape while avoiding the deprecated standalone `lodash.template` package.

License: MIT, matching upstream Lodash.
