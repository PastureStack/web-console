# Web Console 1.6.179 — reviewed dependency baseline

This component release packages the dependency updates already merged through
PRs #180 and #182, based on `main` commit
`629e5714984afa9e66671c099773170f54519580`. The reviewed lock resolves Moment
2.31.0, markdown-it 14.3.2, postcss-selector-parser 7.1.6, proxy-addr 2.0.8,
compression 1.8.2 and source-map-js 1.2.2. Prior application behavior, including
inactive-environment details and ended-workspace safeguards, remains unchanged.

The release diff updates only numeric version metadata, the corresponding
reviewed lock roots, existing gate version constants, README and this note.
It adds no application feature or dependency graph change beyond that merged
baseline. The existing Critical/High audit threshold, fail-closed checks and
dated `GHSA-vfj7-8cjw-p6xm` build-input review remain unchanged; this is not a
zero-CVE claim or runtime not-affected VEX.

Publication uses the existing fixed-source `Validate Web Console` workflow:
source and supply-chain gates, Chrome unit tests, two production builds and a
byte comparison of the deterministic numeric-root archives. The immutable
[1.6.179 release](https://github.com/PastureStack/web-console/releases/tag/1.6.179)
records the tested source, normal signed PR merge, exact CI run, archive SHA-256
and size. Its assets reuse the retained CI archive and portable checksum without
rebuilding. The new numeric lightweight tag binds the tested signed commit;
the tag itself is not signed. Previous component tags and assets are preserved.

Server assembly and deployed browser acceptance are separate results. This
component publication does not claim deployment, complete permission/resource/
locale coverage, or promotion of any historical HOLD or INCOMPLETE result.
