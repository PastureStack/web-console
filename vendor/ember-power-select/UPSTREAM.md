# ember-power-select style vendor source

This directory vendors only the Sass style files from the npm `ember-power-select` package for the PastureStack Web Console compatibility build.

- Upstream package: `ember-power-select`
- Upstream version: `1.0.0-beta.19`
- Upstream tarball: `https://registry.npmjs.org/ember-power-select/-/ember-power-select-1.0.0-beta.19.tgz`
- npm integrity: `sha512-ZRJH+o6t0ewEixztGKY0WyfS0cVogBqTV+H1NAXyuz9hY2fxQTMoDNTu9kHrs9YkG3ercE6kNTyzPnAtQxzmJw==`
- License: MIT, retained in `LICENSE.md`

Only the Sass import source is vendored here. Its upstream
`ember-basic-dropdown@0.16.0-beta.4` Sass dependency is retained separately in
`vendor/ember-basic-dropdown` with its own provenance and MIT license. The
Ember addon JavaScript remains resolved through the existing application
compatibility boundary until the component/runtime migration is handled
separately.
