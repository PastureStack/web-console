# Compatibility Contract

Web Console preserves compatible API paths, schema and resource names, action names, setting keys, authentication routes, catalog fields, orchestration framework identifiers, generated model properties, and server-provided links.

Visible branding, product-owned assets, icon identifiers, package metadata, and operator documentation use PastureStack. Historical identifiers remain only where they are server data or protocol contracts and must not be mechanically replaced.

Candidate `1.6.171` confines create-response adoption to ID-less POST/201 and an
existing exact-ID/concrete-type canonical model in the same Store, generation
and API base. It does not re-import stale scalar or nested create fields over
that model. The original draft-save completion identity and subtype/base aliases
remain intact. Resource IDs are not normalized. Missing schemas grant no access.
GET, PUT, action POST (including reused options), uncached creates, non-201,
204 and error paths retain normal processing. No API authorization, session,
MFA, payload, resource lifecycle or backend changes are introduced.
Revision 5 is a new archive; revision 4 is not overwritten. Focused Chrome
validation passed 36/36, including ten new cases and 100 barrier iterations;
failure, skip and todo counts are zero. Official validation, publication and
packaged fresh-volume acceptance remain pending, not full-matrix PASS.
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
