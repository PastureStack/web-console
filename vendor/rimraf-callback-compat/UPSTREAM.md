# rimraf Callback Compatibility Wrapper

This package is a Rancher 1.6 UI build-chain compatibility wrapper named
`rimraf`.

It depends on upstream `rimraf@6.1.3` through the npm alias `rimraf-real` and
adapts the old `rimraf(path, callback)` and `rimraf.sync(path)` CommonJS API
used by legacy Broccoli and Ember build packages. Promise and modern named
exports remain available for newer callers.

License: ISC, matching upstream `rimraf`.
