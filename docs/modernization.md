# Web Console Modernization Gates

This public document records the technical gates for the PastureStack Web Console proof of concept. Private workstation paths, lab topology, session notes, release logs, and maintainer identity mappings belong only in the local migration knowledge base.

## Preserved work

- Node 24-compatible dependency and test harness
- modern Sass compilation and removal of the historical node-sass execution path
- maintained terminal, WebSocket, browser-smoke, CSS-diff, and static-layout checks
- pinned compatibility shims with their own legal notices
- removal of committed development TLS private keys

## Required before release

1. Reproduce dependency installation from a clean Linux workspace.
2. Pass the static build, unit tests, browser smoke, CSS comparison, and dependency baselines.
3. Verify all 13 selectable locales in the language picker, including
   Traditional Chinese, Japanese, Korean, Filipino, and Persian right-to-left
   layout and regional date-time output.
4. Exercise login, navigation, resources, catalog, storage, networking, shell, logs, and console against an isolated compatible server.
5. Audit every bundled dependency and generated artifact for license, provenance, secrets, source maps, and known vulnerabilities.
6. Record upgrade, rollback, and failure behavior without production data.

Passing source checks is not a production-readiness claim. CI/CD and artifact publication remain disabled during this migration stage.

## Framework upgrade safety

The `v1.6.56-pasturestack.32` and `.33` artifacts are not approved for
deployment. They attempted a direct Ember 2.18 to Ember 7 transition while the
application still depended on APIs removed in Ember 4 and Ember 6, including
classic component `sendAction()` calls and observable native-array mutation
methods. Source-only tests did not expose the resulting login and API error
handling failures.

`v1.6.56-pasturestack.34` restores the last compatible runtime, retains the
reviewed application behavior from `.31`, and adds a deterministic initial
loading-overlay cleanup. A future Ember upgrade must first migrate every
removed component action and array API, then pass real credential login,
failed-login, authenticated navigation, and representative resource workflows
in an isolated server before release.

`v1.6.56-pasturestack.35` keeps that compatible runtime and redesigns the
authentication shell without changing provider or token behavior. It adds a
responsive local, OpenID Connect, SAML, MFA, and recovery layout; a
reduced-motion animated gradient; new PastureStack-owned authentication and
favicon assets; and a root favicon response so the login console remains clean.

`v1.6.56-pasturestack.36` removes the unsupported aggregate Bootstrap 3
JavaScript bundle from the production graph. The compatibility UI now loads
only the reviewed transition, collapse, and dropdown modules required by the
navigation and menus. The vulnerable Button, Tooltip, and Popover plug-ins are
excluded from both test and production artifacts, and source gates prevent
their data APIs or jQuery entry points from being restored accidentally.
Bootstrap-derived Sass remains temporarily isolated behind the existing theme
boundary and must be replaced as a separate visual migration.

Production candidate packages omit JavaScript and third-party Intl source maps.
They also omit the development-only `none` pseudo-locale. Development and test
builds retain application source maps and the pseudo-locale for local diagnostics.

## Integration links

Runtime repository and documentation targets are governed by
[`integration-links.md`](integration-links.md). A UI link is release-ready only
after its repository or server documentation path exists.

PastureStack does not currently operate a telemetry collection endpoint. The
legacy welcome prompt and settings control therefore remain hidden; retaining a
compatibility setting is not permission to send usage data. A replacement may
be exposed only after its endpoint, data contract, consent behavior, retention,
and operator documentation have been audited together.

## No-Publish Candidate Browser Smoke Harness

Run `scripts/smoke-ui-candidate-browser` only against an isolated compatible
server. The harness serves an already built candidate locally, proxies
compatible API and WebSocket paths, and is configured to preserve the browser-facing Host header
so absolute-link behavior is tested without
publishing an artifact. Supply credentials through the documented
`PASTURESTACK_*` environment variables; provide `PASTURESTACK_TOTP_SECRET`
when the acceptance account has TOTP enabled. The smoke verifies live
Traditional Chinese and Simplified Chinese switching before returning to
English. It rejects an empty rendered body and application `Loading Error`
console events even when the browser reports them below error severity, so an
API-store startup exception cannot be mistaken for a successful candidate.
Keep screenshots and output outside the repository.

For an MFA release, include `/admin/accounts`, `/account/security`, and a
managed-account `/admin/access/mfa?accountId=...` route in `UI_SMOKE_ROUTES`.
Set `PASTURESTACK_MFA_MANAGED_ACCOUNT_ID` to a different active account so the
smoke verifies that administrator enrollment is rejected. Set
`UI_SMOKE_EXERCISE_TOTP_ENROLLMENT=1` only for an isolated account without an
existing TOTP factor; the smoke then verifies the locally rendered QR code and
cancels the pending UI flow without publishing an artifact.

Set `UI_SMOKE_EXERCISE_PASSKEY_ENROLLMENT=1` only for an isolated account with
the candidate WebAuthn relying-party policy. The smoke provisions a Chromium
virtual authenticator, registers a real passkey through the browser WebAuthn
API, verifies the one-time recovery-code display, signs out, and completes a
new primary login with that passkey.

When the isolated candidate has a working SMTP fixture, set
`UI_SMOKE_REQUIRE_EMAIL_RECOVERY=1` so the current-account route must expose
the recovery-address enrollment controls. Exercise delivery and confirmation
against that fixture separately; never send candidate messages to a real
mailbox.

Set `UI_SMOKE_EXPECT_PASSKEY_LIMIT=1` together with an isolated
`passkeyLimit=1` policy to prove that a second browser enrollment is rejected
with `PasskeyLimitReached`.

The passkey browser exercise finishes by revoking that factor from the
current-account security page and requiring a fresh sign-in, so factor
revocation and session invalidation are part of the same acceptance path.

For a manual preview without storing credentials, run
`scripts/ui-candidate-browser-smoke.js` with `UI_SMOKE_SERVE_ONLY=1`. Set
`UI_SMOKE_BIND` explicitly when the preview must be reachable from another
machine, and keep the preview bound to an isolated test network.

## Test Harness Compatibility

The following no-publish checkpoints record the work needed to keep the legacy Ember test surface auditable while its runtime is modernized:

- **No-Publish Test Harness Blocker Inventory:** keep the remaining browser-only blockers explicit and fail closed when their prerequisites are unavailable.
- **No-Publish Low-Risk Route And Service Direct QUnit Migration:** preserve direct QUnit coverage for isolated routes, services, helpers, and utilities.
- **No-Publish Route Model Direct QUnit Migration:** exercise route model hooks without the removed legacy helper layer.
- **No-Publish Session And Initializer Direct QUnit Migration:** retain session, input, touch, login, and logout behavior checks.
- **No-Publish Hosts New Direct QUnit Migration:** cover the new-host route without publishing generated artifacts.
- **No-Publish Select Tab Direct QUnit Migration:** retain the component integration test through direct QUnit.
- **No-Publish Browser Ember Test Gate:** run the full browser suite in the pinned Node 24 and Chromium environment before release.

The adaptive container statistics table, its effective-usage calculation, and
its bounded rendering model are documented in
[`container-metrics.md`](container-metrics.md).

The operator-selected host-storage removal workflow is documented in
[`storage-bulk-remove.md`](storage-bulk-remove.md). Its release gate must continue
to prove that active mounts cannot be selected, select-all remains scoped to
the filtered page, and item names never silently determine operator intent.

- **No-Publish Ember QUnit Helper Removal:** keep `ember-cli-qunit`, `ember-qunit`, and their obsolete helper layer out of the dependency graph.
- **No-Publish Testem Browser Runtime Modernization:** use headless Chromium instead of the removed PhantomJS runtime.

The direct test migration removes `moduleFor` and `moduleForComponent` usage. The
runtime, testing support, and template compiler now come from the immutable
`ember-source` entry in `package-lock.json`; copied executable Ember bundles are
not retained in the repository. The upstream MIT notice and registry provenance
remain audited with the release inputs.

## Browser Dependency Compatibility

These no-publish candidates replace Bower delivery paths with pinned npm or reviewed vendored inputs while preserving the existing browser APIs:

- **No-Publish Async 3.2.6 Upgrade Candidate:** `async@3.2.6` is imported from `node_modules/async/dist/async.js`.
- **No-Publish CommonMark 0.31.2 Upgrade Candidate:** `commonmark@0.31.2` is imported from `node_modules/commonmark/dist/commonmark.js`.
- **No-Publish Bower jquery.cookie Migration Candidate:** `jquery.cookie@1.4.1` is imported from `node_modules/jquery.cookie/jquery.cookie.js`.
- **No-Publish Bower jGrowl Migration Candidate:** `jgrowl@1.4.2` is imported from `node_modules/jgrowl/jquery.jgrowl.js`.
- **No-Publish Bower lodash Migration Candidate:** `lodash@4.18.1` is imported from `node_modules/lodash/lodash.js`; Dagre and Graphlib use their compatible npm browser bundles.
- **No-Publish Bower md5/identicon Migration Candidate:** `identicon.js@2.3.3` and `md5-jkmyers@0.0.1` replace the Bower inputs; the browser bundle comes from `node_modules/identicon.js/identicon.js`.
- **No-Publish Moment 2.30.1 Upgrade Candidate:** `moment@2.30.1` is imported from `node_modules/moment/moment.js`.
- **No-Publish Bower c3/d3 Migration Candidate:** `c3@0.4.24` and `d3@3.5.17` retain the compatible chart API through `node_modules/c3/c3.js` and `node_modules/d3/d3.js`.
- **No-Publish C3/D3 Request Retirement:** the active graph excludes the obsolete request, forever-agent, and jsdom delivery path.
- **Local TOTP QR Rendering:** the console imports the pinned MIT-licensed
  `qrcode-generator@2.0.4` browser bundle. Authenticator provisioning data is
  encoded locally and is not sent to a third-party rendering service.

`v1.6.56-pasturestack.38` moves the browser application and build CLI to the
supported Ember 6.12 LTS line, removes copied Ember runtime binaries, and keeps
the classic application contract behind a reviewed compatibility boundary.
The `.38` candidate also restores the Ember Intl HTML-message helper, binds
existing pod component templates through Ember's public component-template
API, and routes legacy curly input and textarea invocations through the
reviewed compatibility components. The global compatibility boundary also
restores classic component action dispatch for the 63 maintained components
that still call `sendAction`, supporting both named target actions and closure
actions. Ember's retained classic `_target` is read only inside that audited
shim and is locked by source and browser tests until string actions migrate to
closures. These guards prevent an apparently successful production build from
publishing an empty or unusable login form whose submit action cannot reach the
controller. Navigation data is also normalized before it reaches Ember 6
`LinkTo`, whose `@query` argument now requires an object even when a legacy menu
item has no query parameters.
The removed Handlebars `partial` helper is replaced by an explicit, audited
inventory of tagless context components. Each compiled template is attached
through Ember's public `setComponentTemplate` API, property reads and writes
are delegated only to the explicitly supplied rendering context, and action
dispatch fails closed when that context cannot receive the action. Tooltip
content uses a fixed component-name allowlist instead of runtime partial or
layout-name selection. Ember view lifecycle state remains declared on the
component itself so it cannot be intercepted by the context proxy. A source
gate rejects every reintroduced `partial`
invocation before an artifact can be built.
The reviewed `ember-fetch@5.1.3` compatibility package retains the upstream MIT
license, avoids shadowing the browser global `self` object inside its AMD
exports callback, and re-exports Fetch after the polyfill installs it. The
production wrapper contains no legacy `Ember.Test` waiter: Ember 6 compatibility
builds can expose that namespace outside tests, so its presence is not a valid
environment check. The Node 24 release-lock smoke executes the wrapper with an
active `Ember.Test` namespace and native `AbortSignal` and `AbortController`
stand-ins; registration of a test waiter or failure to call the browser Fetch
implementation blocks the candidate before publication. Distributable archives
include its exact license and provenance under `licenses/ember-fetch/`.
The four active lacsso Handlebars templates are compiled deterministically with
`ember-source@6.12.0` into public `@ember/template-factory` modules. Their
original markup remains byte-for-byte under `vendor/lacsso/upstream-templates`;
the production artifact gate rejects the build-only `ember-cli-htmlbars` AMD
import that otherwise fails at browser startup.
The application-owned API-store reference boundary preserves the retired
`denormalizeId` and `denormalizeIdArray` contract while using Ember 6 computed
properties. It keeps the upstream UI's `Id`/`Ids` singular-type inference,
including array fields such as `serviceIds`, without forking the Apache-2.0
store package. Explicit setters retain expanded API relationships such as a
volume's inline `mounts` list; ID-only payloads still resolve through the store
and register the upstream reference watches.
The same compatibility boundary assigns the application owner to records,
collections, and bulk-loaded schemas through public `getOwner`/`setOwner`
calls. This replaces the store's obsolete discovery of Ember's former private
owner key and keeps lazy service descriptors functional on API resources.
Navigation metadata now uses an application-owned recursive copy boundary in
place of the removed `Ember.copy` API. Mutable arrays and plain objects are
isolated for each page-header consumer, Ember array helpers remain available,
and route callbacks and other non-plain values retain their original identity.
The reviewed classic-component boundary restores the removed component-scoped
`this.$()` helper through each component's public `element` and the pinned
jQuery 3.7.1 runtime. Empty, root, and descendant selections retain the legacy
contract while application code migrates independently of this runtime update.
Authenticated navigation now derives its compatibility `currentPath` value from
the public RouterService `currentRouteName` property. It no longer depends on
the removed application-controller route state, and existing page-header and
upgrade-banner consumers keep their string contract.
The global runloop boundary installs public `@ember/runloop` exports as own
properties on the classic `Ember.run` function. In particular, `Ember.run.bind`
can no longer fall through to native `Function.prototype.bind`; WebSocket event
callbacks therefore retain their socket owner and watchdog state.
The request-store header mixin uses a native getter instead of the removed
volatile computed-property API. Every request therefore reads the current
server-managed CSRF cookie without relying on a cached value or a client-side
property-change notification.
The **Owner-backed Initializer Injection** boundary replaces the removed
`Application#inject` registry API with public owner lookups and service
injection descriptors on the classic base classes. This preserves the legacy
`app`, router, shortcut, session, and tab-session properties without private
registry access. The obsolete growl initializer remains inert so it cannot
overwrite the authenticated session property with an unrelated service.
The application also owns a narrow initializer compatibility boundary for
`ember-api-store@2.8.5`. It retains the addon's public store and model
registrations, but injects the default, authentication, user, and webhook
stores with supported service descriptors. The addon's obsolete registry
injector is never imported or executed by a PastureStack initializer.
Webpack entry modules generated by `ember-auto-import` use natural IDs because
their absolute Broccoli staging paths change between otherwise identical clean
builds. Chunk IDs remain deterministic. A release candidate must be built and
packaged twice with the same source epoch, and the two complete archives must
match byte for byte before publication.
The production packager also removes detached auto-import chunks that contain
`@ember/test-helpers`. Those chunks are not referenced by the production HTML,
are not part of the browser runtime, and can embed a random absolute temporary
build path. A public candidate fails closed if test helpers or `/tmp/` build
paths remain after packaging.

The Ember CLI 6.12 compatibility build restores the runtime theme output map
after Ember CLI initializes its default packager. Release artifacts must
contain non-empty `ui-light.css`, `ui-light.rtl.css`, `ui-dark.css`, and
`ui-dark.rtl.css` assets. The retained Ember Power Select and Ember Basic
Dropdown Sass sources keep their exact upstream version and integrity records,
and their MIT licenses are copied into every distributable under `licenses/`.

The **Ember 6.12 LTS Runtime And CLI** baseline uses
`ember-source@6.12.0`, Ember CLI 6.12.0, Ember CLI HTMLBars 7.0.1, and
`jquery@3.7.1`. Runtime code and the template compiler are restored from the
immutable npm lock instead of copied browser bundles. Every distributable
copies the exact upstream MIT license and pinned runtime provenance into
`licenses/ember/`. The first-party global compatibility bridge preserves the
classic application contract while the remaining barrel imports, prototype
extensions, and classic bundle boundary are retired under browser regression
coverage. The
**No-Publish ember-browserify Removal** replaces `npm:` pseudo-imports and
`ember-browserify` with native `sourceType: module` imports and
`ember-cli-terser`. Locale loading now uses generated JSON assets and the Ember Intl 8 public service API; the removed private translation reducer and legacy
`intl-format-cache/memoizer` shim are not part of the release graph.

The template source now qualifies controller and component state with `this`,
which is required after the implicit-context fallback was removed from modern
Ember. The conversion is source-level and keeps helper, component, block
parameter, and local-variable lookups unchanged. Browser tests compile every
application and in-tree addon template so an unresolved path blocks release.
Legacy template actions use a narrow public-API compatibility bridge. Ember's
template compiler supplies the current context to this legacy helper and
modifier contract; template source must not add a second explicit `this`
target. Positional LinkTo invocations, the removed `hasBlock` property, and
legacy Power Select block syntax are rejected by the source gate. Browser
validation changes a real storage filter and verifies controller state so a
bridge that only compiles, but cannot dispatch an action, cannot be released.

The current interactive-select runtime is pinned to
`ember-power-select@9.0.2`, `ember-basic-dropdown@9.0.0`,
`ember-concurrency@5.2.0`, and `ember-modifier@4.3.0`. Their exact npm
integrities, upstream provenance, and MIT license texts are retained under
`vendor/runtime-licenses/` and copied into every release under
`licenses/runtime/`. These records are intentionally separate from the older,
independently pinned Sass sources used to preserve the existing visual theme.

Build-only dependencies are not force-overridden across incompatible major
versions. Reviewed first-party compatibility packages cover direct project
entrypoints, while addon-owned legacy copies remain an exact, hashed P1
deprecation inventory. A new path, version, or warning family fails CI; reducing
that inventory requires upgrading or replacing the owning addon and rerunning
the full browser suite.

The project subscription socket is also the sole owner of its automatic
reconnect timer. A disconnect observer updates UI state but does not open a
second socket, preventing duplicate connection attempts after a server restart.
Terminal sockets ignore delayed close events from superseded connections. If a
saved broker session closes before its initial handshake, the console creates a
new broker session; a connection that completed its handshake follows the
bounded reconnect path instead. Closed-by-user and already-ended sessions never
reopen automatically.
If route activation explicitly creates a replacement during the close event,
the close handler preserves that socket and does not queue another timer. Late
close events from an older connection are ignored instead of clearing the
replacement connection.
Exec and log sessions remain independent: a session that ended on the server is
not presented as reconnectable, while a newly created session uses a fresh
session identifier and credential.

The navigation header uses Ember's public `<LinkTo>` component with explicit
route, model-array, query, and `current-when` arguments. The removed
`Ember.LinkComponent` global is neither reopened nor subclassed. Active-state
styling remains attached to the generated anchor, including compact-screen
dropdown navigation, without mutating a parent element through a jQuery
observer.

The application router imports the public `@ember/routing/router` module and
sets both `rootURL` and `location` from the generated environment. Browser
builds use the registered `history` location explicitly, while tests retain
the isolated `none` location. The obsolete `auto` registry lookup cannot leave
production routing without an `onUpdateURL` implementation.

Routes, controllers, components, and API resources receive Ember's public
Router service. Application navigation uses `router.transitionTo()` or
`router.replaceWith()` instead of Route and Controller transition methods that
were removed in Ember 5. The former private `router:main` injection is not part
of the active application boundary.
Previous-route and parent-route navigation traverses the public `RouteInfo`
`parent`, `paramNames`, and `params` fields. It no longer reads private handler
info arrays or the Router service's internal router instance, so an initial
route with no settled predecessor remains a valid no-op instead of entering an
error-transition loop.

The Ember 6.12 migration deliberately keeps AMD compatibility enabled for this
release because the classic application boundary still depends on the global
compatibility bridge. Enabling the Ember 7 module-only optional feature is a
separate migration gate: it must first replace the remaining barrel imports,
prototype extensions, and global module lookups, then repeat the full browser
and compatible-server regression suite. It is not silently enabled by this LTS
upgrade.
