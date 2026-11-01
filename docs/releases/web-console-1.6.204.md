# Web Console 1.6.204 / bridge 0.2.6 published

[Web Console 1.6.204 / bridge 0.2.6](https://github.com/PastureStack/web-console/releases/tag/1.6.204)
is published. All 13 assets passed actual anonymous GET, exact byte-count and
SHA256 verification. This is component publication; matching Engine 0.183.365 /
Server 1.6.564 assembly and designated native/browser acceptance remain pending.
The existing deployed Server563/Engine364 baseline retains its separate results.

## Clear audit-admission errors

A known authentication or Key-policy denial from audit admission previously
became a generic unavailable-integration error. The shared command engine now
preserves verified 401/403 or internal authentication/context failures so the
reply gives the correct sign-in, permission or Key-reconnection guidance.
Verified stdio revision drift retains CONTEXT_CHANGED and uses a fixed safe
ApiKeyPolicyChanged marker; it never adopts the new revision automatically.

Admission remains fail-closed. No business request runs without a verified start
ACK. Generic 409, infrastructure/network failures and invalid ACKs remain
unavailable. Context replacement takes precedence over a stale denial. A result
ACK failure after a possible write stays UNKNOWN_RESULT with its authorized
recovery reference; it does not claim rejection or submit another change.
Arbitrary error messages, detail, payloads, credentials and headers are not
projected into tool results. Browser and stdio use the same command sources.

## Original component evidence

- Producer: `64caa55d0b0768de1633549b54a169ddb62c9194`.
- Normal merge and signed numeric tag target: `da24369ea12455d38f7dc63aef906eed5e38ffea`.
- Tested tree: `6e76dbe42f665335df51ccc8ee2852be4fcdda8d`; producer and tag target share that tree.
- Original [full/enabled CI 41294735238](https://github.com/PastureStack/web-console/actions/runs/41294735238) and [CodeQL 41294733570](https://github.com/PastureStack/web-console/actions/runs/41294733570) passed, with zero CodeQL aggregator annotations and no new alerts.
- The original CI archive has 124 manifest-verified files, SHA256 `8a8280c201cf59f2d1e6dbf648c5ddd14dd3129b5d738ce7af37d2c1b9738f4e`. Native archive provenance and runtime-SBOM attestations passed; publication rebuilt no component.
- Actual original CI: 1,122 Ember tests / zero failures. Exactly 5 new source cases comprise four browser audit-command cases and one actual bridge-core case. Restricted-Key4, confirmation6, npm12 normalization10, reminder1 and layout1 remain 22 inherited 203 source cases.
- All 35 collaboration source names and 29 npm-policy cases were freshly observed. The one inherited layout QUnit has 96 parameter combinations, not 96 unique tests; its four compiled modules and four theme CSS assets are archive/manifest-bound.
- Original CI dependency audit: 0 High / 0 Critical / 62 Moderate. The official follow-redirects 1.16.2 patch remains present. Moderate findings are retained; runtime SBOM coverage remains explicitly incomplete.

The package/lock updates are version metadata only; dependencies and security
decisions are unchanged. Existing restricted-Key discovery, helper contracts,
pending-review layout, typed tools, Full/legacy behavior, role/Key ceilings,
current-context checks and human confirmation are retained. WebMCP remains
independently build-gated and starts off on every page.

## Bridge 0.2.6 source and dependency evidence

The ZIP contains 34 fresh exact-Git sources plus its manifest/SBOM, 36 entries
total. ZIP SHA256 `091379b24f6651d54d49e463be5fa4d4bb60dae1551d857251ad06de5ea37f63`.
The fresh lock-only SBOM has 92 dependency components, SHA256
`113d9ea2ba289bf327717aa51ffefc7f1c3c929a7ee91763dfb5e3daca56d20d`.
Component metadata and dependency edges equal published 0.2.5 except root version;
the SDK remains 1.32.2.

Prior 0.2.5 dependency/clean-install/SDK evidence is carried only across that
verified unchanged dependency graph. No new 0.2.6 clean install, SDK handshake or
CVE scan was run. New 0.2.6 source behavior is covered by the original Web204 full
CI, including the new bridge-core transport case. An inherited SDK handshake is
not an additional new source case or live-platform result.

The public [bridge026 source proof](https://github.com/PastureStack/web-console/releases/download/1.6.204/bridge026-release-proof.json)
is a safe qualification summary, not native SLSA provenance.
[Release metadata](https://github.com/PastureStack/web-console/releases/download/1.6.204/web204-release-metadata.json)
binds the 13 asset hashes, actual CI counts and evidence scope. Anonymous readback
independently verified every asset's actual bytes.

## Runtime boundary

Matching Engine 0.183.365 / Server 1.6.564 publication and deployment remain
pending. This client release does not complete Audit acceptance, native plan
read/apply, Catalog or Member cleanup. Designated browser, role/Key/cross-ID,
cleanup and weak-model workflows need their own fresh evidence. Original
failures and unaffected PASS evidence retain their scope. The 243-group frontend
inventory remains in progress. Consume the component through its matching
Server release; do not replace runtime files manually. Later documentation
commits do not replace the producer, tag target or published artifacts.
