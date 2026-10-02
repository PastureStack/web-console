# Web Console 1.6.166

Published immutable component; packaged Server and full-matrix acceptance are
separate results.

## Publication identity

The signed numeric tag `1.6.166` pins validated source
`b63fa15f6726cb78659ae43258dfc802b30d6d04`, tree
`86aceda21917a87cd1909c331d844eef37ef9232`. Runtime PR151 merged as
`f110f28498bc32680ad111519bfae4c8803a7bf1` with that same tested tree;
later documentation is not the tagged runtime source.

[Official validation 36998466706](https://github.com/PastureStack/web-console/actions/runs/36998466706)
passed 768/768 actual tests, zero failures/skips/todo, including eight actual
state/date rendering cases. Two production builds produced byte-identical
archives. The immutable [release](https://github.com/PastureStack/web-console/releases/tag/1.6.166)
reuses the reviewed candidate without rebuilding. Anonymous public downloads
match the archive and portable SHA-256 file's exact hashes and sizes.
Archive SHA-256 is
`9205fbaec6e80f31846212f0949c3eac0fae083f80c6c46a3122d64c4d9da6c6`
(2,976,302 bytes). No existing tag or release artifact is overwritten.

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
and security thresholds are unchanged. Publication reused the validated
numeric-version artifact without rebuilding or overwriting existing tags.
Source validation does not promote the native packaged-browser checks,
historical HOLD receipts or complete permission/resource/language matrix.
