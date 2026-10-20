# Web Console 1.6.192

Published on 2026-10-20 from the original validated CI archive.

- Producer: `a8e2ab0c8242355f06c1ab2584978ccfc4d76c02`.
- Protected PR #215 merge: `33cdc03dde8cd522894bc28edf76e1b1ec7644fb`.
- Identical tested tree: `223ee936054ad9749800ce0e622aa6e7b072a7c7`.
- [CI 39408830305](https://github.com/PastureStack/web-console/actions/runs/39408830305)
  passed all eight native Chrome Host model tests, dependency/security gates,
  actual browser module inventories and two byte-identical production archives.
- Required CodeQL checks passed without bypass.
- [Immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.192):
  `web-console-1.6.192.tar.gz`, 3,037,760 bytes, SHA-256
  `52840ebf2800f9588ec7910fe617b7782a6e92a27046b4876e9656ef4883e609`.

The shared Host model no longer converts an empty filesystem report into `0 B`.
It rejects invalid capacity values, falls back to valid legacy mount data and
preserves genuine zero. Summary and details use the same source; when neither
source has data, existing templates leave capacity unknown. Available local
storage is a different measurement and is never substituted for total capacity.

The tests cover missing/invalid reports, legacy fallback, source precedence,
zero, array-shaped reports and replacement/invalidation, alongside the existing
Host Clone permission test. They do not replace Server runtime or historical
role/language acceptance. The dependency graph, thirteen locale resources,
session protections, OIDC, TOTP, Passkey, RBAC and API contracts are unchanged.
Previously tracked dependency findings retain their existing policy and review
deadline; this correctness patch does not claim an additional CVE fix.

Later documentation commits do not replace the signed producer or immutable
archive. Use the Server's matching release for deployment and retain the prior
working image and persistent data for rollback.
