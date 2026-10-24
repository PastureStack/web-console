# Web Console 1.6.195

Published on 2026-10-24 as an
[immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.195)
from signed producer `f905bc12daae18d98a6ac65942625562fff2a424`.
[Exact-producer CI](https://github.com/PastureStack/web-console/actions/runs/40086505425)
passed before publication. PR #223 merged the same source tree as
`59ae58b43c84d31fb284f4d2ece2df88dcf03ec4`; later documentation commits do not
replace the producer or release assets. Anonymous downloads matched the retained
CI files, and archive-provenance plus runtime-SBOM attestations were verified.

| Release asset | SHA-256 |
| --- | --- |
| [web-console-1.6.195.tar.gz](https://github.com/PastureStack/web-console/releases/download/1.6.195/web-console-1.6.195.tar.gz) (3,093,125 bytes) | `26cbe1f3c057722c6682c43316021687508b7d9dd58c28c32713512d75238bb3` |
| [web-console-1.6.195-runtime.cdx.json](https://github.com/PastureStack/web-console/releases/download/1.6.195/web-console-1.6.195-runtime.cdx.json) | `ca31669f58aa342cd346e1d33ec7061d65f9b84d6a3afcbd132e09361425a88a` |
| [web-console-1.6.195-build.cdx.json](https://github.com/PastureStack/web-console/releases/download/1.6.195/web-console-1.6.195-build.cdx.json) | `31798dda0a80a3306db0499ddc66d17e1815ddfdc25eb509a229ee83a368dad5` |
| [web-console-1.6.195-artifact-manifest.json](https://github.com/PastureStack/web-console/releases/download/1.6.195/web-console-1.6.195-artifact-manifest.json) | `b216215b2d3025d687a27a8d57f7d98193573fd22860cd625900820a8bd28ddb` |

The producer lockfile SHA-256 is
`ae862be4519751895f74e552f036906d64be8371fdbbc6379c16e52518f9ee22`.

This release adds repeatable, archive-bound CycloneDX runtime and build SBOMs.
The production module inventory, static files, original archive checksum,
lockfile and source commit are cross-checked. SBOMs are sidecar release assets:
they do not expose source maps or insert build dependencies into the browser.

CI retains the actual runner OS/Ruby inventory separately from the browser BOM.
The actual producer is the digest-pinned Node container, not merely a host
process with a Docker image environment variable. Before/after inventories must
show no installed Ruby packages or Ruby executables in that container.
Preinstalled runner SDKs remain a separate host-vendor tracking item; Ubuntu
backports are not inferred from the Ruby upstream version number alone.

Fresh security validation also updates the build/serve dependencies to official
body-parser 2.4.0, fast-uri 3.1.9 and serialize-javascript 7.1.3 fixes. The legacy
live-reload consumer keeps its raw-body 2.5.3 compatibility pin under its own
parent, while modern body-parser uses its supported 3.x dependency. Its required
qs patch is pinned to 6.16.1.

Node.js 24.22.1 / npm 12.0.2, application sources,
API/authentication/permission behavior and all 13 locales are unchanged.
The exact producer's `sbom` scope passed 69 distinct focused checks: 40 SBOM
generator cases, 2 module-boundary checks, 3 Webpack-inventory checks,
4 final-byte inventory checks, 7 dependency-security regressions,
6 builder-inventory tests and 7 builder-boundary tests. The Node harness reports
17 passing tests because it counts the 40-case SBOM script as one wrapper;
that wrapper and the repeated host boundary invocation are not counted again.
There were no focused-test failures or skips. Both production archives and all
three SBOM/manifest documents were byte-identical, and both BOMs passed official
CycloneDX 1.6 schema validation. The dependency-security gate, fresh npm audit
with zero vulnerabilities, and both required CodeQL analyses passed.

The seven dependency regressions resolve packages through their actual consumers
without assuming npm hoisting. They verify the legacy `body` UTF-8 and 413 limit
contract, modern body-parser identity/gzip/deflate JSON, the official trailing-byte
decompression cases with callback/stream-close barriers and a subsequent healthy
request, encoded-scheme rejection with URI/host compatibility, and the official
spoofed-function serialization case with ordinary data/function roundtrips.

The producer container's before/after inventories were identical and established
Ruby absence. Hosted-runner Ruby SDKs and distribution backport status remain
separate unresolved tracking items. Runtime SBOM composition remains
`incomplete` for opaque vendor snapshots and the documented attribution gaps.
This release does not claim a new full browser/feature/authorization matrix
PASS, or completion of Server assembly, publication or deployment.

For the format and known-unknown boundaries, see [SBOM documentation](../security/sbom.md).
