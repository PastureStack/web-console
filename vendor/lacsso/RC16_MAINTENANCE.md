# RC16 Maintenance Notes

This directory vendors `lacsso@0.0.59` from the Apache-2.0 Rancher `lacsso` package.

The vendored package is intentionally named `lacsso` so Ember addon resolution remains compatible with Rancher 1.6 UI. The local version is `0.0.60-rc16.0` to make the maintenance patch visible in lockfiles.

Changes from upstream package metadata:

- Removed the stale `ember-cli-htmlbars-inline-precompile` dependency. The packaged lacsso source does not import or require that addon.
- Aligned lacsso's addon transpiler dependency to `ember-cli-babel` `8.3.1`, matching the Rancher UI build path and preventing a nested Babel 5/core-js 1 toolchain from returning.
- Pointed lacsso's pagination/dropdown addon dependencies at the local rc16 vendored copies so their runtime source remains available without reintroducing old addon development toolchains.
- Pinned `ember-cli-sass` to `10.0.1`, matching the existing Rancher UI Sass replacement path that had already overridden lacsso away from its old Sass stack.
- Removed lacsso's own development and publishing dependencies from the vendored package metadata. Rancher UI consumes lacsso as an addon dependency only; pulling lacsso's old dummy-app, Gulp, release, JSHint, SRI, live-reload, and Ember test toolchain into the main lockfile would reintroduce EOL build dependencies without affecting runtime behavior.
- Removed lacsso's packaged `.sass-cache`, `.npmignore`, `.ackrc`, and Gulp release file because they are not runtime addon source.

No lacsso component, helper, template, style, font, runtime API, or generated asset source is changed in this vendored copy.
