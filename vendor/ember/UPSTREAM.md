# Ember Runtime Provenance

- Distribution: `ember-source@7.2.0`
- Registry tarball: https://registry.npmjs.org/ember-source/-/ember-source-7.2.0.tgz
- Registry integrity: `sha512-pWjYFeM76vAgiFvqrBacAsQh94vTIy8SC1X2S3goULJHJ5/tVWAZ2NtaLFx9oZd3/Lk0gGRdsCMla9rQY58vyw==`
- Tarball SHA-256: `1c5767409626bd7b1e95e151fe8408d84614e2bb2f067f80c01ef6872bf48717`
- Distribution commit: `ccfcde92ce1a82a5d9d605d0117261b8341a9777`
- License: MIT; the upstream `LICENSE` remains in this directory.

The executable Ember runtime, testing support, and template compiler are no
longer copied into the repository. They are resolved from the immutable npm
lockfile during the reviewed build. `ember-global-compat.js` is a first-party,
temporary compatibility bridge for the classic application and is not an
upstream Ember distribution file.

Ember 7.2 is the current compatibility target. The application keeps the
classic bundle boundary until its remaining global Ember imports and prototype
extensions are removed and the ES-module optional feature can pass the complete
browser regression suite.
