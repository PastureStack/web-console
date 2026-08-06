# Ember Runtime Provenance

- Distribution: `ember-source@6.12.0`
- Registry tarball: https://registry.npmjs.org/ember-source/-/ember-source-6.12.0.tgz
- Registry integrity: `sha512-cApfEKxltl2VWt0o24XISsdkpyqqtT8wG0/EWokjeyqBPRCOIej2PMzRkLAu3A5AWpuWoJ//yq04mDix7axA7w==`
- Tarball SHA-256: `3d70d6e3d964d8642234ace78ce8d67fca8e988a06a1c1e97e06e2c38db3cbb2`
- Distribution commit: `d8c8a9897a30d42c09a07cf212a8b7c730966233`
- License: MIT; the upstream `LICENSE` remains in this directory.

The executable Ember runtime, testing support, and template compiler are no
longer copied into the repository. They are resolved from the immutable npm
lockfile during the reviewed build. `ember-global-compat.js` is a first-party,
temporary compatibility bridge for the classic application and is not an
upstream Ember distribution file.

Ember 6.12 is the supported LTS compatibility target. The application keeps the
classic bundle boundary until its remaining global Ember imports and prototype
extensions are removed and the ES-module optional feature can pass the complete
browser regression suite.
