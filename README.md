# PastureStack Web Console

Web Console provides the browser interface for compatible environments, hosts, stacks, services, containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve, audit, and modernize the Rancher 1.6 ecosystem. It is not affiliated with or endorsed by Rancher Labs or SUSE.

**Upstream:** [`rancher/ui`](https://github.com/rancher/ui), preserved from its `1.6-dev` line. This GitHub fork retains upstream history, authorship, dates, tags, licenses, and dependency notices. PastureStack maintenance is consolidated into one commit after the preserved upstream boundary.

## Project status

The current compatibility release is `1.6.131`. It retains the existing Node 24, Ember, Sass,
dependency, browser-smoke, terminal, console, and test-harness modernization.
It adds a provider-neutral OpenID Connect administration and sign-in flow with
PKCE S256, staged configuration validation, a real test login before
activation, and local-authentication recovery. Product-owned names, logos,
icons, package metadata, and visible text use PastureStack branding. API
models and protocol fields remain compatible.

Release `1.6.131` limits account identity-link lookups to the user and admin
rows that the account page actually displays. The account API also returns
project accounts, whose identity-link lookup correctly returns 404; that 404
previously blocked the whole page. The list still surfaces authorization and
backend errors for visible accounts instead of hiding them.

Release `1.6.130` makes direct stack, account-list, and account-security load
failures show translated, actionable messages. A denied identity-link lookup
no longer appears as an empty identity; only a confirmed missing link on an
inactive account is treated as historical data. Account and environment-member
validation errors now use the selected language. These are display and
error-handling changes; API authorization remains enforced by the Server.

Release `1.6.129` adds an Edit link to the environment detail header when the
network policy is editable but project metadata and members are not. The link
opens the existing edit form for that environment; it does not change API
permissions or duplicate the Edit action for project and member editors.

Release `1.6.128` makes the environment edit page follow API capabilities even
when opened directly with `?editing=true`. Existing members stay visible, but
adding, changing roles, and removing members require the project's `setmembers`
action link. Project metadata and network policy controls follow their own
update links. A fully read-only edit page keeps an exit action without offering
a save button. Focused browser-template and component tests cover the separate
capabilities and new-environment creation flow.

Release `1.6.127` makes environment permission failures understandable in the
existing page and form error surfaces. An inaccessible or missing environment
or member list no longer exposes raw API details; a failed member or network
policy update explains that earlier steps may already have saved. Identity
search distinguishes no matching identity, insufficient permission, expired
session, and temporary service failure. Route-level HTTP 401 retains the
existing session recovery path. Pair this release with Engine
`0.183.320` and Server `v1.6.464` for the tested project-member authorization
boundary.

Release `1.6.126` treats an authenticated account with no active environment
as a valid empty state. It clears stale tab and store scope, skips every
project-scoped request, and avoids a permanent loading error. Account rows use
the authoritative login identity fallback order `name`, `login`, then
`externalId` only when the account name is empty. Descriptions continue to
show only the real `account.description`; identity names and e-mail addresses
are never substituted. Pair this release with Engine `0.183.319` and Server
`v1.6.462`.

Release `1.6.125` keeps account administration available when the account
inventory contains an inactive historical row. The page still loads fresh,
account-scoped authentication identities for every readable account, but an
expected `AccountNotFound` from the identity-link endpoint is isolated to that
single row and falls back to its embedded identity fields. Authorization,
authentication, and server failures other than HTTP 404 still reject the route
and remain diagnosable. Pair this release with Engine `0.183.318` and Server
`v1.6.461`.

Release `1.6.124` restores direct navigation and refreshes for every
`/env/:project_id` page after the Ember 7 transition upgrade. The authenticated
parent route now reads the requested environment from the public RouteInfo
tree, rather than the removed legacy transition parameter bag, before it
considers a tab or user default. A permitted non-default environment therefore
remains selected across direct links and reloads, while inaccessible IDs still
fall through the existing server-authorized selection path. Pair this release
with Engine `0.183.317` and Server `v1.6.459`.

Release `1.6.123` makes environment and workload entry points follow the
effective API schema instead of assuming every signed-in account can create or
update resources. Stack, service, load-balancer, alias, external-service,
virtual-machine, and catalog launch routes reject direct navigation when the
current environment omits the required POST or PUT method; their matching
buttons are hidden from read-only and no-access roles. Catalog refresh and
environment-catalog management additionally require a project management
action. The account administration table now displays description and all
authoritative linked login identities for both local and OpenID Connect
accounts. Pair this release with Engine `0.183.317` and Server `v1.6.458`, which
place new and returning external users in the shared Default environment while
preserving explicit group or direct roles and existing environments.

Release `1.6.122` restores environment view and edit loading after the Ember 7
compatibility migration. Promise-to-callback adapters now distinguish source
Promise rejection from exceptions raised by downstream `async` completion, so
one operation can call its callback only once and the original error remains
diagnosable. The project route imports members through the supported
`followLink` contract before cloning the editable model; the removed
`importLink` helper can no longer leave the transition pending. Synchronous and
asynchronous failures from projects, members, networks, and policy managers now
reject the route and reach the normal error page instead of leaving the static
loading overlay in place. Focused tests cover resolved, rejected, downstream
callback, concurrent `async.auto`, every environment-loading dependency, and
the adjacent authenticated initialization path. The shared create/edit mixin
now returns one owned Promise across validation, persistence, dependent saves,
completion, error handling, and cleanup. Duplicate submissions cannot release
another request's saving lock, while synchronous hook, callback, and finalizer
exceptions remain diagnosable. Environment and load-balancer component tests
exercise the same lifecycle used by the browser. Pair this release with
Authentication Service `v0.4.41` and Engine `0.183.309` or newer.

Release `1.6.121` closes the expired-session loading loop without changing the
server authentication contract. `GET /token` may return HTTP 200 with provider
login options when a Cookie is missing, invalid, or expired; the console now
requires an identity-bearing `accountId`, `user`, or `userIdentity` before it
adopts that response as an authenticated session. The unauthenticated object is
normalized to the existing local 401 path, where the origin-level mutex clears
only a still-matching Cookie and generation before routing to the login page.
Passive failures still issue no DELETE, and a delayed result cannot clear a
newer session. Deterministic tests cover simultaneous 401 recovery, single
invalidation, newer-generation protection, masked JWT responses, and the
existing TOTP, Passkey, callback, explicit-logout, and 403 boundaries. Pair this
release with Authentication Service `v0.4.41` and Engine `0.183.309` or newer.

Release `1.6.120` completes the cross-tab session boundary under real browser
ordering. Shared cookie and generation reads now occur only after acquiring the
same origin-level mutex used by login commit, so a peer cannot cache a
half-written session. Storage events and `BroadcastChannel` feed one serialized
reconciliation path; a tab entering the login route also revalidates an already
committed cookie, covering refreshes and events missed during navigation.
Initial-transition 401 handling stays generation-aware, passive failures never
revoke a token, and explicit logout remains generation-bound and coalesced to a
single DELETE. Deterministic delayed-401 coverage runs TOTP and Passkey orderings
100 times, and the production browser smoke validates three-tab adoption,
refresh recovery, API access, WebSocket connectivity, and one explicit logout.
Pair this release with Authentication Service `v0.4.39` and Engine `0.183.309`
or newer.

Release `1.6.119` closes three persistence regressions found during the
`1.6.442` integrated runtime review. External-service API hydration can now
replace the local healthy default, including with `null`, without assigning to
a getter-only computed property. OIDC site-access updates retain stable error
codes and bound MFA request digests when a rejection object is returned at the
top level. Load-balancer backend selection now follows an explicit child action
to the owning `PortRule`, so edit and upgrade PUT payloads retain the selected
`serviceId`. Browser tests cover the real model setter, the strict one-retry MFA
boundary, and the production DOM selector through the submitted API payload.
Pair this release with Authentication Service `v0.4.38` and Engine `0.183.304`
or newer.

Release `1.6.118` fixes OIDC site-access policy editing without weakening the
provider enablement boundary. Unrestricted mode clears stale authorized
identities before saving; restricted and required entries are normalized and
deduplicated by OIDC principal type and immutable external ID. Access expansion
opens the existing MFA security-confirmation dialog with a purpose and canonical
request digest supplied by the authentication service, retries exactly once,
and never retains the one-time ticket after completion or failure. Stable backend
codes are rendered as localized, actionable errors without exposing raw response
bodies. Pair this release with Authentication Service `v0.4.37` and Engine
`0.183.303` or newer.

Release `1.6.117` prevents an older same-origin browser tab from revoking or
clearing a session that a newer tab has just established. Explicit user logout
is now the only browser path that requests server-side token revocation. Passive
401, storage, WebSocket, timer, and route failures reconcile against a
non-sensitive session generation; ordinary 403 permission failures remain local
to the failed request. Login, cookie readback, generation commit, session
adoption, and explicit logout share one cross-tab mutex, with a tested
IndexedDB lease fallback when Web Locks is unavailable. OIDC transactions retain
the generation captured before leaving the origin, stale callbacks cannot
overwrite a newer login, and waiting tabs validate the shared cookie before
adopting it. JWTs remain cookie- and memory-only and are never persisted in Web
Storage. A precise `409 ClientSessionSuperseded` response from the Engine is
treated as a stale completion rather than a failed active login, and request
options cannot override the provider, authorization value, or captured
generation. Pair this release with Engine `0.183.302` or newer for
session-bound, ordered, idempotent server logout protection.

Release `1.6.116` recognizes the MFA API's structured error code even when
the transport wraps it in a generic error. Sensitive settings updates open
the security-confirmation dialog and retry only after successful confirmation;
cancellation never resubmits the update. Unexpected API failures retain a
localized explanation with bounded HTTP status/code diagnostics, without
displaying raw response bodies. Use Engine `0.183.298` or newer for the
matching live `v2-beta` MFA settings and confirmation schema repair.

Release `1.6.115` closes the global resource-action menu before dispatching
the selected action. This prevents the row menu from remaining above account
edit and other modal forms, while preserving the selected resource and action
receiver. The same shared fix covers every resource table which uses this
menu; focused tests verify that the menu, trigger state, and anchor are closed
before the modal action executes.

Release `1.6.114` fixes the exact post-create exception captured during a real
`ranchernode22` service creation. The live global service collection can contain
a transient empty slot while the API store merges a newly created resource; the
page-header observer now ignores only those unreadable entries before examining
application-service metadata. The same guard covers both observer and navigation
tree rebuild paths. Completion no longer performs the unrelated service reload
introduced by the two superseded diagnostic releases, while the saved payload,
route callback, hardware controls, and other page regions remain unchanged.

Release `1.6.113` force-loaded the saved service by API ID while diagnosing the
post-create failure. Instrumented browser evidence later located the exception
in the page-header observer before completion navigation, so the extra request
is removed in `1.6.114`; `1.6.113` remains a diagnostic boundary.

Release `1.6.112` introduced the first-create refresh boundary found by the
formal `ranchernode22` acceptance test. The API could return a deliberately
sparse service while that same record was already visible to the destination
stack, causing its computed fields to render before the launch configuration
was hydrated. The shared create/upgrade form now refreshes the persisted
service before navigation and treats an optional refresh failure as
non-authoritative because the save itself has already succeeded. Focused tests
cover the intended refresh ordering, fallback behaviour, receiver binding, and
unchanged hardware payloads. Real-host acceptance later proved Resource reload
could not hydrate a response without a self link; `1.6.112` is retained as that
diagnostic boundary. The Traditional Chinese capability label now describes
`mknod` as creating a device node instead of presenting a misleading phonetic
transliteration.

Release `1.6.111` fixes the post-save callback receiver boundary found by creating a real
service on a managed host. The API and node correctly created the service, but
the legacy component action target could lose its controller receiver before
navigation. All four container and virtual-machine create routes now pass
receiver-bound completion and cancellation callbacks to the shared form. The
resource and hardware payload is unchanged. Real-host acceptance subsequently
found a separate sparse-response render race; `1.6.111` is retained as that
diagnostic boundary rather than the current compatibility target.

Release `1.6.110` restores the classic `(action (mut ...))` contract used by
command and environment editors, and accepts the modern array-like browser
clipboard type list used by key/value inputs. This closes the two client-side
exceptions found while filling the complete hardware/runtime form on a real
host; it retains the INIT spacing and completion fixes from `1.6.109`.

Release `1.6.109` corrects the create and upgrade completion contract exposed by
real-host acceptance testing. Top-level create routes now pass classic named
actions to the shared form so Ember dispatch preserves the controller receiver;
the compatibility layer also refuses to forward a component prototype callback
as an action name. This prevents a successfully persisted service from leaving
the form open with `undefined.get` or a template-action error. A regression test
exercises the controller transition, and the init-process control has additional
desktop separation from the adjacent process-limit input without changing its
payload binding.

Release `1.6.108` attempted to close the first-create completion failure with a
closure callback. Real-host acceptance testing subsequently showed that the
legacy action compatibility path could still misroute the callback after the
service was already persisted. It is retained as a superseded diagnostic step,
not as the current compatibility target.

Release `1.6.107` removed saved-response dereferences from route selection, but
real-host acceptance testing showed that the deprecated callback dispatch still
failed after persistence. It is retained only as a superseded diagnostic step,
not as the current compatibility target.

Release `1.6.106` fixes the real first-service creation completion path. An
empty service-link set no longer sends a redundant action after the service is
already persisted, and a non-empty link update preserves the stack route
identity even if the API returns a partial resource. The route also keeps its
original stack ID independently of the mutable service response. A successful
first click therefore leaves the form instead of showing an error that could
invite a duplicate service submission.

Release `1.6.105` fixes the post-save transition for a newly created service:
the persisted service now remains in the completion chain instead of being
discarded by the service-link action. Stack-scoped create routes also fall back
to their stable stack query parameter, and advanced key/value inputs render
localized placeholders. The create and upgrade resource payloads remain
unchanged.

Release `1.6.104` keeps the authenticated browser-session and OIDC corrections
from `1.6.103`. It also keeps the init-process checkbox inside its own resource
grid column, with the launch-configuration binding unchanged, so the control no
longer touches the adjacent process-limit input on create or upgrade forms.

Release `1.6.103` keeps an authenticated browser session when a non-auth API
request fails during startup, displays the nested OIDC/API explanation instead
of an empty alert, and activates a newly verified provider in unrestricted mode
so every identity accepted by that provider can sign in. Administrators can
still narrow access afterward with the existing site-access controls.

The language picker includes English, German, Persian, Filipino, French,
Hungarian, Japanese, Korean, Brazilian Portuguese, Russian, Ukrainian,
Simplified Chinese, and Traditional Chinese for Taiwan. Every selectable locale
must satisfy the complete message contract and regional formatting gates
documented in [Localization](docs/localization.md).
New security-sensitive authentication text is maintained in English and
Traditional Chinese first; other locales inherit the complete English text
until a reviewed translation is available, rather than displaying missing
translation keys.

The manually dispatched validation workflow tests and builds the exact
selected commit on a GitHub-hosted runner and retains the reviewed candidate
for 30 days. Release publication remains a separate reviewed step.

## Build and test

```sh
npm ci --ignore-scripts
npm run build -- --environment=production
npm test
package_version=$(node -p 'require("./package.json").version')
bash scripts/package-static-candidate \
  "$package_version" dist "build/ui/${package_version}.tar.gz"
```

The packaging command uses the current Git commit timestamp by default, or an
explicit `SOURCE_DATE_EPOCH`, and emits a deterministic tarball plus a portable
SHA-256 file. It creates a candidate only; publishing remains a separate,
reviewed release step. The archive root and `VERSION.txt` must equal the
numeric package version; a preserved compatibility version must not be
silently substituted into a new release artifact.

Catalog cards and launch pages read optional
`io.pasturestack.catalog.name.<locale>` and
`io.pasturestack.catalog.description.<locale>` labels. Unknown locales and
third-party catalogs fall back to their canonical metadata instead of showing
an empty string or an untranslated key.

Container terminals, container logs, and virtual machine consoles use the
movable window system documented in
[Console workspace](docs/console-workspace.md). Terminal and log sessions can
be reopened after a tab refresh or browser restart, and active output is shared
across signed-in tabs without persisting upstream access tokens.

Host storage pages provide checkbox selection, state filtering, search,
pagination, and one operator-confirmed removal action. Selection rules,
preview behavior, and the concurrency limit are documented in
[operator-selected storage removal](docs/storage-bulk-remove.md).

Linux shared memory, runtimes, GPU/graphics devices and advanced container limits
use the shared [Resources and hardware](docs/resources-and-hardware.md) form.
The guide covers coordinated agent/API rollout and the distinction between
device visibility and exclusive GPU allocation.

OpenID Connect configuration, stable account-to-identity assignment, safe
provider switching, and local recovery are documented in
[OpenID Connect](docs/openid-connect.md). TOTP, passkeys, recovery codes,
email account recovery, and administrator controls are documented in
[Multi-factor authentication](docs/multi-factor-authentication.md).

The repository includes explicit modernization gates because its historical
frontend toolchain cannot be trusted without review. See
[COMPATIBILITY.md](COMPATIBILITY.md), [SECURITY.md](SECURITY.md), and
[ORIGIN.md](ORIGIN.md).

## License and attribution

The inherited project remains licensed under [Apache License 2.0](LICENSE), with additional attribution in [COPYRIGHT_DETAILS.md](COPYRIGHT_DETAILS.md). Bundled dependencies retain their own licenses and notices. PastureStack contributors claim authorship only for their own changes.
