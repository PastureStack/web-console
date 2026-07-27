# RC16 Maintenance Notes

This directory vendors `ember-rl-dropdown@0.8.0` from npm under its MIT license.

The vendored package keeps the original addon source and runtime API but uses version `0.8.1-rc16.0` in local lockfiles.

Changes from upstream package metadata:

- Removed the package's own development, dummy-app, release, live-reload, SRI, QUnit, JSHint, and welcome-page dependencies. Rancher UI consumes this package only as an addon dependency through lacsso.
- Aligned `ember-cli-babel` to `8.3.1`.
- Removed npm packaging metadata that is not needed by Rancher UI's addon consumption path.

No dropdown component, mixin, template, or runtime behavior is changed.
