# Web Console 1.6.196

Published on 2026-10-29 as an
[immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.196).
The original producer is
[`4e3e4d51db003ef7b456166084d425bfb06e1518`](https://github.com/PastureStack/web-console/commit/4e3e4d51db003ef7b456166084d425bfb06e1518).
Release tag `1.6.196` points to the approved squash merge
[`752f73bc1aaf4d4b178a6eb66a5915f858cfa4c4`](https://github.com/PastureStack/web-console/commit/752f73bc1aaf4d4b178a6eb66a5915f858cfa4c4).
Both commits have tree `8fea692152475978d28e58d7b2161084d695545f`.
The release uses the original CI bytes; it was not rebuilt after the merge.

[Full producer CI](https://github.com/PastureStack/web-console/actions/runs/40852984818)
passed all 1,108 Ember tests, the focused source checks, reproducible double
build, CycloneDX schema verification and artifact attestations.
[CodeQL](https://github.com/PastureStack/web-console/actions/runs/40852646450)
passed both required analyses and the new-alert gate with zero new alerts.
Anonymous downloads of all nine release assets matched the retained local
producer files on 2026-10-29. Archive-provenance and runtime-SBOM attestations
were verified, as was the Server consumer's archive/SBOM/profile check.

| Release asset | SHA-256 |
| --- | --- |
| [web-console-1.6.196.tar.gz](https://github.com/PastureStack/web-console/releases/download/1.6.196/web-console-1.6.196.tar.gz) (3,118,080 bytes) | `4f0a550c2754e244cbf77f380c5c138150687988791e063bbf39ce0150d880fa` |
| [web-console-1.6.196.tar.gz.sha256](https://github.com/PastureStack/web-console/releases/download/1.6.196/web-console-1.6.196.tar.gz.sha256) | `cea0e108351e1f285aab6b309188509c404886bbefa43a98de1476da0a942d38` |
| [web-console-1.6.196-runtime.cdx.json](https://github.com/PastureStack/web-console/releases/download/1.6.196/web-console-1.6.196-runtime.cdx.json) | `44b6c1940e4fd364e7a634ac2a6168bc2a0ac3d84b07b9adbc4f6fa2d7e743eb` |
| [web-console-1.6.196-build.cdx.json](https://github.com/PastureStack/web-console/releases/download/1.6.196/web-console-1.6.196-build.cdx.json) | `b78ede7bea70a792135e72966943dc08f36a49a7bcf1cf91cc777a62ea9e86ec` |
| [web-console-1.6.196-artifact-manifest.json](https://github.com/PastureStack/web-console/releases/download/1.6.196/web-console-1.6.196-artifact-manifest.json) | `ed5ea160c2d939c671fdaff5ab8c971c85996441b9b13e1c7a39294e165df878` |
| [web-console-1.6.196-sbom.sha256](https://github.com/PastureStack/web-console/releases/download/1.6.196/web-console-1.6.196-sbom.sha256) | `4bf730433b0cfb94961b44b8ddc81ce49db51dc2de76c85a0f3bf0b6df086da9` |
| [web-console-1.6.196-webmcp.json](https://github.com/PastureStack/web-console/releases/download/1.6.196/web-console-1.6.196-webmcp.json) | `7c116dad93902398fea86d95f4e599764a5f0fe6606fe801ebccf4b2f69958a6` |
| [pasturestack-webmcp-bridge-0.1.0.zip](https://github.com/PastureStack/web-console/releases/download/1.6.196/pasturestack-webmcp-bridge-0.1.0.zip) | `d5f26457989147d77a6c6cf0a41985f805901edb0e448b3946a215e003fd5824` |
| [pasturestack-webmcp-bridge-0.1.0.zip.sha256](https://github.com/PastureStack/web-console/releases/download/1.6.196/pasturestack-webmcp-bridge-0.1.0.zip.sha256) | `fd58ae9b237458d2b3e1fd50a7aefed33264d9cd08495ea11a9887ae274168fa` |

The producer lockfile SHA-256 is
`4b9fb2e87352ec76c242b06af3974556b4d7c9f430adb0baccea3f624d3605e6`.
The archive's `webmcp-build.json` and matching release sidecar both record
`{"ceiling":"enabled","initialMode":"off"}`. The build contains the full
collaboration capability while each new browser page starts with tools paused.
Users opt in through the existing collaboration panel. Backend upgrade and
dedicated-Key bridge flags remain separate operator opt-ins.

The seven tools provide scoped discovery, service reads, conditional description
updates and server-owned upgrade preview/apply/status. Human approval remains
outside the tool interface, and accepted/running operations are not reported as
completed. See [AI collaboration](../webmcp.md) and the
[standalone bridge guide](../../bridge/README.md).

QA r10 verified `busybox:1.36.1 → 1.37.0 → 1.36.1` with human approval and
verified operation results, plus Unicode description write/clear. Low-reasoning
model cases covered ambiguous targets, missing image, description writeback,
stale-reference repair and an approved upgrade. Native off/read-only/enabled
registration was checked at 0/4/7 tools. All 78 layout cells passed across
13 locales, three themes and 1440/390 widths; the 26 auto-theme cells also
covered both 07:00 and 18:00 timer transitions. Focused checks include seven
setup-path/filter cases, 11 bridge cases and 29 audit-gate cases.

The fresh npm 12.0.2 audit reported zero findings. The historical braces
advisory's [official withdrawal](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
is recorded separately from its original High severity; no patched dependency
release or browser-runtime not-affected claim is inferred from that withdrawal.
Runtime SBOM coverage remains explicitly incomplete for inherited vendor
metadata. These results cover the seven-tool service flow and layout matrix,
not the full 576-case product matrix. Server assembly and deployed-runtime
acceptance are tracked separately.
