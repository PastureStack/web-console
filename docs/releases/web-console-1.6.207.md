# Web Console 1.6.207 / bridge 0.2.9

This published component adds TCP health checks to the existing External Service
create workflow and fixes the authoritative Stack name in Service/container
create review. It also safely formats human audit details. Server assembly and
designated workflow runtime acceptance are separate from component publication.

## External Service TCP health checks

The existing `preview_resource_change` tool accepts `parameters.healthCheck`
only for External Service create. Its closed fields are required integer
`port` (1–65535), optional positive integer `interval`, `responseTimeout`,
`healthyThreshold` and `unhealthyThreshold`. Optional integers are bounded by
the Java Integer representation. These bounds define the typed subset; they
do not invent native timing defaults or a native product maximum.

Omitting the object retains no health check. Strings, nulls, fractions,
out-of-range integers, HTTP request lines, headers, strategies and unknown
fields are rejected. The exact approved values pass through preview, normal
human review, confirmation, apply and verified operation readback. Native
External Service ownership, role/Key limits, stopped creation and top-level
`healthCheck` semantics are retained. Matching Engine 0.183.368 is required;
requested settings must never be dropped to retry against an older server.
Ordinary UI forms and existing update operations are unchanged.

## Readable create review

Service/container create review resolves the Stack name from the authorized
store for the captured project and exact resource identity. A cold cache uses
the existing authorized object GET. Pending, rejected or stale reads remain
non-confirmable and use existing diagnostic/retry UI. Both real Ember
ArrayProxy collections and plain arrays work; a missing iterator or numeric
index no longer hides an existing Stack.

The review does not trust an AI-provided label, derive names by splitting a
display path, expose a raw Stack ID as its label, or alter the immutable
approval payload. Existing generation, account/project/Key context guards and
confirmation ownership remain in force.

## Human audit details

Audit metadata can omit request/response content or contain an already-decoded
object or plain text. The previous unconditional JSON parser could throw during
dialog initialization. A shared formatter now handles both fields independently,
shows localized empty/unavailable states and renders plain text with escaping.
The existing close action, JSON display and current payload permissions remain.
It never retrieves additional payloads or sends human-only contents to AI tools.
The five dialog labels/messages are reviewed in all thirteen supported locales.

## Evidence boundary

Focused TCP source results comprise 17 distinct related Node methods and the
native source contract. They are carried without rerunning unaffected tests.
The initial narrow Stack-name tests missed the real ArrayProxy shape; its
failure is retained, the production fix changes one collection iteration, and
all four affected lookup/collection cases pass. Independent source review
closed that specific defect. These results are not browser/runtime acceptance.

Web/bridge package roots, active test lock, producer version guard, bridge
handshake and packager are synchronized. The bridge dependency graph is
unchanged. The UI build graph converges affected minimatch 8/9 callers to
10.2.6 and applies the exact upstream 11.0.1 preprocessing security fix from
pinned source. This retains the RegExp/matchOne API required by the existing
Ember callers. The glob wrapper uses the official raw export so the external
matcher receives the same fix. Explicit build preparation and read-only entry
checks cover CI, npm build/test/start and direct Ember builds. Build SBOMs keep
the actual npm identity and add verified backport file hashes; raw scanner
reports are not rewritten. The original CI audit retains 49 Moderate and zero
High/Critical findings. SBOM coverage remains incomplete; this exact build-route
backport qualification is not a whole-product zero-vulnerability claim. The
unused upstream glob embedded matcher remains unmodified. The twelve tool names
and command protocol `1.0` remain unchanged.

## Published source and original CI

- Producer: `e3f8fbe872d91df6837d5de3339a0efde645ac74`.
- Normal PR247 squash merge and signed `1.6.207` tag target:
  `00855544be1da90d8de63a823b437e2140b29c4e`.
- Both commits have tested tree `11fde8f7eff0861eaf06a0357edc649b1caffb2c`.
- Original full/enabled [CI run 41914388958](https://github.com/PastureStack/web-console/actions/runs/41914388958)
  passed 1,127 browser tests with zero failures. These include three modal unit
  and two integration cases. The four new formatter Node cases also passed;
  the five QUnit cases are included in 1,127, not additional browser tests.
- Native [CodeQL run 41914393313](https://github.com/PastureStack/web-console/actions/runs/41914393313)
  and its required checks passed; aggregator `126870429313` has zero annotations.
- Original CI artifact `13364327724` was downloaded once. Its 60,781,245-byte
  ZIP has SHA256 `814abbd60ea554b132e3ae8ac85cc9fdbda3bb3b6a46785b8b3a2e40d75562be`.
  The original 124-file release archive was retained without rebuilding.

Both GitHub cryptographic verifications passed for the original archive:
SLSA provenance binds the exact producer/workflow/attempt, and the CycloneDX
attestation matches the original runtime SBOM. All 13 published assets passed
actual anonymous GET, exact byte-count and SHA256 verification.

| Published asset | SHA256 |
| --- | --- |
| Web archive | `f61c21737a41bb3c1fadab8399d07509bfd144aacf2520ed6a73779a0139021a` |
| Runtime SBOM (217 components) | `92e70a4c6da8d6cff39451b992c0fe169f93f5f37ce1bda1ba80cffc8378050a` |
| Build SBOM (1,472 components) | `7fd07c07a20baa4e7f161a17a8b66840895bf538b4f70a8c56ecc342b76d9783` |
| Bridge 0.2.9 ZIP | `06705876cd79071c505bb573c9f5d7fc346ea4c6b4512c3eeb3d01e57851f3a9` |
| Bridge SBOM (92 components) | `069b5d1f91588b632c71a40f6d088b9986d2d7265e44807ede85859ca7046fca` |
| Release metadata | `ee95cb8e3f8ca4bfc597fb46f97def157f752ba094ae9709dc53ed568084865d` |

The [public metadata](https://github.com/PastureStack/web-console/releases/download/1.6.207/web207-release-metadata.json)
records the complete release asset digests, actual npm audit result, exact nine
backported minimatch locations and source/artifact/SBOM boundaries. The pinned
backport archive has SHA256
`7f503bfe66c1dc9bef69b3a42ff29438b54397ee801c5fd1af5e62fe61e28c00`.
This covers CVE-2026-118764 preprocessing amplification at the reviewed build
entries while retaining the actual npm version 10.2.6 and recording the local
modification in the build SBOM.

## Bridge and matching Engine

Bridge 0.2.9 packages the final producer's 35 allowed source files in 37 entries,
including its SBOM and source manifest. The 92-component graph is unchanged
from published 0.2.5 apart from the root version. That release's clean-install
evidence is explicitly carried; no new install or dependency scan is claimed.
A new real SDK 1.32.2 stdio handshake verified version 0.2.9, command protocol
`1.0` and all twelve tool names using a read-only existing SDK cache and loopback
test API. The [Bridge source proof](https://github.com/PastureStack/web-console/releases/download/1.6.207/bridge029-release-proof.json)
records these separate evidence boundaries.

The ZIP and its README are immutable producer snapshots. Use the repository's
[current bridge README](../../bridge/README.md) as the installation authority;
later documentation changes do not replace the published ZIP or its source
manifest. Download links and checksum commands there target 1.6.207 / 0.2.9.

Matching Engine 0.183.368 is published. Its exact immutable source contracts
passed both the full and External-TCP checks. Its native release attestation is
verified; workflow SLSA provenance was not provided and is not inferred.

Component publication does not claim Server567 deployment, native Audit Case12
acceptance or full runtime permission/ID, visible review/receipt and owned-fixture
cleanup coverage. Full 243-group acceptance remains incomplete.
