# glob CJS Default Compatibility Wrapper

This package is a Rancher 1.6 UI build-chain compatibility wrapper named `glob`.

The archive revision `glob-13.0.6-pasturestack.2.tgz` preserves the upstream API
version `13.0.6`, records `pasturestackCompatibilityRevision`, depends on upstream
`glob@13.0.6` through the npm
alias `glob-real`, uses its official `glob-real/raw` export, and re-exports
the same API without the upstream `__esModule` marker. Legacy Babel-transpiled
callers such as `babel-plugin-module-resolver@5.0.3` use
`_interopRequireDefault(require("glob"))` and then read `_glob.default.hasMagic`.
With upstream `glob@13` directly, that path sees `default === undefined`; this
wrapper preserves the old CommonJS default behavior while keeping the modern
glob implementation underneath.

The raw export uses the separately resolved minimatch dependency. The upstream
default bundle embeds an older matcher and bypasses a dependency override;
this wrapper deliberately does not load it. The upstream glob archive itself
is unchanged and its unused embedded copy is not claimed to be patched.

The wrapper is also callable as `glob(pattern, options, callback)` and bridges
the modern Promise result into the legacy callback form used by Ember CLI 2.x.

License: ISC, matching upstream `glob`.
