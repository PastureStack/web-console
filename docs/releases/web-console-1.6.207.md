# Web Console 1.6.207 / bridge 0.2.9 candidate

This source candidate adds TCP health checks to the existing External Service
create workflow and fixes the authoritative Stack name in Service/container
create review. It is not yet published, deployed or runtime-qualified.

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
reports are not rewritten. Full CI and artifact verification for this change
are still required. The twelve tool names and
command protocol `1.0` remain unchanged. Required CI, exact original artifact
qualification, release/digest, runtime permission/ID boundaries, visible
review/receipt and owned-fixture cleanup still require their own evidence.
No claim of full 243-group acceptance is made.
