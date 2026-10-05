# Compatibility Contract

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
