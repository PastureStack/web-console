# Web Console 1.6.166

Candidate component; immutable publication and packaged Server acceptance are
not yet established.

## Shared inactive-state display

The shared badge translated seven known states but omitted `inactive`. A
real Traditional Chinese Registry row consequently displayed `Inactive` in
English. The badge now includes that state in the existing translation path.
All thirteen supported language catalogs gain the matching display label.

Only display text changes. Model/API states, icons, colors, health and
connection overrides, unknown-state fallback, authorization and lifecycle
behavior are unchanged. No proxy, authentication or backend change is needed.

## Focused validation

Eight actual compiled Chrome rendering tests passed all 34 assertions, with
zero failures, skips, page errors or network errors. The new case switches
all thirteen actual language catalogs and verifies `Inactive` in each locale.
The retained cases cover the seven previous translated states, unknown and
prototype-like states, health/connection overrides, colors/icons and
relative-date locale isolation.

The version bump changes only root package/lock versions and dependent
version-gate literals. Reviewed lock-baseline bytes remain equal; dependencies
and security thresholds are unchanged. Publication will reuse the validated
numeric-version artifact without rebuilding or overwriting existing tags.
Source validation does not promote the native packaged-browser checks,
historical HOLD receipts or complete permission/resource/language matrix.
