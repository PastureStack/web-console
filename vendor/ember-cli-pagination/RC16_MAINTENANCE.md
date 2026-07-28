# RC16 Maintenance Notes

This directory vendors `ember-cli-pagination@2.2.3` from npm under its MIT license.

The vendored package keeps the original addon source and runtime API but uses version `2.2.4-rc16.0` in local lockfiles.

Changes from upstream package metadata:

- Removed the package's own development, dummy-app, release, live-reload, SRI, QUnit, and server mock dependencies. Rancher UI consumes this package only as an addon dependency through lacsso.
- Aligned `ember-cli-babel` to `8.3.1`.
- Aligned `ember-cli-version-checker` to `2.2.0`.
- Removed dummy-app-only config, build, Testem, server mock, screenshot, JSHint, and Watchman files that are not needed by Rancher UI's addon consumption path.

No pagination component, helper, mixin, template, route, or runtime behavior is changed.
