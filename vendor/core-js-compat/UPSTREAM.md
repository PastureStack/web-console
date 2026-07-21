# core-js compatibility package

This package keeps the legacy `core-js@2` package name and Babel 6 `core-js/library/fn/*` require paths while routing maintained implementations through `core-js-pure@3.49.0`.

It exists for the Rancher 1.6 UI no-publish Node 24 build graph, where `babel-runtime@6` and `babel-register@6` still require legacy Core-JS 2 paths. Directly upgrading that whole build chain to Babel 7 remains a larger Ember 2.18 compatibility migration.

The facade is intentionally narrow: it covers the Babel 6 runtime paths detected from `babel-runtime@6.26.0`, plus root `core-js` and `core-js/library` entries used by the old helpers.
