# glob CJS Default Compatibility Wrapper

This package is a Rancher 1.6 UI build-chain compatibility wrapper named `glob`.

It depends on upstream `glob@13.0.6` through the npm alias `glob-real` and re-exports
the same API without the upstream `__esModule` marker. Legacy Babel-transpiled
callers such as `babel-plugin-module-resolver@5.0.3` use
`_interopRequireDefault(require("glob"))` and then read `_glob.default.hasMagic`.
With upstream `glob@13` directly, that path sees `default === undefined`; this
wrapper preserves the old CommonJS default behavior while keeping the modern
glob implementation underneath.

The wrapper is also callable as `glob(pattern, options, callback)` and bridges
the modern Promise result into the legacy callback form used by Ember CLI 2.x.

License: ISC, matching upstream `glob`.
