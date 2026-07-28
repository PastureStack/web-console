# exists-sync Compatibility Wrapper

This directory is an rc16 compatibility wrapper for old Ember CLI and
Broccoli packages that still depend on deprecated `exists-sync@0.0.x`.

- Upstream package: `exists-sync`
- Upstream versions replaced: `0.0.3` and `0.0.4`
- Upstream license: ISC
- Upstream repository: `https://github.com/ember-cli/exists-sync`

The original package exported a synchronous existence-check function. This
wrapper preserves that CommonJS function contract using Node's maintained
`fs.existsSync`.
