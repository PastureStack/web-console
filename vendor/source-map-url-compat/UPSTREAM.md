# source-map-url Compatibility Wrapper

This directory is an rc16 compatibility wrapper for old Ember CLI build-chain
packages that still depend on deprecated `source-map-url@0.3.x`.

- Upstream package: `source-map-url`
- Upstream version replaced: `0.3.0`
- Upstream license: MIT
- Upstream repository: `https://github.com/lydell/source-map-url`

The original package exported sourcemap comment helpers:
`regex`, `_innerRegex`, `getFrom`, `existsIn`, `removeFrom`, and
`insertBefore`. This wrapper preserves those CommonJS APIs for
`fast-sourcemap-concat` while carrying an rc16-maintained version.
