# sort-package-json Compatibility Wrapper

This directory is an rc16 compatibility wrapper for Rancher UI's legacy
Ember CLI 2.18 addon blueprint path.

- Upstream package: `sort-package-json`
- Upstream version wrapped: `3.6.1`
- Upstream license: MIT
- Upstream repository: `https://github.com/keithamus/sort-package-json`

Rancher UI's pinned Ember CLI 2.18 source calls
`require('sort-package-json')` and expects a function. Node 24 can load
`sort-package-json` 3.x, but CommonJS `require()` returns an ESM namespace.
