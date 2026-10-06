# Vendored shell-quote Browser Bundle

- Source package: `shell-quote@1.11.0` from the reviewed Node 24 lock baseline.
- Official package integrity: `sha512-JdxDPD0DBTyu08pq0kPC0xSNet/qsU07qT6IsX1AS8oO2ICNRY4ldNa8OAI6PuwAH8tG3lxEhbqmyp4Dw4036g==`.
- Source files: `index.js`, `parse.js`, and `quote.js` bundled with browserify standalone name `rc16ShellQuote`.
- License: MIT.

This preserves the existing PastureStack Web Console shell parse/quote behavior while removing `ember-browserify` and `npm:shell-quote` from the application build path.

Version 1.11.0 includes the official fix for
[GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv): strings
after a comment token cannot contain line terminators. The existing standalone
wrapper is retained; its three module bodies match the integrity-verified
official package. The MIT license text is unchanged.
