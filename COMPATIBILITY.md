# Compatibility Contract

## Web Console 1.6.226 / Bridge 0.2.28 published

Minimum and matching Engine: **0.183.386**. New `service/update_links`
`parameters.links[{serviceRef,name}]` is mutually exclusive with `serviceRefs`;
each is a complete replacement of at most sixteen links, and `[]` clears.
Aliases preserve native case and punctuation; null/empty names represent plain
links. External Service create adds only `healthCheck.requestLine` with the
ordinary-Service bounds: a string of 0..1024 characters without NUL, CR or LF.
Omission/empty string retains TCP semantics; URL, headers and credentials are
not added. Native role/Key ceilings and human review remain required.

Original CI passed 1,142 browser tests and 310 distinct focused methods, including
seven new methods. The existing twelve tools, SDK 1.32.2, 92-component Bridge
dependency graph and 59-source archive allowlist remain unchanged. The actual
Engine386 binding and real SDK handshake passed. All thirteen public assets
passed anonymous SHA256 readback, and immutable release verification covered
fourteen cryptographic subjects. Matching Server deployment and native business
acceptance remain separate. See the current component release note.

## Web Console 1.6.225 / Bridge 0.2.27 published

Matching Engine 0.183.385 is required. The existing twelve tools add ordinary
Stack Group editing through update_metadata; group text retains native case,
whitespace and comma-separated tags, with null distinct from empty string.
Human review, role/Key checks, opaque identity and CAS remain binding. Preview
help describes the closed input envelope; validation guidance retains approved
field names without private native values. Logical local Volume creation uses
the native inactive, unallocated terminal record.

Original CI passed 1,142 browser tests and
290 distinct required/affected focused methods;
only 10 are newly declared source methods. All thirteen
public assets passed anonymous SHA256 readback and native release verification
covered fourteen cryptographic subjects. A qualified matching Server assembly,
designated native acceptance and full frontend coverage remain separate.
See the current component release note for the exact evidence and boundaries.

## Web Console 1.6.224 / Bridge 0.2.26 published

The immutable component release is qualified against Engine 0.183.384. Original
CI passed 1,142 browser tests and 269 focused methods; all thirteen public assets
passed anonymous SHA256 readback and native release verification covered fourteen
cryptographic subjects. This component evidence does not establish complete
native workflow or all-frontend coverage. Matching Server assembly and native
acceptance remain separate; see the component release note for boundaries.

## Web Console 1.6.223 / bridge 0.2.25 published

The existing twelve tools add ordinary-Service dependency-link replacement and
Registry activation/deactivation. Engine 0.183.383 or newer is required for
these new typed operations. Plans retain current account/Key permissions,
configuration consistency, exact targets and normal human review. The two new
focused scripts are included in CI and the Bridge source archive; no external
dependency is added.

[The immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.223)
contains thirteen original assets verified by anonymous bytes/SHA256 readback;
immutable-release verification covers fourteen cryptographic subjects. Original
archive and runtime/build SBOM attestations passed. Original CI passed 1,142
browser tests and 126 focused methods (102 existing identities and 24 new), with
zero failures or skips. The unchanged 92-component Bridge dependency graph
retains its original clean-install evidence; Bridge 0.2.25 passed one new real
SDK stdio handshake. This is not a new dependency scan.

[Published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.223/web223-release-metadata.json)
binds producer `4409b1ce6e70ab60e28b04e42a5ab9f3a2386593`, tested tree
`b20f7ab2d821c565dbd8a099e941cf8641fdb667` and merge/tag target
`04794089cdc8e6461ca74e68634deffd6b156215`. Matched Server assembly and native
role/Key/CAS, layout and cleanup acceptance remain separate requirements.

## Web Console 1.6.222 / bridge 0.2.24 published

[The immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.222)
was qualified against Engine 0.183.380. It fixes native administrator-visible
Project discovery and explains how to replace legacy references with the opaque
references returned by generic tools. The twelve tools and Key/role boundaries
remain unchanged. A separately qualified Server assembly is required.

All thirteen public assets passed anonymous size/SHA256 readback; native release
verification covered fourteen subjects, and original source/archive and SBOM
attestations passed. Original CI passed 1,142 browser tests and 102 focused
methods. Published metadata binds producer `f2cbf6fc32f1317465f88aa0eaa9430b94b78e0a`,
tested tree `e5eb18bb3482113eebf326d5cc87fbce7bafbbc9` and tag target
`4f34a06205ade11c0b487c41d2bf87f203336370`. These component qualifications do
not establish complete native WebMCP business coverage.

## Web Console 1.6.221 / bridge 0.2.23 published

An explicit `get_resource({resourceRef, view: "stack_graph"})` reads bounded ordinary-Service dependency links from a fresh Stack reference. The existing twelve tools, fresh native visibility and Key authority remain binding. Nodes and links carry opaque references; raw configuration and hidden counts are excluded. Both completeness fields remain unknown. Ordinary detail performs no graph query when `view` is omitted.

[The immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.221) pairs with published Engine **0.183.380** and requires a qualified compatible Server assembly. All thirteen assets passed anonymous bytes/SHA256 readback; native release verification covers fourteen subjects including the signed tag. Original archive and runtime/build SBOM attestations passed without rebuilding.

Original full/enabled CI passed 1,142 browser tests with zero failures/skips and 95 focused methods (93 carried plus two new Stack graph Node methods). Bridge qualification retained 49 source files, 50 manifest rows, 51 ZIP entries and the unchanged 92-component/95-location dependency graph, with one new real SDK handshake. Its twelve public tools remain unchanged. Clean-install evidence is carried from 0.2.5; no new installation or scan is claimed.

[Published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.221/web221-release-metadata.json) records producer `1b26bcb625c2c6d3b6e27cd5987eba1f0d6db6bc`, normal merge/tag target `d398fa1c0ce4f184720d9d55fbb1680a1b231379` and tested tree `5ce105a129b8406a66651f6a0e885fedfbbbc305`. This documentation commit is separate from the artifact producer. Immutable assets and the release body retain their publication-time bytes. Component publication does not establish Server deployment. All eight native Stack graph criteria, native business/weak-model and whole-243-group acceptance remain separate and pending.

## Web Console 1.6.220 / bridge 0.2.22 published

The existing typed tools support human-reviewed manual scaling for non-Global load balancers. Exact scale values, fresh native role/Key checks, private configuration CAS and active/inactive state remain binding. Ordinary Service limits and Global rejection are unchanged. Misplaced metadata name/description receives a nested `parameters` repair hint; validation and human confirmation remain mandatory.

[The immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.220) pairs with published Engine **0.183.379** and requires a qualified compatible Server assembly. All thirteen assets passed anonymous bytes/SHA256 readback; native release verification covers fourteen subjects including the signed tag. Original archive and runtime/build SBOM attestations passed without rebuilding.

Original full/enabled CI passed 1,142 browser tests with zero failures/skips and 93 focused methods (88 carried plus five new Node methods). Bridge qualification retained 49 source files, 50 manifest rows, 51 ZIP entries and the unchanged 92-component/95-location dependency graph, with one new real SDK handshake. Clean-install evidence is carried from 0.2.5; no new installation or scan is claimed.

[Published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.220/web220-release-metadata.json) records producer `398326d4f3bc58f619169f1693e5c6e97b2ed9a5`, normal merge/tag target `0d37818216830be320496e2254d1de60e1e95648` and tested tree `acff8d71d3afee4675cfdbcdf177038444f3440f`. This documentation commit is separate from the artifact producer. Immutable assets and the release body retain their publication-time bytes. Server deployment, native business/weak-model and whole-243-group acceptance remain separate and pending.

## Web Console 1.6.216 / bridge 0.2.18 published

The existing twelve typed tools accept native port specifications for standalone Container create. Browser and stdio clients share the closed schema, exact mapping review and human-confirmation signature. Name, image, description, command and entry point remain available. Raw launch configuration, environment and Service-only health checks are outside this Container subset.

Create leaves the Container stopped and verifies saved configuration. It does not reserve a port, allocate a dynamic host port or prove a live binding. Start needs a separate approved plan. Service allocation and health checks remain unchanged. Native role, Key and revision checks remain authoritative; unsupported servers fail closed without dropping requested settings or using a generic route.

[The immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.216) pairs with published Engine **0.183.376** and requires a qualified compatible Server assembly. All thirteen assets passed anonymous bytes/SHA256 readback; native release verification covers fourteen subjects including the signed tag. Original archive provenance and runtime SBOM attestations passed without rebuilding.

Original full/enabled CI passed 1,140 browser tests with zero failures/skips and 74 focused methods (69 carried plus 5 new Container port methods). Bridge qualification retained 48 source files, 49 manifest rows, 50 ZIP entries and the unchanged 92-component/95-location dependency graph, with one new real SDK handshake. Clean-install evidence is carried from 0.2.5; no new installation or scan is claimed.

[Published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.216/web216-release-metadata.json) records producer `ab4026507d50bae079933697c2511b7daf5b7cfd`, normal merge/tag target `7499b704a185618b72afde8abfeb964b7f9465c8` and tested tree `8c93f46816167f839dc104801e30f7c7ed3dc2ab`. This documentation commit is separate from the artifact producer. Immutable assets and the release body retain their publication-time bytes. Native Container port, weak-model and whole-243-group acceptance remain separate and pending.

## Web Console 1.6.215 / bridge 0.2.17 published

[The immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.215) pairs with published Engine **0.183.375** and requires a qualified compatible Server assembly. All thirteen assets passed anonymous byte-count/SHA256 readback; native release verification covers thirteen asset subjects plus the signed tag. Original archive provenance and runtime SBOM attestations passed without rebuilding the CI artifact.

The existing twelve-tool protocol adds three ordinary-Service lifecycle intents: `finish_upgrade`, `rollback` and `cancel_upgrade`, each with exactly empty parameters. Native phase, fresh owner and Key upgrade authority, the captured upgrade generation, human confirmation and the original durable operation remain authoritative. Finish/rollback require native process and configuration/instance retirement readback. Cancellation verifies only the native canceled-upgrade checkpoint. There is no `cancel_rollback` capability or arbitrary action proxy.

Original full/enabled CI passed **1,140 browser tests**, zero failures/skips and **69 focused methods**: 61 carried identities plus eight new lifecycle/review-label Node methods. Bridge qualification retained 48 source files, 49 manifest rows, 50 ZIP entries and the unchanged 92-component/95-location dependency evidence, with one new real SDK handshake passing. No new dependency installation or vulnerability scan is inferred.

[Published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.215/web215-release-metadata.json) records producer `c66adfaff3bc1aeef13502b36ff613b203dd7364`, normal merge/tag target `8fe0730ac4193845e8306cd615218e8053a2517a` and tested tree `b1ed18051d1bd7fc30cbd6c5385b98299cfbb6dd`. The exact matching Engine375 publication includes the Project metadata transition fix. This later documentation commit is not the artifact producer. Immutable assets and the GitHub release body retain their publication-time bytes. Designated native workflows and weak-model acceptance remain pending; whole-family/243-group completion is not claimed.

## Web Console 1.6.214 / bridge 0.2.16 published

[The immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.214) uses matching published Engine **0.183.373** and requires a qualified compatible Server assembly. All thirteen assets passed anonymous byte-count/SHA256 readback, and native release verification covers thirteen asset subjects plus the signed tag. Original archive provenance and runtime SBOM attestations passed without rebuilding the CI artifact.

Both bound-profile startup and explicit rewriting now learn the server-verified dedicated-Key purpose/revision through one fixed project collection discovery, then perform the exact bound Project GET. Discovery rows, names and pagination cannot select or replace the bound target. The exact GET retains endpoint, ID, opaque UUID, active/nonremoved identity, visibility and current-Key checks. Missing purpose/revision, revocation or a policy change fails closed. Legacy unbound name selection and native Engine authorization are unchanged.

The original full/enabled CI passed **1,140 browser tests**, zero failures/skips and **61 focused methods**: 58 carried plus three new bound-bootstrap Node methods. The four directly affected compatibility/observer methods also passed on this producer. Bridge qualification retained 47 source files, 48 manifest rows, 49 ZIP entries and the unchanged 92-component/95-location dependency evidence, with one new real SDK handshake passing. No new dependency installation or vulnerability scan is inferred.

[Published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.214/web214-release-metadata.json) records producer `2e4e55a3aa9a09d49be1f0e98a4095115015147b`, normal merge/tag target `776afedaefcd7e3e853448e2b49e6ded28a2f6cb` and tested tree `3d23363fe3da0a7d971fe9f120126aa820e6bfb5`. This later documentation commit is not the artifact producer. Immutable assets and the GitHub release body retain their publication-time bytes. Platform workflows and weak-model acceptance remain separate and pending; whole-family/243-group completion is not claimed.

## Web Console 1.6.213 / bridge 0.2.15 published baseline

[The immutable 213 release](https://github.com/PastureStack/web-console/releases/tag/1.6.213) added shared list/detail opaque Stack-parent references from the fresh typed server response. Reading each parent still requires native role and current-Key authorization; no display-path parsing or cached name grants access. Catalog parent handling, Host and Volume contracts are unchanged. Its original CI passed 1,140 browser tests and 58 focused methods, with thirteen anonymous assets, fourteen native cryptographic subjects and one Bridge SDK handshake. Producer `a0db85adeef666842a5e2b142667bf68a30b5974`, normal merge/tag target `8b7abfc3846cbbc822d0e4e97e1ec075532e94d8` and tree `e5eaf04ab4819fb77311f08da616c980a755f3c3` remain immutable. The 214 release corrects bound-profile revision bootstrap; it does not replace 213 assets.

## Web Console 1.6.212 / bridge 0.2.14 published

[The immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.212) requires matching published Engine **0.183.373** and a qualified compatible Server assembly. All thirteen assets passed anonymous byte-count/SHA256 readback; native release verification covers thirteen asset subjects and the signed tag. Original archive provenance and SBOM attestations passed.

Read-only Process discovery, details and diagnostic summaries use the existing find/get tools and native global schemas, actor authority and Key limits. Project ownership grants no global process permission. Only registered process/handler names, fixed enums and safe timing metadata are projected. Raw exception messages, causes, stack traces, data/result payloads and descendant graphs are excluded. Empty, hidden or truncated diagnostics remain unknown. Source, entry and UTF-8 bounds retain fixed safe truncation reasons without partial conclusions.

Original CI passed 1,140 browser tests with zero failures and all 53 focused methods: 50 carried plus 3 new Process Node methods. The existing passive-session protections, metadata review/approval and opaque-reference boundaries remain in place. Required CodeQL passed; the dependency graph is unchanged.

[Published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.212/web212-release-metadata.json) records producer `b62a2a2e6a24030c98fa0dc4bc1d2681039a1051`, normal merge/tag target `273da92496394502fe7a984f82ecb9bc2f616d77` and tested tree `1cbe62f0c717066163776d0221bb4c6dbb607add`. This later documentation commit is not the artifact producer; the original release assets and note retain their release-time bytes.

Native Process acceptance and matching assembled-Server acceptance remain pending. Component publication is not whole-family or whole-243-group completion. The sections below preserve historical release-time evidence.

## Web Console 1.6.211 / bridge 0.2.13 published

Passive session validation uses one synchronous IndexedDB transaction when Web
Locks are unavailable. It retains the cookie/generation CAS checks and native
API-root actor verification, respects an existing asynchronous authentication
lease, and creates no durable passive lease for a reload to abandon.
Validation-only token and API-root reads use the captured bearer with browser
credentials omitted, so late responses cannot replace a newer cookie. Ordinary
API requests retain their existing credentials behavior.

Login acceptance, MFA challenge acceptance and explicit logout keep their
asynchronous mutex and ownership checks. A pending logout DELETE still excludes
passive adoption. Unexpired asynchronous leases from older JavaScript are not
force-reclaimed.

Original full/enabled CI
[42077118132](https://github.com/PastureStack/web-console/actions/runs/42077118132)
passed 1,140 browser tests with zero failures or skips. All 50 focused methods
were observed once: 39 retained Node methods, 5 retained QUnit methods, and 6
new real-Service QUnit methods. Three new barriers each execute 100 deterministic
iterations. The existing expired-session case also passed its unchanged invalid
result with added zero-GET/zero-extra-clear assertions; it is not a seventh new
case. A separate Chromium loopback check verified the real locked Fetch
adapter's omitted-credentials and ordinary same-origin Cookie behavior without
calling the platform. Required CodeQL passed with zero new results.

Producer `57b5370d9c7bf9fdd7de5907da4dd3c29c963005` and normal PR257
merge/tag target `ecb68f91234da891dcf59cf60c4d47242ea6a058` share tested tree
`91afcfc17d9cd85da786e68b1f3f03226b27c649`. Original artifact `13438647735`
has SHA256 `276b3b9283aea67074cd28d04f1285a325d210114136d711f71038d65be2ec07`.
Archive SLSA and runtime CycloneDX attestations passed. Publication reused the
original CI bytes; all thirteen public assets passed anonymous byte-count and
SHA256 readback, and immutable native-release crypto verified thirteen asset
subjects plus the signed tag. See the
[release metadata](https://github.com/PastureStack/web-console/releases/download/1.6.211/web211-release-metadata.json)
and [published release note](docs/releases/web-console-1.6.211.md).

Bridge 0.2.13 contains 45 Git source files, 46 manifest rows and 47 ZIP entries.
Its actual SDK1.32.2 handshake passed. The unchanged 92-component/95-location
graph carries the published 0.2.5 clean-install evidence; there was no new
install or dependency scan. The immutable archive preserves its source-time
README snapshot; current repository instructions are authoritative. Matching
Engine 0.183.372 is unchanged, its workflow SLSA remains not provided, and runtime
SBOM coverage remains incomplete.

Designated Server acceptance of this session change, Project/LB native cases,
new weak-model subcases and the 52 new audit-block layouts remain separate and
pending. Component publication is not whole-family/243-group completion.

## Web Console 1.6.210 / bridge 0.2.12 published

Matching published Engine 0.183.372 supports human-approved name/description
updates for the currently selected Project and load balancers. Other visible
Projects remain queryable; editing requires a normal context switch and a fresh
opaque reference. Project members, networking, authentication and templates are
unchanged. Load-balancer updates retain the native Service owner, canonical
service-resource Key scopes and separately authorized Stack context; ports,
backend links, certificates, scaling and lifecycle are outside this subset.

The explicit local Bridge writer creates a new private profile without replacing
the original. It captures a stable native Project ID and bounded opaque UUID
behind the human choice. Restart revalidates the exact identity; hidden, removed
or replaced Projects fail closed without a name fallback. Legacy profiles retain
existing query and description behavior; permanent rename requires normal setup.

Optional setup detail is sent only after the original audit ACK advertises it.
The Key audit UI labels client reports as client reports, with NOT_EVALUATED
kept distinct from backend authorization decisions. This detail also requires
the Server571 broker projection. Verified operation results remain successful
when a bounded Project-label refresh needs read-only recovery; business actions
are not reapplied.

Original full/enabled CI
[42038620043](https://github.com/PastureStack/web-console/actions/runs/42038620043)
passed 1,134 browser tests with zero failures or skips. All 44 focused methods
ran once on this producer: Project 8 Node/2 QUnit, profile/audit/writer 27 Node/2
QUnit, and load-balancer metadata 4 Node/1 QUnit. Required native CodeQL passed
with zero results and aggregator annotations. The original archive SLSA and
runtime CycloneDX attestations passed. Artifact `13419872841` has SHA256
`d4623cc72707bd543096967c495f5550d89054dd6566d512e3f5c8c27dfd64d3`;
the release reused those original bytes without rebuilding.

Producer `23f2bbd3d820ab681771599248dc8b3d9fab5786` and normal PR255
merge/tag target `345f179e24c986a2a5bf2d5ab11796a5ccfbf8da` share tested tree
`ecd1017aa921e62802ff401795e7021685fd0c58`. All thirteen public assets passed
anonymous byte-count/SHA256 readback, and the immutable native release
attestation verified thirteen asset subjects plus its signed tag. See the
[release metadata](https://github.com/PastureStack/web-console/releases/download/1.6.210/web210-release-metadata.json)
and [published release note](docs/releases/web-console-1.6.210.md).

Bridge 0.2.12 contains 45 Git source files, 46 manifest rows and 47 ZIP entries.
The 92-component/95-location SDK1.32.2 graph is unchanged. Its new actual SDK
handshake passed; clean-install evidence is carried from 0.2.5, without a new
install or dependency scan. Runtime SBOM coverage remains incomplete. Engine372
provides no workflow SLSA attestation, and none is inferred.

Project7, LB7, new weak-model subcases and the 52 new audit-block layouts remain
pending designated runtime acceptance. Publication does not establish Server571
acceptance or whole-family/243-group completion.

## Web Console 1.6.209 / bridge 0.2.11 published

Matching Engine 0.183.370 adds human-reviewed Host name/description plans and
bounded Host workload detail. Host infrastructure, credentials, evacuation,
deactivation and scheduling remain normal human workflows. Browser and stdio
Host reads use the same typed owner. At most fifty currently readable container
references are returned; completeness is always unknown.

Host and existing Volume reads resolve optional Stack names through the native
Service relation when the container's persisted direct Stack is absent and the
current role schema permits that relation. Service and Stack each require fresh
native/Key authorization. Multiple, hidden or changed relationships remain
unknown, without candidate IDs/counts. Empty results do not establish safe
removal. Opaque references retain their captured context.

Service-search guidance accepts only returned opaque Stack references, or a
query-only search with readable Stack names. It does not relax reference format,
roles, Key scope or native permission checks. The twelve tools and protocol 1.0
remain unchanged.

Original full/enabled CI
[41958050589](https://github.com/PastureStack/web-console/actions/runs/41958050589)
passed 1,129 browser tests with zero failures, including retained scopes.
The six Host metadata, three Host workload and three Stack-reference guidance
Node cases and required CodeQL passed. Original archive provenance and runtime
SBOM attestations, exact artifact qualification, anonymous byte-count/SHA256
readback of all thirteen public assets and native release attestation passed.
Producer `caf5e8e9be78c89cacbdbf11891be1ed21772f89` and normal PR252
merge/tag source `13a9432e1559b5e3f4d1a4c1a0cdda2e2ea4007b` share tested tree
`6ba4a59811704da11e5bc1f18c288689a0d46250`. See the
[release metadata](https://github.com/PastureStack/web-console/releases/download/1.6.209/web209-release-metadata.json)
and [published release note](docs/releases/web-console-1.6.209.md).

Bridge 0.2.11 contains 39 Git source files in 41 ZIP entries and retains the
92-component dependency graph across 95 installed locations. Its current
version/tool SDK handshake passed. Clean-install evidence is carried from
published 0.2.5; no new install or dependency scan is claimed. Matching Engine
0.183.370 is published. Designated Server569 and new Host runtime acceptance
remain separate and pending; whole-family/243-group completion is not claimed.

## Web Console 1.6.207 / bridge 0.2.9 published

External Service create accepts a closed TCP `healthCheck`: required `port`
(1–65535) and optional positive integer `interval`, `responseTimeout`,
`healthyThreshold` and `unhealthyThreshold`. Timing values must fit a Java
Integer; this is the typed adapter's exact subset, not a native timing default
or product maximum. Omission retains no health check. HTTP request lines,
custom headers, strategies and unknown fields are rejected rather than silently
removed. Native `healthCheck` remains a top-level External Service field.
Matching Engine 0.183.368 support is required; older servers must not receive a
weaker retry. Ordinary External Service forms and existing update operations
retain their native behavior.

Service/container create review resolves the Stack label from the authorized
store using the exact captured project and Stack identity. An uncached Stack
uses the existing authorized object read; pending/error/retry states cannot
enable confirmation. Ember ArrayProxy and normal arrays are both supported.
Untrusted display labels and raw resource IDs are not substituted as names.
Approval, immutable plan data, actor/Key checks and context ownership are
unchanged.

Human audit details accept omitted, already-decoded and non-JSON values without
blocking the dialog. Missing/unavailable contents have explicit localized
messages; plain text uses escaped rendering, while valid JSON retains the
existing code display. Request and response are formatted independently and
update when the selected record changes. This does not fetch additional data
or change audit payload permissions or the AI metadata-only boundary.

The component is published. The twelve tool names/protocol `1.0` and bridge
dependency graph are unchanged.
The UI build graph converges affected minimatch 8/9 callers to the compatible
10.2.6 API and applies the pinned official 11.0.1 preprocessing fix at source
build time. The glob wrapper uses its upstream raw entry so its external
matcher receives the same fix. Local build entries verify patched bytes before
loading plugins. SBOM keeps the real npm identity and records the backport;
raw vulnerability reports remain unchanged. The original CI audit retains 49
Moderate and zero High/Critical findings; SBOM coverage remains incomplete.

Original full/enabled CI [41914388958](https://github.com/PastureStack/web-console/actions/runs/41914388958)
and native CodeQL [41914393313](https://github.com/PastureStack/web-console/actions/runs/41914393313)
passed. The 1,127 browser tests have zero failures and include the five new
modal QUnit cases; four new formatter Node cases also passed. The CodeQL
aggregator has zero annotations. Both original archive provenance and runtime
SBOM cryptographic attestations, exact artifact/SBOM qualification and actual
anonymous byte-count/SHA256 verification of all 13 public assets passed.
Producer `e3f8fbe872d91df6837d5de3339a0efde645ac74` and normal PR247
squash/tag source `00855544be1da90d8de63a823b437e2140b29c4e` share tested tree
`11fde8f7eff0861eaf06a0357edc649b1caffb2c`. Public asset digests and the
precise backport/SBOM boundary are in the
[release metadata](https://github.com/PastureStack/web-console/releases/download/1.6.207/web207-release-metadata.json)
and [release note](docs/releases/web-console-1.6.207.md).

Bridge 0.2.9 contains 35 exact source files in 37 entries and a 92-component
SBOM. Its unchanged dependency graph carries the published 0.2.5 clean-install
evidence; no new install or dependency scan is claimed. A new real SDK stdio
handshake verified version 0.2.9 and the twelve tools. The immutable ZIP keeps
its producer-snapshot README; the repository's current bridge README is the
installation authority. Matching Engine 0.183.368 is published and its exact
source contracts passed. Its native release attestation is verified; its
workflow did not provide SLSA provenance, and none is inferred.

Existing focused TCP source results are carried; the Stack collection-shape
regression retains its original failure and four affected passing cases.
Server assembly and designated runtime/permission/UI/cleanup acceptance remain
separate. Component publication does not establish Server567 or native Audit
Case12 acceptance. Full 243-group coverage is not complete.

## Web Console 1.6.206 / bridge 0.2.8 published

The existing image-upgrade tool accepts optional `startFirst`, `batchSize` and
`intervalMillis`, using native defaults false/1/2000. Batch size is at least 1;
the interval is at least 100 milliseconds. Integers are bounded by JSON's exact
safe-integer range, not a native product maximum. Engine367 must return all
effective values in a closed `upgradeStrategy` for the exact human review.
Requested settings are never dropped for older servers. Omitted fields retain
legacy image-only compatibility.

The approved image, target path and strategy stay bound through confirmation,
apply and operation reads. A mismatched response after apply remains unknown
under the same operation reference. Ordinary service upgrade UI, primary and
secondary launch configurations, native port/volume preflight and readiness/
cleanup verification retain their existing owners. No new tools or raw native
configuration input is added; command protocol remains `1.0`.

Original full/enabled CI and CodeQL passed: 1,122 browser tests with zero
failures and 9 distinct new source cases (4 command, 2 human UI, 1 bridge,
1 label and 1 contract). Thirteen-locale label parameters do not add unique
cases. Original archive/manifest/SBOM qualification, both cryptographic
attestations and actual anonymous byte-count/SHA256 readback of all 13 public
assets passed. Producer `d890c430f5c6e72578b1585d1ccc11103bc47bfe` and tag
source `dff010676392cb77a7bcc3a1ca72b3a915407ce8` share tested tree
`f9fb88c00c5846115ad8dfd7cc7964bcc40ce50b`.

Bridge 0.2.8 contains 35 exact-Git source files in 37 archive entries. Its
92-component dependency graph is unchanged from published 0.2.5 except root
version. Prior clean-install, dependency and SDK-handshake evidence is carried;
no new bridge install, dependency scan or SDK handshake is claimed.

Matching Engine 0.183.367 is published. At component publication QA125/8080
still runs Server565; Server566 assembly/runtime, designated role/Key, cross-ID,
human-dialog layout, weak-model and cleanup acceptance remain pending. Full
243-group coverage remains in progress. See the
[published release note](docs/releases/web-console-1.6.206.md).

## Web Console 1.6.205 / bridge 0.2.7 historical published baseline

Service create adds native PortSpec strings and a closed health-check object to
the existing typed resource-change plan. Matching Engine 0.183.366 support is
required; older servers must not be assumed to support these fields. Services
use bridge networking and `startOnCreate: false`. Native validation retains
automatic public-port allocation, IPv4/IPv6 bindings and the 64-entry limit.

Approval binds the exact reviewed settings. Verified `executionResult.assignedPorts`
is read-only output and does not replace or amend approved changes. Browser and
stdio share these sources and retain command protocol version `1.0`.

Original full/enabled CI and CodeQL passed, including 1,122 Ember tests with zero
failures and 12 distinct new source cases: 9 Service create, 2 human UI chain and
1 review-label cases. Thirteen locales and the inherited layout case's 96 parameter
combinations are not additional unique tests. Original archive/manifest/SBOM
qualification and actual anonymous readback of all 13 assets passed.

Producer `931562ac0302b0406c5c2b44ec7a0f94307e5b2e` and numeric tag source
`ac928a5db556315f87abd3ffc213630aa7049d1f` share tested tree
`ea359bababf5ed9270e88149bbfa789ba2b54d85`. Bridge 0.2.7 has fresh exact-Git
sources and a fresh 92-component lock-only SBOM; unchanged dependency,
clean-install and SDK evidence is carried from published 0.2.5. No new bridge
install, dependency scan or SDK handshake is claimed.

Matching Engine 0.183.366 and Compose 0.14.41 are published components;
Server565 assembly/runtime and designated role/Key, cross-ID, weak-model and
cleanup acceptance remain pending. Full 243-group coverage remains in progress.
See the [published release note](docs/releases/web-console-1.6.205.md).

## Web Console 1.6.204 / bridge 0.2.6 historical published baseline

Audit admission preserves known 401/403 and verified Key-revision failures with
safe corrective guidance. It still requires a durable start ACK before any
business request. Infrastructure failures and invalid ACKs fail closed; an ACK
failure after a possible write remains UNKNOWN_RESULT without a second write.
Browser and stdio use the same command engine and public error contract.

Original full/enabled CI and CodeQL passed: 1,122 Ember tests / zero failures,
five new audit-admission source cases (four browser command cases and one actual
bridge-core case). The 22 inherited 203 source cases comprise restricted-Key4,
confirmation6, npm12 normalization10, reminder1 and layout-QUnit1. All 35
collaboration source names and the 29 inherited npm-policy cases were freshly
observed. One layout QUnit covers 96 parameter
combinations, not 96 unique tests; four compiled modules and four theme CSS
assets are archive-bound. The final CI audit retains 62 Moderate and zero
High/Critical findings. The official follow-redirects 1.16.2 fix remains present.

All 13 published assets passed actual anonymous GET, byte-count and SHA256
verification. Producer `64caa55d0b0768de1633549b54a169ddb62c9194` and tag source
`da24369ea12455d38f7dc63aef906eed5e38ffea` share the qualified tree. Bridge 0.2.6
contains fresh exact-Git sources and a fresh 92-component SBOM; dependency
components and edges match published 0.2.5 except root version. Prior 0.2.5
dependency/clean-install/SDK evidence is explicitly carried. No new 0.2.6
clean install, SDK handshake or dependency scan is claimed.

Matching Engine 0.183.365 / Server 1.6.564 publication, assembly and designated
runtime acceptance remain pending. The existing Server563/Engine364 deployment
retains its own results; these component artifacts do not establish deployment
or complete Audit, role/Key/cross-ID, weak-model or all 243 groups' acceptance.
See the [published 204 note](docs/releases/web-console-1.6.204.md).

## Web Console 1.6.203 / bridge 0.2.5 historical published baseline

Adds restricted-Key discovery against the existing Engine361 typed contract.
Default discovery remains ordinary `apiKey`; use `apiKeyRestricted` explicitly.
The matching Server 1.6.562 assembly needs Engine 0.183.363 for accurate External
Service previews and the retained native ServiceIndex cleanup repair, together
with the installed audit broker. Engine363 is published; matching Server/runtime
and designated workflow acceptance remain pending.

Pending-plan and authorization reminders use the authenticated content flow,
retaining the same explicit WebMCP build ceiling and human review behavior.
They do not overlay the footer language or CLI controls; long names and review
labels wrap within the available width, including RTL and narrow layouts.

Original full/enabled CI and CodeQL passed, with 1,122 browser unit tests and zero
failures. The 35 collaboration source cases include one new reminder case; one
new QUnit layout case covers 96 parameter combinations, not 96 unique tests.
Four compiled layout modules and all four theme CSS assets were verified in the
original archive. Restricted-Key4, confirmation-error6 and npm12-normalization10
retain their classification; the existing npm-policy29 are not new cases.
The final CI audit reports 0 High, 0 Critical and 62 Moderate findings.

All 13 published assets passed actual anonymous GET, byte-count and SHA256
verification. Producer `d97a8990801a281b519573a48b0db7dd12c9a616` and tag source
`ae409b8404e946512297f00a71bdb4c141a3d5eb` share the tested tree. Documentation
commits do not replace the producer, tag or artifacts. Component publication does
not establish designated browser, role, cross-ID or weak-model runtime acceptance,
and the full 243-group inventory remains in progress. See the
[203 release note](docs/releases/web-console-1.6.203.md).

## Web Console 1.6.202 / bridge 0.2.4 historical published baseline

The matching typed workflows require Engine 0.183.361 and the installed audit
broker. Certificate changes accept only name and description; PEM, private keys,
chains and lifecycle management remain human-only. External Service and DNS
Alias workflows retain their separate, human-approved create and target-binding
plans. Raw audit payloads and caller credential substitution remain prohibited.
Normal UI, Full/legacy permissions, session, Catalog and Archive behavior remain.

Required component CI/CodeQL, original archive/SBOM verification and anonymous
readback of all 13 published assets passed. The original producer is
`3350a566b77c46ccf3686975bdcc8d9c14ee2985`; tag/merged source
`1b426175a55fd63260466cacd02e962e1bd44f8f` has the same tested tree.
The original CI reports 1,121 browser unit tests with zero failures. Documentation
commits do not replace that producer or rebuild its artifacts.

Matching Engine/Server publication and designated combined browser, role,
cross-ID, layout and weak-model acceptance are separate pending gates. Existing
baseline health and component tests do not establish full runtime acceptance.
See the [published release note](docs/releases/web-console-1.6.202.md).

## Web Console 1.6.195

Adds archive-bound browser and build CycloneDX SBOMs, isolated production and
separate host/container Ruby inventories. Official body-parser 2.4.0, fast-uri
3.1.9 and serialize-javascript 7.1.3 patches update build/serve inputs; the old
live-reload raw-body pin is parent-scoped, not forced onto modern body-parser.
Node.js 24.22.1, npm 12.0.2, application code,
13 locales, API, permission and authentication contracts remain unchanged.
Source module inventories and the released archive are checked together; a full
lockfile is build evidence, not proof that every package reaches the browser.
Existing acceptance results unaffected by these packaging-only changes retain
their original scope. Publication and Server integration have separate evidence.

## Web Console 1.6.194 published

The release uses the official Node.js 24.22.1 security release, retaining
npm 12.0.2 and the existing browser dependency graph. Python 3.14.9, pip 26.2.2,
and certifi 2026.10.19 are CI-only verification tools. The static archive layout,
API contracts, and all 13 locales retain the 1.6.193 compatibility contract.
The original CI archive is published with a verified SHA-256; see the
[release note](docs/releases/web-console-1.6.194.md). Server integration and
unrelated resource/role acceptance remain separate evidence.

## Web Console 1.6.193 published

Service upgrades wait for and invoke the upgrade action without a preceding
generic save of the service clone. The shared validation, completion lifecycle,
selected launch configurations and non-upgrade persistence remain in place.
Validation and publication status are tracked in the
[193 release note](docs/releases/web-console-1.6.193.md).
This release pins official `follow-redirects` `1.16.1` and `markdown-it`
`14.3.3` patches, with focused redirect and Markdown compatibility checks.
Full original CI passed all 1,104 browser tests with zero skips and produced
two byte-identical archives. All 2,519 missing translations in 11 locales are
complete, with existing values and ICU contracts preserved. Published producer
`fa7fd399e3aef2a67282e8fbbe9f3fc83002710d` and artifact checksums remain immutable;
later documentation commits do not replace them.

## Web Console 1.6.192 published

Host disk summaries and details select the same valid filesystem or legacy mount
data. Missing or invalid capacity remains unknown; a reported zero remains zero.
The separate available-local-storage field is not used as total disk capacity.
No API, RBAC, session, OIDC, MFA or dependency graph changed. Eight focused native
Chrome Host model tests, required CodeQL and reproducible production packaging
passed. See the [192 release note](docs/releases/web-console-1.6.192.md) for exact
producer and artifact identities. This is not whole-matrix acceptance.

## Web Console 1.6.191 historical published baseline

Handlebars `4.7.10` and fast-uri `3.1.8` use official security fixes. Both the
release lock and active Node 24 test baseline resolve the same dependency graph.
The supported build remains Node `24.22.1` / npm `12.0.2`; Ember/Glimmer,
authentication and API contracts are unchanged. Focused release tests,
publication identity and the unresolved build-input findings are maintained in the
[191 release note](docs/releases/web-console-1.6.191.md).

The immutable [1.6.191 release](https://github.com/PastureStack/web-console/releases/tag/1.6.191)
binds producer `1452148e0ca2c0dc798dc08a653eb90196d4f88b`. Protected PR #213
merged as `2405dfe5310f50e149550ee2f8f8fa55fff85c66`, with the same tested tree
`c2b98b05f8da5cf4a8acaa2e630150ec92acd2ad`; later documentation commits do not
replace this producer. The original `web-console-1.6.191.tar.gz` is 3,037,180 bytes,
SHA-256 `f9b28c25ae27057ae39e55fb29400b8ac459e07632a441eea011591f305950ab`.

[CI 39356413277](https://github.com/PastureStack/web-console/actions/runs/39356413277)
passed 36 focused Node tests, four native Chrome template tests, actual browser
module inventories and two byte-identical production archives. The raw build
audit retains 29 Moderate, 7 High and 0 Critical findings; the exact seven-node
build-only braces closure has no official fix and is reviewed until
2026-10-27 00:00 UTC. Expiry and reachability checks remain fail-closed.
This is scoped component evidence; Server packaging, deployment and the full
historical acceptance matrix retain their separate status.

## Web Console 1.6.190 historical published baseline

Web Console `1.6.190` adds opt-in archive visibility, archive/restore confirmation
and archived-state display using the server's existing schema capabilities.
The server remains authoritative for permissions, stopped-workload eligibility
and lifecycle/association guards. The Server `v1.6.537` assembly pairs this
component with Engine `v0.183.350`. Server publication and health evidence are
maintained separately in
[its release notes](https://github.com/PastureStack/server/blob/main/docs/releases/server-1.6.537.md).
Exact component identities are recorded in the
[190 release note](docs/releases/web-console-1.6.190.md).

The immutable producer is `9ff823c2233e2041c2f00bb56a91d147a7feaa1d`.
`web-console-1.6.190.tar.gz` is 3,032,851 bytes, SHA-256
`b06612812113fb4b54cf0f2b4754af077406306fd72407e04b17f2ad9f4dc927`.
The fresh production build and versioned static archive checks passed. The 37
focused logical cases retain their original and affected-case rerun evidence;
they are not 37 new invocations for this release. Documentation changes do not
replace the producer or expand the verified runtime scope.

## Web Console 1.6.189 published

Immutable Web producer: `f30f5e81dd9ee25878c3aff681eed5bb61883453`. `web-console-1.6.189.tar.gz` is 3,024,592 bytes, SHA-256 `1c90e273b7db8ebf9d851a0ae1ec49dc59067b5ee1099ea3886919c1a79ccdfc`. Official publication and anonymous readback passed; later documentation commits do not replace this producer.

Published Server `v1.6.534` packages this component with unchanged Engine `v0.183.348`. Native non-bubbling tooltip listeners join the run loop and are removed on destruction. The step-circle background has an explicit LTR anchor mirrored by the RTL compiler. Existing action-menu overrides, static context forwarding, registration APIs and permissions are preserved.

Six new focused CSS cases passed for the exact shared step-list change, SVG geometry, generated LTR/RTL background and number alignment, both themes and version identities. Four actual-DOM cases added and passed on Web 188 are carried for native hover/leave, real static tooltip content, feedback success/failure, listener cleanup after destruction, action-menu overrides and host registration copy. The earlier thirteen clipboard/host cases and one corrected-caption rerun retain their original evidence; they were not replayed. The unchanged 32-key resource contract across 13 locales is carried from the same translation sources, not presented as a new resource run.

The final 52-case matrix covers 13 locales, 1440px/390px widths and light/dark themes: 44 unaffected Web 188 results are carried, and eight fa-ir/en-us views were newly run on Web 189 after the step-circle RTL fix. These are not 52 new Web 189 runs. A separate ordinary-HTTP native copy was newly verified on Web 189 with the Clipboard API absent. Clipboard payloads matched exactly. Permission rejection was an explicit denial fixture, distinct from the real HTTP fallback. Preferences, presentation and clipboard were restored; page errors, missing translations and unexpected resource writes were zero.

Focused acceptance does not complete the broader role/backend/lifecycle matrix; historical HOLDs and deferred KVM cases retain their status. See the [release note](docs/releases/web-console-1.6.189.md).

## Web Console 1.6.186 published

Published [1.6.186](docs/releases/web-console-1.6.186.md) displays native machine
driver names in shared cards while preserving catalog localization, formatting,
and intentional empty names. Driver records, IDs, initialization and action
targets retain their existing contracts. The personal API Key page and host
onboarding remain available.

The immutable producer is `236973cb28dd7600a697902e3e3445b1a210a87a`.
The published `web-console-1.6.186.tar.gz` has SHA-256
`95b319150d75b927b5474400129eee43eeec181a86c5b6d5065d44815df3da76`.
Official component publication and immutable readback are complete; documentation
commits do not replace this artifact identity. Published Server `v1.6.531`
packages this component with Engine `v0.183.348`.

Four focused Chrome rendered cases passed with native models, compiled English
and Traditional Chinese translations, and a 320px card container. Native Chrome
154.0.8037.98 acceptance used the published Server 531/Web 186 product: eleven
distinct driver IDs and names matched both API roots, and all names remained
visible in zh-tw/en-us at 1440px and 390px. Four generic icons represented
distinct records; a Server restart preserved the exact IDs and names. Page errors
were zero, and all five screenshots were visually reviewed.

The paired Server also passed existing-Default repair, fresh first-host readiness,
resilience, deployment and restart qualification. Narrow affected-path acceptance
completed with the existing host defaults and unchanged role logic; broader
role/backend matrices are outside this verification.

## Web Console 1.6.184 published

Published [1.6.184](docs/releases/web-console-1.6.184.md) labels event subscriptions
in API Key audit, including completion records without a target ID. Actual
terminal outcomes and the existing safe unknown-reason fallback are preserved;
no resource-picker, grant, authentication or stylesheet behavior is added.
Three focused Chrome unit tests passed, including actual compiled labels in all
thirteen production locales. Native Server acceptance remains separate.

The immutable component producer is `c41fcf05b42f648d6a7e3859285b95c07b4dd40d`.
The anonymously read-back `web-console-1.6.184.tar.gz` is 3,016,500 bytes, SHA-256
`a374e6eed0ad8daec785cc3ba833e6219d46ffd23ead77d2fd720aed5d5d52f9`.
Documentation-only commits do not replace this published component identity.

Published Server `v1.6.529` packages this component with Engine `0.183.347`.
Official assembly, immutable readback and thirty-six focused native subscription
cases passed; isolated deployment is separately verified. Neither component publication
nor focused UI tests establish complete permission-matrix or active-agent coverage.

## Web Console 1.6.183 published

Published `1.6.183` retains the shared native-click clipboard fix from `1.6.182`
and restores add-host Close/Back dispatch and the external return target across
driver redirects and API-host settings refresh. Audit row copy and details remain
separate actions. Onboarding follows the actual submission path: RegistrationToken
POST for Custom, Host POST for built-in/Other forms; Machine API POST alone grants
neither form. Backend authorization remains authoritative. See the
[release note](docs/releases/web-console-1.6.183.md) for archive identity, checksums
and focused validation.

The published component producer is
`e056a0111d20816742eff17a65dfabb5d003dae2`; documentation-only main commits do not
replace this released component identity.

Published Server `v1.6.528` packages this same Web Console `1.6.183` component with
Engine `0.183.346`. Official assembly, 16 scoped native Link/Container reads and
separate isolated QA upgrade/restart were verified. Component publication and
focused UI checks do not establish complete
permission-matrix or active-agent lifecycle acceptance.
This documentation update changes neither Web code nor the published archive.
The versioned notes below retain their historical scope.

Published `1.6.180` forwards the explicit audit `timeScope=all` contract for both
list/poll and JSON/XLSX export. It requires Server v1.6.518's matching broker
support. Explicit dates still bound the query; unset scope retains the default
24-hour window. Permission filtering, pagination, scan caps and record retention
remain backend-owned. See the [release note](docs/releases/web-console-1.6.180.md).
Component publication does not establish Server assembly or paired deployment
acceptance.

Web Console preserves compatible API paths, schema and resource names, action names, setting keys, authentication routes, catalog fields, orchestration framework identifiers, generated model properties, and server-provided links.

Visible branding, product-owned assets, icon identifiers, package metadata, and operator documentation use PastureStack. Historical identifiers remain only where they are server data or protocol contracts and must not be mechanically replaced.

Published `1.6.178` handles only the exact `inactive` environment state specially,
after global project and member authorization succeeds. Network and
policy-manager values remain unavailable (`null`), with a state-specific
localized explanation; they are not invented empty resource collections.
Project metadata, membership and removal capabilities remain sourced from the
API. A stale editable network cannot be persisted from that inactive form.
All other states retain the existing scoped reads and error semantics. Backend
authorization, session generation/mutex, MFA, OIDC, workspace lifecycle and
dependencies are unchanged. Formal CI 37273270200 passed 848/848 tests, including
seven inactive-project and seventeen retained ended-workspace regressions.
Both build archives and anonymous immutable download match SHA256
`7d4476f3ae1ecd455d0de25008b62327d8c2fa02fafe2b5252ce79fb3309d981` (2,983,001 bytes).
Numeric lightweight tag `1.6.178` binds signed source
`60a494e943150ecd300d1aa653ee397f590b575b`; the tag itself is not signed.
Normal PR #177 merge `f8ac3e2bf5854ab854adc1062321bcc16e29d224` has the same
reviewed tree and a verified signature. Published Server `v1.6.516` packages this
exact component; public artifact readback and separate isolated QA deployment
passed. First start/restart each reached HTTP 200/pong after ten bounded probes;
runtime settings and five core-table counts are unchanged. AppArmor, three named
volumes and `unless-stopped` remain; Docker health is null, not healthy.
One inactive-environment native detail/reload, edit/remove cancellation and
DELETE/list-reload absence were observed. The parent cleanup timeout remains
HOLD. A separate read-only database observation confirmed the environment and
four networks were purged, with no remaining members or dependent resources.
Fresh API and complete foreign-data preservation verification remain incomplete;
this is not full native lifecycle PASS.
No company-site deployment is claimed; historical HOLDs and the INCOMPLETE full
matrix remain unchanged. See the [release note](docs/releases/web-console-1.6.178.md).

Published `1.6.177` treats an ended workspace entry as terminal across both logs
and terminal components. Late responses and queued socket/timer callbacks are
bound to the original entry, never an explicitly opened replacement. Existing
API payloads, broker authentication, session generation/mutex, authorization,
MFA and stored entry format are unchanged. Dependencies are unchanged; only
root release-version metadata and its reviewed baseline pins change. Seventeen
targeted component regressions passed within formal CI 37255121243's 841 tests.
The numeric lightweight tag binds signed source commit
`b9b841e65afe1d89a5b03ac767e9168bccd3c3ea`; it is not a signed tag.
Normal PR #175 merge `5d150806be20226657e5caa8a0150d068006c772` has the same reviewed tree
and a verified signature. Both CI archives and anonymous public readback match SHA256
`4e34eb2b3165f078134cddcf1721239b3da7baf11dd683991b2d6aa5bae944e0` (2,982,494 bytes).
Published Server 515 packages this component, from source
`f0267ff3a347ea526088db1749b1d3c8dfd9bd37` and immutable manifest
`sha256:fcc79f616927040ef2b3a5c58662fa948823220dbc57ffe275dee2ad88764d47`;
official artifact/runtime/security readback passed. Separate isolated Server 515 / Web 177
deployment/readback passed: initial-start and restart polling reached HTTP 200/pong
after 10 and 11 attempts, respectively, with unchanged runtime configuration,
environment overrides, three named volumes and five core-table counts.
`docker-default`, `unless-stopped`, database backup
and 514 rollback remain. No Docker Healthcheck exists; running/pong is not Docker
healthy. Deployed native lifecycle acceptance remains pending. The full matrix
remains INCOMPLETE and historical HOLDs are unchanged. A separate fresh Project v2
native run remains HOLD after a successful deactivate response and a UI wait timeout;
native removal and database cleanup are incomplete. See the
[release note](docs/releases/web-console-1.6.177.md).

Published `1.6.176` preserves native `mut` setters by composing `action` with
`fn (mut ...)` in the same 21 existing select bindings. The classic helper's
event `target.value` conversion is unchanged. Model identities, selected-row
references, schema choices, member capability checks, metadata/network writes,
save ownership/finalizers, API payload contracts and authentication are unchanged.
The shared compatibility helper and dependency graph are unchanged. Exact-source
CI37175725533 passed 824/824 tests with zero failures, skips or todo, including
32 targeted cases (29 retained and three new native-mut regressions). Signed
numeric publication and anonymous public downloads reuse both byte-identical CI
archives: source `a1bbf172aad8443bfbb1859760d62669d6705189`, tree
`dfa280c29e241bb815eff852e8a188c101e338eb`, archive SHA256
`071ce0b7091b323e0d84fe91269684f59fcf2e29000bd8ff94428e8dd03ece52`.
Thirteen packaged locales and source gates passed; static absence of affected
build-package modules does not establish runtime not-affected or zero CVEs.
The build audit remains 7 High / 3 Moderate; the existing reviewed
`GHSA-vfj7-8cjw-p6xm` vendor-pending boundary ends 2026-10-10. Published Server514
packages Web176 and Catalog Service 0.20.12 and is deployed on the isolated QA
site. Network service edit/cleanup and completion of an existing catalog upgrade
have separate scoped results. Container denials for readonly callers and callers
without access to the target environment were verified separately. Owner native
start/restart, log/terminal output and termination, and delete confirmation
completion were observed in separate runs. Independent read-only queries found
all seven owned records terminal (removed or purged). This cleanup observation
does not establish full historical data-protection or lifecycle PASS.
Environment lifecycle screens and owned-data
cleanup have separate observations, not complete historical-protection acceptance.
Original incomplete results and all historical HOLDs remain immutable.
The full matrix remains INCOMPLETE; isolated QA is not production acceptance.
See the [release note](docs/releases/web-console-1.6.176.md).

Published `1.6.175` refreshes only the image form's locally owned validation
aggregate after image/locale correction. Other validation errors and backend
save failures are preserved; shared NewOrEdit ownership, hook/finalizer behavior,
wire payloads, schema and authorization remain unchanged. Four new real-component
tests passed within 821/821 exact-source CI tests (37163340764), with zero
failures, skips or todo. Signed numeric publication and anonymous downloads
reuse the byte-identical formal builds: source
`bb905d092700c262497b88f5773e7714fc1f4be4`, archive SHA256
`9833467b2be47d4fa01f09954fcd35beb292c59d382d5c1aecd76d17c6a387a2`.
Server packaging and deployed UI acceptance remain pending. No dependency
version or graph change is introduced; the full matrix remains INCOMPLETE.
See the [release note](docs/releases/web-console-1.6.175.md).

Published `1.6.174` changes VM image guidance and defaults only: it does not
implement a VM runtime or image whitelist. Existing/custom/last-used VM images,
ordinary container defaults and required validation remain supported. Shared
image-required errors are localized in English and Traditional Chinese, with
the existing English fallback for other locales. Backend capabilities,
payloads, permissions and authentication contracts are unchanged; dependency
versions and the graph are unchanged. Exact-source CI37152802665 passed
817/817 tests with zero failures, skips or todo. Signed source
`d24b7f4e164f058e3ef9057347caa2080e2b5407`, both CI builds and anonymous public
downloads match archive SHA256
`6408775898f412e4b27092eeddd9cdc2028ad7b27835f489139c2d0cf62c6776`.
Server512 packaging and QA512 image-form-only acceptance are verified separately;
VM boot is not verified and the parent validation-message defect remains pending
deployment of the published Web175 component. Historical HOLDs are not promoted. The full
matrix remains INCOMPLETE. See the [release note](docs/releases/web-console-1.6.174.md).

Published `1.6.173` reads native ProjectTemplate card labels from the model's
existing `name`, not `localizedName`, which native ProjectTemplate does not implement.
Name-dependent sorting, rename reactivity and exact-ID selection remain native;
Catalog localization, payloads, permissions, memberships and save/auth contracts
are unchanged. Four regressions and exact-source CI37115288389 passed within
812/812 tests, with zero failures, skips or todo and identical production builds.
The signed numeric release pins source `c8b8bb2659fdad3539cf6a72866c94a77ec516b6`;
anonymous public archive/checksum readback matches SHA256
`a566684e6e0831630a15cb7212989c0e9fe707ed07965156c2b664b9cdb5ba27`.
Published Server511 packages this exact Web173 and Engine333; official artifact
readback and QA125/8080 upgrade are verified, with first-start11/restart10
HTTP200/pong and unchanged runtime/DB counts. No Docker healthy is claimed;
The version-bound native Template117 read-only proof passed: three Full17/14
guards, zero resource writes and source-bound same-ID empty stacks/services;
not a native-create finalizer. Project/Host acceptance remains pending.
Fresh Project key `1c6998` is independently verified as
`DERIVED_SCOPED_KEY511_VERIFIED_NOT_ORIGINAL_PASS`: the same actual child run has
4 native writes, 13 guards, 6 cookie-free issued Basic GETs before deactivate/delete,
4 barriers and 18 first-delivery checks. The original parent QA-receipt identity-schema HOLD stays immutable;
the derived check did not rewrite receipts or replay writes. See the
[release note for evidence and limits](docs/releases/web-console-1.6.173.md).
Process native list/link/detail and same-ID direct GET passed for one current ID:
two API roots × six roles, 12/12 cells and zero resource writes. Other IDs and
write methods remain untested;
the full matrix is INCOMPLETE. See the [release note](docs/releases/web-console-1.6.173.md).

Published `1.6.172` adds opt-in first delivery of fields whose actual Schema
declares `readOnCreateOnly: true`. Only `edit-apikey` enables it. A nonenumerable
request-private callback delivers the successful create values once to a
detached clone, not to serialized metadata or canonical cache. Matching Store,
generation, API base, opaque generated ID, concrete type and owner are required;
newer subscribe state and nested-resource adoption are preserved. Other
NewOrEdit hook arguments/results and consumers retain their previous contracts.
The save owner clears its own pending delivery on success and failure; rejected
duplicates cannot clear another save's lock or values. Compatibility revision 6
is a new archive with the same dependency graph. Exact-source official validation
[37109872791](https://github.com/PastureStack/web-console/actions/runs/37109872791)
passed 808/808 tests with zero failures, skips or todo, including fourteen
installed-Store ordering cases and two save-owner cases. Both production builds
and anonymous public archive/checksum downloads match the same formal CI artifact:
SHA-256 `9a21c5e6ff9fbb274dbc7c45ec1ccffdbff33a945544b64d5976b14ee9752bfa`,
2,981,642 bytes. The signed immutable numeric
[release](https://github.com/PastureStack/web-console/releases/tag/1.6.172)
pins source `daab6e8ed5206562feb60e6549a3b9e72b4c8381`; publication reused the
CI archive without rebuilding. Separately published
[Server `v1.6.510`](https://github.com/PastureStack/server/releases/tag/v1.6.510)
packages Engine333 and this exact component. QA deployment and fresh-key native
first-delivery acceptance remain pending. Historical HOLDs are not promoted;
the complete permission/resource/locale matrix remains INCOMPLETE. See the
[release note](docs/releases/web-console-1.6.172.md).

Published `1.6.171` confines create-response adoption to ID-less POST/201 and an
existing exact-ID/concrete-type canonical model in the same Store, generation
and API base. It does not re-import stale scalar or nested create fields over
that model. The original draft-save completion identity and subtype/base aliases
remain intact. Resource IDs are not normalized. Missing schemas grant no access.
GET, PUT, action POST (including reused options), uncached creates, non-201,
204 and error paths retain normal processing. No API authorization, session,
MFA, payload, resource lifecycle or backend changes are introduced.
Revision 5 is a new archive; revision 4 is not overwritten. Focused Chrome
validation passed 36/36, including ten new cases and 100 barrier iterations;
failure, skip and todo counts are zero. Exact-source official validation
37094728912 passed 802/802 tests, including the ten create-order cases, with
zero failures, skips or todo; all 22 audit-gate selftests passed. Both production
archives and anonymous public downloads match SHA-256
`49fac41ca93eb628d0877104f9512ef382ffd9dbc89e04c940196b3a9c57798b`
and size 2,981,230 bytes. The signed immutable numeric release pins source
`fc37f5af9320e492bec7e7244cd62144908b720e`. Separate Server508 packaging and
packaged fresh-volume acceptance remain pending; historical HOLDs and the
complete permission/resource/locale matrix are not promoted.
See the [release note](docs/releases/web-console-1.6.171.md).

The live npm audit retains its Critical/High threshold. An explicit dated
vendor-pending record covers only `GHSA-vfj7-8cjw-p6xm` in the exact existing
development-only `braces@3.0.3` dependency closure, for which upstream has no
patched release. Unknown findings, changed affected nodes, runtime exposure,
audit errors and expired reviews fail closed. This is a recorded remaining High
risk, not a patched or zero-High claim; dependencies and package versions are
unchanged. See [the review record](docs/security/npm-vendor-pending.json).

Published `1.6.170` accepts null only for the optional expanded `mounts`
projection while retaining the real complete empty pool relationship and full
scoped mount-cache proof. It preserves nonempty raw ID binding, current-project
ownership, stale-proof invalidation and backend authorization. Null raw IDs and
malformed array-like objects remain excluded. No API or authentication contract
changes. Official validation 37082272427 passed 792/792 with no failure/skip/todo;
two production archives and anonymous public downloads match SHA-256
`900974b07bb20ba5b2e7c1dede7012a53c6e2c96cd094c67cb7019434c4f27c9`.
Signed tag `1.6.170` pins source `09df1480c5f4b58c6a9a9060ff94d980792f7015`.
Packaged Server507 existing-volume Store/list/refresh, write-free delete cancel,
both-root readonly denial and native owner removal passed for two isolated IDs.
Host Add entry denials passed separately for restricted, readonly and no-access
roles in Traditional Chinese and English. Fresh volume creation remains under
investigation; historical HOLDs and the complete matrix are not promoted.
See the [release note](docs/releases/web-console-1.6.170.md).

Published Web Console `1.6.169` treats Volume `externalId` as an identifier rather than an
allocation reference, matching the existing engine pre-create contract. The
field remains part of relationship-proof invalidation. Host, image, instance,
storage-pool and mount checks, current-project schema ownership, permission
notices and backend authorization are unchanged. No forced activation or
deactivation is added: an inactive unallocated volume uses its advertised remove
action. Official validation 37078265265 passed 791/791 tests with zero failures,
skips or todo, including three identifier/allocation-proof regressions, and
produced two byte-identical production archives. The signed immutable numeric
release pins source `5962f57fccb4062a65b5921646c06b4663713b9b`; anonymous
public readback matches archive SHA-256
`e2bcb97b0da810f2ff216f9738739235e3c6f29ef46f1d99b623cf9c9f7258e2`
and size 2,981,057 bytes. Server `v1.6.506` is published and deployed on QA 8080;
initial/restart checks passed with configuration and persistent volumes retained.
Its native existing-volume terminal exposed the null-projection defect above;
fresh lifecycle acceptance remains pending.
Historical HOLDs remain HOLD; the complete permission/resource/locale matrix
remains INCOMPLETE. See the [release note](docs/releases/web-console-1.6.169.md).

Published Web Console `1.6.167` normalizes only schema-cache lookup IDs, matching
the existing `_bulkAdd` producer. Mixed-case API types resolve the same cached
schema through `Resource.schema`, `canCreate`, `canList` and schema-based update
checks. Non-schema resource IDs remain case-sensitive and project stores remain
independent. Missing schemas do not grant permissions. Backend schemas, roles,
API paths, action names, authentication and lifecycle writes are unchanged.
The local API-store compatibility archive advances to revision 4 with the same
dependency graph and security thresholds. Four new actual Store/schema cases
and the local Chrome 4-test/43-assertion run passed. Official validation
37012345421 passed 772/772 tests with zero failures, skips or todo, and produced
two byte-identical production archives. The signed immutable numeric release
pins source `dff35fc4bce340e21cac7204146a7bcb20a7b60b`. Anonymous public
readback matches the formal archive SHA-256
`e8e714fc06282de75a3570aac1d4d4d04a3c9478d982d0d5aaeae14efa8ebbaf`
and size 2,976,297 bytes. Separate Server503 QA deployment passed first start
and one restart with HTTP 200/pong, preserved runtime settings and unchanged
five-table count baselines. Docker health is `null`, not `healthy`.
Separate packaged exact-fixture QA confirmed GET-only registry/credential
models, hidden create and disabled edit/remove controls for the readonly role.
The no-access role showed the environment-unavailable screen; both roles used
readable existing permission errors. All 24 normal-CSRF v1/v2-beta
write-denial checks passed. That scoped result is not all API authorization,
thirteen-locale badge or full native lifecycle acceptance; the complete matrix
remains INCOMPLETE.
See the [release note](docs/releases/web-console-1.6.167.md).

Published Web Console `1.6.166` adds the missing `Inactive` display-label
branch and its thirteen catalog translations. It does not change stored state,
API/schema, permissions, request methods, authentication, icons or colors.
Unknown states and existing health/connection overrides retain their display
contracts. Eight focused Chrome rendering tests passed 34 assertions;
official CI passed 768/768 tests and produced identical archives. The signed
immutable release pins source `b63fa15f6726cb78659ae43258dfc802b30d6d04`.
Anonymous public readback matches archive SHA-256
`9205fbaec6e80f31846212f0949c3eac0fae083f80c6c46a3122d64c4d9da6c6`.
Component publication is not Server packaging/deployment, packaged
native-browser or full-matrix acceptance.
The package bump changes only root version metadata and version-gate literals;
dependency graphs and security thresholds remain unchanged.

Published Web Console `1.6.165` changes only Host container/VM subpod layout:
names wrap in the remaining flex space, while IP and action areas do not shrink.
The full source name and existing stack-prefix display contract are preserved.
No global clipping rule, resource ID, schema, API, permission, lifecycle or
authentication behavior changes. Four focused Chrome cases and 744 assertions
passed against the actual compiled CSS. Official CI passed 767/767 tests and
produced byte-identical archives; the signed immutable release pins exact
source `00bcd9fdc92afead708dffb4a2b3b01f4ebaeaa0`. Anonymous public readback
matches the published archive SHA-256
`5baaa4879fe5548cc8b66cd1c7a2005edf586d4b5f12b6dbb3796b6692e41959`.
Packaged Server501 native initial/reload separately accepted six complete
Docker names/IDs and readable rollback suffixes. Both actual screenshots and
native menu open/close were reviewed; IP/action areas remain separate, with
zero resource writes or page/console/loading errors. This does not establish
the complete permission/resource/locale matrix, which remains INCOMPLETE.

Published Web Console `1.6.164` localizes Receiver validation labels.
Required-field and numeric errors reuse the visible labels from the Receiver,
scale-service, scale-host and service-upgrade forms. Embedded schema scopes,
model-specific translation precedence and unknown-field fallback are retained.
The existing scale minimum/maximum condition is unchanged; only its message
uses the existing numeric translation. No required, numeric or save guard,
API/schema, permission, payload or driver action changes. Focused local source
validation passed 12/12 tests and 61/61 assertions; official CI passed 763/763
including those cases and the twelve retained Web163 locale cases. Its signed
immutable numeric tag pins runtime source
`c3c0779d930d4d0367ec0517166ca21f6b3dc6d4`, not later documentation commits.
Both public files match the reviewed deterministic candidate's bytes and
checksums. Component publication does not establish Server packaging, QA or
production deployment, native packaged-browser or full-language/matrix
acceptance. Published `1.6.163`, the initial fixture failure and earlier HOLD
evidence are not overwritten.

Published Web Console `1.6.163` localizes state badges only from seven recognized
`model.displayState` labels using existing translation keys. Unknown labels and
health/connection display overrides retain their original text; a machine state
must not replace the model's display semantics. State, icons, colors, API payloads
and authorization remain unchanged. Relative dates recompute on locale changes
and use the existing language-to-Moment mapping on each instance, without
mutating the global Moment locale during formatting. Focused local source tests
passed 12/12; official CI passed 755/755 including those locale cases. Component
publication does not claim Server deployment, packaged acceptance or
full-language acceptance.

Web Console `1.6.161` preserves an existing Certificate's masked key when only
name/description are changed. Explicit update-validation options apply only to
persisted records and explicitly omitted fields; other required and supplied
value checks remain strict. The editor omits unchanged material from metadata
PUTs, without modifying authorization, storage, create or replacement contracts.
Its existing hint and key marker distinguish metadata edits from replacements.
The earlier failed native editor receipt is not promoted to a pass.

Web Console `1.6.160` recognizes the established post-authorization Certificate
in-use response (`405`, `InvalidAction`, and the known API message prefix),
showing reviewed English, Traditional Chinese or Japanese copy that explains
how to release the reference. It never renders the response's load-balancer
names. `403`, `404`, and unrecognized `405` responses remain neutral. This is
display-only; API authorization, DELETE/remove and authentication are unchanged.

The published package identity is `@pasturestack/web-console`, while the Ember 2 runtime keeps the neutral internal `ui/` module prefix used by existing imports. The static server artifact must contain a fingerprinted `/assets/ui*.js` entry and matching `index.html` reference; changing either side requires a coordinated Server packaging test.

Before release, validate login and logout, environment selection, hosts, stacks, services, containers, shell, logs, console, catalog, storage, networking, access control, settings, API errors, browser navigation, `en-US`, and `zh-TW` against an isolated compatible server.

Create and update controls must be derived from the current environment's
effective schema and project action links. Hiding a control is only a usability
boundary: direct create and upgrade routes must repeat the same POST or PUT
check before loading their forms. A project switch must invalidate cached
capability decisions. Owner, member, restricted, read-only, and no-access
behavior remains defined by the Server schema; the console must not invent a
broader role contract. Account administration obtains login identities from
`authIdentityLink` records filtered by account ID rather than assuming the
legacy account identity fields contain the current OpenID Connect principal.

In the `1.6.142` source target, ProjectTemplate edit and remove controls require
an administrator or a non-empty template `accountId` exactly matching the
authenticated session `accountId`. Missing ownership data denies editing;
`isPublic` may be omitted by field-level authorization, and neither a `remove`
action link nor type-level schema methods prove per-object write access. Direct
edit URLs repeat the ownership check before loading the catalog or cloning the
template. The Server remains the authorization authority. Closing an API-key
modal cancels its delayed input focus; a missing input is ignored and
cancellation remains write-free. Direct template edit 403/404 failures present
the same localized missing-or-denied message, while 401 retains session
recovery. A failed API-key save displays the API error in its modal without
showing newly created key values.

Direct `/env/:project_id` navigation and refresh must select that permitted
environment from the router's public RouteInfo parameters before consulting a
tab or user default. An inaccessible or inactive environment must show the
same localized missing-or-denied page for all callers, without revealing
whether its ID exists. A valid URL environment must never be silently
replaced by a saved Default preference.

When cloning a Receiver, preserve editable configuration but omit the old
server-issued webhook URL and lifecycle state from the new resource payload.
The Server must issue a fresh URL. Container list actions stay inside their
horizontal scroll host while data columns keep their current widths; fixed
and normal header positions must agree in LTR and RTL layouts.

When creating a private ProjectTemplate from Default, copy only editable stack
content into a new record. Do not send the Default template's created timestamp,
lifecycle state, ID, UUID, or external catalog identity. Editing the new stacks
must not mutate the in-memory Default template.
The shared new-resource clone helpers apply the same top-level lifecycle
boundary to other create flows, without changing existing-resource edit or
upgrade requests. Receiver clone forms clear every inactive driver config,
including the API-only `forwardPost` type; that unsupported source type must
not open a saveable clone form.

The generic OpenID Connect interface depends on the authentication service
publishing `oidcconfig` and the staged `POST /v1-auth/redirectUrl` contract.
Configuration validation and the first real provider sign-in do not replace
the active authentication method. Activation uses a fresh authorization code
and the normal platform token endpoint; an authorization code is never reused.
The Web Console stores PKCE verifier, state, and nonce only for the active
browser flow and clears them after completion or failure.

Authentication errors may arrive either as a transport wrapper or as a
top-level structured rejection. Both forms must retain the stable error code
and the operation-bound MFA request digest; malformed digests never trigger a
confirmation retry. Load-balancer target selectors use explicit one-way data
flow back to the owning `PortRule.serviceId`, and the resource serializer must
carry that value in editing PUT requests. API hydration remains authoritative
over local model defaults, including nullable health states.

Same-origin tabs coordinate login commit, session adoption, and explicit logout
through one mutex. A peer must read both the cookie and the non-sensitive
generation only after it owns that mutex, validate `GET /token`, and recover on
the login route if a storage or `BroadcastChannel` notification was missed.
Passive 401, 403, WebSocket, timer, storage, and route errors must never invoke
server-side logout; only a user action may issue the generation-bound DELETE.
The current-token collection is authenticated only when its first token carries
a non-empty `accountId`, `user`, or `userIdentity`. A provider login-options
object returned with HTTP 200 and no identity is an unauthenticated response,
not a session. The console converts it to its stable local 401 contract and may
clear shared state only while the same Cookie and generation still match under
the authentication mutex; recovery routes to login instead of reloading.

Promise-to-callback adapters used by concurrent route loading must attach
separate fulfillment and rejection handlers to the source Promise. Exceptions
raised by a downstream callback are not source-request failures and must not
invoke the same callback again. Environment editing loads project members
through the supported resource-link contract before cloning; any project,
member, network, or policy-manager failure rejects the transition so the
application error boundary can remove the loading overlay and display the
original diagnostic.

Create and edit screens share one owned save lifecycle. The returned Promise
covers validation, the primary and dependent saves, completion hooks, error
handling, and cleanup. Synchronous hook failures are adopted like rejected
Promises; a duplicate submission cannot release the active submission's lock;
and callback or cleanup exceptions remain observable instead of being hidden.
Cancellation never writes data and always releases only the state owned by that
submission.

Catalog localization is additive. The canonical `name` and `description`
fields remain unchanged, while optional
`io.pasturestack.catalog.name.<locale>` and
`io.pasturestack.catalog.description.<locale>` labels provide exact-locale
display text. Missing or blank labels must fall back to the canonical fields.
