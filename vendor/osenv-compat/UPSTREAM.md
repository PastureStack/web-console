# osenv Compatibility Wrapper

This directory is an rc16 compatibility wrapper for old Ember CLI build-chain
packages that still depend on deprecated `osenv@0.1.x`.

- Upstream package: `osenv`
- Upstream version replaced: `0.1.5`
- Upstream license: ISC
- Upstream repository: `https://github.com/npm/osenv`

The original package exported memoized environment helpers such as `home`,
`tmpdir`, `path`, `editor`, and `shell`. This wrapper keeps those CommonJS
function names while using maintained Node `os` and `process.env` APIs.
