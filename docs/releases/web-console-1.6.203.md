# Web Console 1.6.203 / bridge 0.2.5

[Published release](https://github.com/PastureStack/web-console/releases/tag/1.6.203)
with the original qualified CI bytes. All 13 public assets passed actual anonymous
GET, byte-count and SHA256 verification. Matching Server 1.6.562 / Engine 0.183.363
runtime and designated workflow acceptance remain pending; the full 243-group
frontend inventory is still in progress.

The shared API Key resource family now includes `apiKeyRestricted`. Both browser
WebMCP and the stdio bridge can find a restricted Key by its visible name, use
the returned opaque reference and query its authorized audit metadata. The Engine
already supports this native type; no credential manager or policy is widened.

The family remains partial. Omitting `resourceType` searches ordinary `apiKey`
resources; choose `apiKeyRestricted` for restricted Keys. The two collections are
not silently merged. A same-name match never authorizes an arbitrary target,
owner denials remain denials, and mismatched response types are rejected.

Four causal regression cases cover both transports, explicit type selection,
owner denial and incorrect response types. The two directly affected resource
and audit suites pass 39 cases. This does not establish runtime or all-frontend
acceptance. Token/MFA/session and human-confirmation protections are unchanged.

This patch requires the existing Engine 0.183.361 typed resource contract. The
matching Server also includes Engine 0.183.363, retaining ServiceIndex cleanup
and correcting External Service review before values.
Both opt-in defaults and ordinary Full/legacy API behavior remain unchanged.

## Clear confirmation errors and official dependency fix

Rejected human approvals now use the existing alert style with a clear account/Key
permission message in all thirteen locales. Conflict, changed-session and stale
references prompt a new preview. Unknown failures remain generic; arbitrary server
messages and private payloads are never displayed. Authorization and the saving
lock/finally lifecycle are unchanged. Six focused cases cover the public error
contract, safe text, cleanup and actual locale parsing.

The build dependency follow-redirects is pinned to official 1.16.2 for
[CVE-2026-116689](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p). Real loopback
cases retain same-origin behavior and stop cross-realm sensitive headers from
following cross-origin redirects. The npm12 audit parser separately recognizes
lock-proven aliases and exact duplicate causes while retaining distinct advisory
source/range, raw findings and all existing High/Critical/review-expiry gates.
This is not a new vulnerability exception or a claim of zero Moderate findings.

## Shared pending-review layout

The global pending-plan reminder could cover the footer after its review modal
was closed, preventing normal clicks on language and CLI controls. The same
explicitly enabled review component now lives once in authenticated page
content. Its existing review observer, manual approval action, escaped text and
global modal lifecycle remain intact. Scoped wrapping keeps long target paths
and translated buttons within the page in narrow and RTL layouts. Background
authorization notices retain their existing alert semantics.

The final original CI verifies 35 collaboration source cases, including one new
reminder case, and one new QUnit layout case with 96 parameter combinations.
Those combinations are not 96 unique tests. Four actual compiled layout modules
and all four theme CSS assets were checked against the original archive and its
manifest. This is component evidence; designated runtime layout acceptance is
still pending. The earlier qualified 27ba candidate remains superseded evidence;
no tag or release was published from it.

## Published evidence and remaining acceptance

| Identity | Published value |
| --- | --- |
| Tested producer | `d97a8990801a281b519573a48b0db7dd12c9a616` |
| Merge and signed tag target | `ae409b8404e946512297f00a71bdb4c141a3d5eb` |
| Same tested tree | `6fff4d815fa34edc0287626e2ab83990fbc3a061` |
| Web archive SHA256 | `81e2e81becb2a006f0a753d781d7ec0383a908081c10864f451e8372b246b59d` |
| Bridge ZIP SHA256 | `cafe59ca00122dfaf9534f65f2cbd96500e6c014f4819dd8c49fd3cd4fa23b93` |

[Original full/enabled CI](https://github.com/PastureStack/web-console/actions/runs/41277794501)
passed 1,122 Chromium/Ember tests with zero failures.
[CodeQL](https://github.com/PastureStack/web-console/actions/runs/41277795345)
passed with zero aggregator annotations and no new alerts. Archive provenance,
runtime-SBOM attestation and all 124 manifest files were verified. The published
profile has an enabled capability ceiling and starts each page with tools off.
Later documentation commits do not replace this producer or rebuild its artifacts.

New source cases are restricted-Key4 + confirmation-error6 + npm12-normalization10
+ one reminder collaboration case + one QUnit layout case =22. The 29 existing
npm-policy cases remain existing. Overlapping source and artifact invocations are
not summed as unique business acceptance. The actual Bridge archive passed its
offline clean install, the four restricted-Key cases and one real local SDK
handshake. Its separate SBOM contains 92 verified dependency components; the
dependency graph matches 0.2.4 except for the root version.

The final CI audit reports **0 High, 0 Critical and 62 Moderate** findings. The
earlier same-lock primary capture independently recorded 63 Moderate findings;
that observation is retained separately. Moderate findings were not waived or
rewritten, and publication performed no new vulnerability scan. Runtime SBOM
coverage remains explicitly incomplete. Exact checksums and component evidence
are in the published
[release metadata](https://github.com/PastureStack/web-console/releases/download/1.6.203/web203-release-metadata.json)
and [Bridge qualification summary](https://github.com/PastureStack/web-console/releases/download/1.6.203/bridge025-release-proof.json).

[Engine 0.183.363](https://github.com/PastureStack/orchestration-engine/releases/tag/v0.183.363)
is published. Matching Server 1.6.562 assembly and combined browser, role, cross-ID,
layout and weak-model runtime acceptance remain pending. Existing runtime failures
retain their scope; component CI, archive checks and anonymous publication readback
do not resolve them or establish completion of all 243 frontend groups.
