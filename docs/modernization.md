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

The maintained UI runtime now uses Bootstrap `5.3.8` CSS and its matching
bundle. The unused vendored Bootstrap 3 JavaScript, Sass, fonts, and metadata
have been removed. Source and package gates reject the former Bower/npm
Bootstrap Sass dependencies, Bootstrap 3 artifacts, and legacy `data-toggle`
or loading-state APIs while allowing the maintained Bootstrap 5 Button,
Collapse, Dropdown, Tooltip, and Popover implementations. The unused Bootstrap
3 input-group fragment formerly embedded in Lacsso's scoped stylesheet is also
absent; active sortable-table input sizing remains locally maintained.

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
- **No-Publish Bower jGrowl Migration Candidate:** `jgrowl@1.5.1` is imported from `node_modules/jgrowl/jquery.jgrowl.js`.
- **No-Publish Bower lodash Migration Candidate:** `lodash@4.18.1` is imported from `node_modules/lodash/lodash.js`; Dagre and Graphlib use their compatible npm browser bundles.
- **No-Publish Bower md5/identicon Migration Candidate:** `identicon.js@2.3.3` and `md5-jkmyers@0.0.1` replace the Bower inputs; the browser bundle comes from `node_modules/identicon.js/identicon.js`.
- **No-Publish Moment 2.30.1 Upgrade Candidate:** `moment@2.30.1` is imported from `node_modules/moment/moment.js`.
- **C3 retirement and maintained chart runtime:** the four live statistics charts now use NAVER's maintained `billboard.js@4.0.3`; sparkline and stack graph code use `d3@7.9.0`, and the stack renderer uses `dagre-d3-es@7.0.14`. The lock contains only the fixed `d3-color@3.1.0`; the unmaintained C3 and legacy global D3/Dagre delivery paths are absent.
- **Local TOTP QR Rendering:** the console imports the pinned MIT-licensed
  `qrcode-generator@2.0.4` browser bundle. Authenticator provisioning data is
  encoded locally and is not sent to a third-party rendering service.

`v1.6.56-pasturestack.39` moves the browser application and build CLI to the
supported Ember 6.12 LTS line, removes copied Ember runtime binaries, and keeps
the classic application contract behind a reviewed compatibility boundary.
The `.39` candidate also restores the Ember Intl HTML-message helper, binds
existing pod component templates through Ember's public component-template
API, and routes legacy curly input and textarea invocations through the
reviewed compatibility components. The global compatibility boundary also
restores classic component action dispatch for the 63 maintained components
that still call `sendAction`, supporting both named target actions and closure
actions. Ember's retained classic `_target` is read only inside that audited
shim and is locked by source and browser tests until string actions migrate to
closures. These guards prevent an apparently successful production build from
publishing an empty or unusable login form whose submit action cannot reach the
controller. The action shim also rejects component prototype event methods as
closure actions, preventing native input events from recursively re-entering
themselves. Navigation data is also normalized before it reaches Ember 6
`LinkTo`, whose `@query` argument now requires an object even when a legacy menu
item has no query parameters.

`v1.6.56-pasturestack.40` gives the embedded OpenID Connect configuration its
own writable model boundary. This prevents its provider `displayName` field
from colliding with the read-only display name computed for ordinary runtime
resources after the Ember 6 upgrade. The same release probes a saved console
broker session before reconnecting: a missing session is recreated through the
normal execute action, a credential conflict rotates the random browser-side
session identity, and a permanently failed WebSocket stops after four bounded
attempts instead of retrying indefinitely.

`v1.6.56-pasturestack.41` treats an absent console-broker session as a normal
`missing` state while retaining compatibility with older brokers that return
HTTP 404. The terminal recreates that state through the existing execute action
without leaving a failed request in the browser console. The shared terminal
and log resize control is reduced from 22 by 22 pixels to 11 by 11 pixels, so
the existing 12-pixel footer inset keeps it clear of the rightmost action.

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
`ember-source@7.2.0` into public `@ember/template-factory` modules. Their
original markup remains byte-for-byte under `vendor/lacsso/upstream-templates`;
the production artifact gate rejects the build-only `ember-cli-htmlbars` AMD
import that otherwise fails at browser startup.
The application-owned API-store reference boundary preserves the retired
`denormalizeId` and `denormalizeIdArray` contract while using Ember 7 computed
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

The Ember CLI 7.2 compatibility build restores the runtime theme output map
after Ember CLI initializes its default packager. Release artifacts must
contain non-empty `ui-light.css`, `ui-light.rtl.css`, `ui-dark.css`, and
`ui-dark.rtl.css` assets. The retained Ember Power Select and Ember Basic
Dropdown Sass sources keep their exact upstream version and integrity records,
and their MIT licenses are copied into every distributable under `licenses/`.

The **Ember 7.2 Runtime And CLI** baseline uses
`ember-source@7.2.0`, Ember CLI 7.2.0, Ember CLI HTMLBars 7.0.1, and
`jquery@3.7.1`. Runtime code and the template compiler are restored from the
immutable npm lock instead of copied browser bundles. Every distributable
copies the exact upstream MIT license and pinned runtime provenance into
`licenses/ember/`. The first-party global compatibility bridge preserves the
classic application contract while the remaining barrel imports, prototype
extensions, and classic bundle boundary are retired under browser regression
coverage. The
**No-Publish ember-browserify Removal** replaces `npm:` pseudo-imports and
`ember-browserify` with native `sourceType: module` imports and
`ember-cli-terser`. Locale loading now uses generated JSON assets and the Ember Intl 9 public service API; the removed private translation reducer and legacy
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
`bootstrap-multiselect@2.0.0`, `ember-power-select@9.0.2`, `ember-basic-dropdown@9.0.0`,
`ember-concurrency@5.2.0`, and `ember-modifier@4.3.0`. Their exact npm
integrities, upstream provenance, and MIT license texts are retained under
`vendor/runtime-licenses/` and copied into every release under
`licenses/runtime/`. The application also loads the Sass modules from these
same maintained package versions; the older beta-era style copies are absent.

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

`v1.6.56-pasturestack.42` restores Catalog upgrade target selection on the
Ember 6 runtime. The Catalog API already returned the installed revision and
its compatible `upgradeVersionLinks`, but the shared native-select component
assigned computed-property descriptors to individual instances during
`init()`. Ember 6 does not install reactive properties through that legacy
pattern, so only the prompt was rendered. Version choices are now class-level
reactive computed properties, the launch route reads API resources through
their public property interface, and tests cover the installed revision plus
every non-empty upgrade link. The complete contract and formal acceptance
requirements are recorded in `docs/catalog-upgrade-contract.md`.

`v1.6.56-pasturestack.43` completes the Catalog upgrade-form repair. The NFS
target proved that primitive enum questions could still abort rendering even
after version targets became selectable: an `option` block parameter shadowed
the native `<option>` element, so Ember 6 treated values such as `nfsvers=4` as
dynamic component definitions. The block parameter is now unambiguous, and CI
compiles the enum template to prove that every choice remains a native option
rather than a dynamic component. Formal browser acceptance covers both NFS
version choices, both data-removal choices, the following debug setting, and
does not submit a workload upgrade.

`v1.6.56-pasturestack.44` closes the remaining Catalog required-answer edge
case. Required fields now reject only values that are actually empty; boolean
`false` and numeric `0` remain valid answers. This prevents a required enum
whose YAML default is `false` from being rejected unless the operator manually
reselects the already-selected value. The Catalog form gate now compiles all
application templates, rejects native-element lexical shadowing, verifies all
supported schema-input controls, and rejects computed descriptors assigned to
component instances at runtime.

`v1.6.56-pasturestack.45` keeps installed immutable Catalog revisions aligned
with their selectable update targets. If an older revision predates localized
question metadata, matching labels learned from a newer revision of the same
template remain available as a fallback while the operator compares versions;
the selected revision's own labels always win. The cache is cleared between
templates and never changes the revision payload. Version fetches are also
latest-response-only, so rapidly changing the selector cannot let a delayed
request replace the form with questions or Compose data from the wrong
revision.

`v1.6.56-pasturestack.46` restores readable preformatted content throughout
the console. CommonMark places the language class on its nested `code` element,
while the Prism theme previously assigned the dark surface only when the parent
`pre` carried that class. The result was near-white syntax text on Bootstrap's
light preformatted background. All preformatted surfaces now use the reviewed
dark code background in both UI themes, and every normal-size Prism foreground
color meets WCAG AA contrast. A source gate calculates every reviewed color
pair and rejects ratios below 4.5:1.

`v1.6.56-pasturestack.47` restores rows in every shared sortable table when an
API relationship is populated after the component has initialized. The host
container view exposed the defect because its container relationship starts
empty and is filled asynchronously: the legacy string-form run-loop callback
left the filtered result at its initial empty array even though the API and
statistics sockets were healthy. Content, sorting, and search observers now
use function references supported by Ember 6 and observe the late-bound body
directly. A browser test covers empty initialization, late row arrival,
natural ordering, searching, and clearing the search.

`v1.6.56-pasturestack.48` added explicit instance preloading to the direct
host-container route. Runtime acceptance then proved that `hostId` is not a
filterable field in this legacy API schema: the collection endpoint can ignore
that parameter, so Store population is not an authoritative host relationship.

`v1.6.56-pasturestack.49` follows the host resource's native `instances` link
instead. That API-owned relationship returns the exact records for the
selected host, and the route passes that collection directly to the table. It
does not depend on another page having populated the project Store, download
unrelated containers, or infer membership from a non-filterable field. A route
test locks the relationship name, exact collection identity, host identity,
and independence from project-wide Store contents.

`v1.6.56-pasturestack.50` fixes the remaining table lifecycle boundary found
by authenticated production acceptance. A sortable table now refreshes its
filtered rows when its `body` reference is replaced by a resolved relationship
collection, in addition to refreshing when an existing collection is populated.
The regression test starts without a body, assigns a new relationship collection,
and requires both rows to appear in natural order while the search text is empty.

`v1.6.56-pasturestack.51` fixes the separate pagination bridge exposed by the
same authenticated acceptance. The filtered relationship already contained
the correct rows, but the legacy string-binding used by the pagination proxy
retained its initialization-time empty content. The shared table now explicitly
synchronizes filtered content, page number, and page size into that proxy.
Regression tests require late, replacement, and initial relationship rows to
reach the rendered page and verify page and page-size changes independently.

`v1.6.56-pasturestack.52` separates the caller-owned `perPage`
input from the table's writable effective page size. Selecting All no longer
writes through a read-only computed preference under Ember 6; it persists the
semantic `0` value while the pagination proxy receives the internal expanded
size. Host storage batch removal also invalidates the filtered table after
each successful API response, so rows and the selected count update while the
bounded request queue is still completing.

`v1.6.56-pasturestack.57` completes the port-preflight upgrade context and
presentation boundary. Service upgrades submit the exact service, stack,
scale, batch size, and start-first placement semantics; active conflicts block
the operation while stopped owners remain explicit warnings. Status indicators
use the shared accessible tooltip component, and the complete browser suite
locks both the service-upgrade context and the host-storage live-removal flow.
The test application also loads the generated light-theme stylesheet instead
of a retired aggregate filename, so browser regression results include the
same table layout rules used by production.

`v1.6.56-pasturestack.58` makes managed-network port ownership explicitly
environment-wide even when a container is pinned to one host. Bridge and host
networking remain scoped to the requested host, while managed runtime probes
inspect every eligible host. The other-host blocking message is corrected in
all 13 supported locales and no longer implies that deployment may continue on
another host.

`v1.6.56-pasturestack.60` replaces the free-text volume driver field with a
capability-filtered selector and adds a keyboard-accessible path completer with
prefix ranking, natural ordering, and an eight-item limit. The form checks
absolute paths, safe path segments, duplicate targets, mount modes, existing
volume ownership, driver state, storage pools, and required-host coverage.
`pasturestack-nfs` additionally requires environment scope, `multiHostRW`, and
coverage on every active host. A server preflight result is shown before save,
while the final create and upgrade requests repeat the same validation to close
the race window. All 13 production locales use the same field and validation
contract; Traditional Chinese labels the editable values as paths and contains
no ambiguous volume translation.

`v1.6.56-pasturestack.61` removes the final save-time dependency on Ember's
retired String prototype extensions. Schema validation now converts camel-case,
acronym, underscore, and space-separated field names through a native utility,
so creating a container or service cannot become stuck while formatting a
validation label. A focused unit regression and a fail-closed source gate keep
this path independent from `String.prototype.dasherize` while the supported
Array compatibility boundary remains explicit.

The previous compatibility package closes the remaining live-volume-check save race.
The Create button stays disabled while an ordinary preflight request is in
progress, but a same-tick recheck can no longer become a stale client-side
validation error after the user has already clicked Create. The authoritative
create or upgrade request still repeats the complete volume validation on the
server, so the race is removed without weakening storage safety.

`1.6.63` removes the Critical Babel 6 traversal chain and the
associated obsolete Rollup and Webpack 4 build graph. The API store keeps its
published 2.8.5 runtime source and Apache-2.0 license unchanged inside a
reproducible compatibility archive, while its build metadata now uses Ember
Auto Import 2.13.1, Ember CLI Babel 8.3.1, and `set-cookie-parser` 2.7.2. The
browser fetch boundary uses native Fetch APIs, the route-action helper is
replaced by standard Ember actions, and the reviewed Lodash template wrapper
uses Lodash 4.18.1. The Node.js 24 lock gate rejects reintroduction of the
Critical or High dependency versions and requires byte-identical lock evidence.
Inline-template module identity is normalized during Babel compilation, before
the template compiler derives its module name and template ID. Production chunks
therefore do not disclose an absolute builder workspace, and independently built
release candidates retain byte-identical names and contents.

`1.6.64` makes the route loading overlay deterministic. Successful, rejected,
aborted, and overlapping transitions share one idempotent lifecycle; a stale
transition can no longer re-display or hide the overlay owned by a newer
transition. A bounded fallback also prevents a stalled route promise from
blocking the entire console indefinitely.

`1.6.65` removed the inherited landscape-and-orbit markup. Its first replacement
still retained a circular, rotating silhouette that was too visually close to
the retired transition.

`1.6.66` replaces that silhouette with a distinctly PastureStack-native loading
panel. The fixed, viewport-centred status indicator uses a rectangular brand
panel, the full-colour project mark, three independently highlighted stack
layers, a bounded progress track, localized loading text, and reduced-motion
support. Field, grass, celestial-body, circular-orbit, and rotating-ring
structures are neither rendered nor retained in the active style sheet.

`1.6.68` keeps the brand panel stationary when the browser requests reduced
motion, but retains a low-displacement layer pulse and progress-colour cycle.
Loading therefore remains perceptible without restoring the full spatial
movement or overriding the explicit application-level animation opt-out. Its
release workflow also derives the archive root and `VERSION.txt` from the
numeric package version and rejects any mismatch before retaining a candidate.

`1.6.69` removes carriage-return and line-feed characters immediately before
all noVNC console logging sinks and the Node smoke-harness error sink. Remote
console messages and thrown test values therefore cannot forge additional log
records. The source gate rejects restoration of any reviewed raw sink, and the
numeric artifact version remains the only version exposed by the package.

`1.6.70` pins the reviewed build toolchain to Node.js `24.19.0` LTS and npm
`12.0.2`, including an immutable official container manifest and
verified Node archive checksums. It also overrides the transitive build-only
`nanoid` dependency to patched version `3.3.18` for
`GHSA-2v37-7h3g-55p8` / `CVE-2026-67213`. The dependency gate rejects an older
version, a missing override, or drift in the exact toolchain declarations, and
the release CI fails closed when the current npm advisory service reports a new
Critical or High finding.

`1.6.71` adds a result-oriented audit-log filter builder. Operators can combine
time range, environment, user, event, description, resource, source-IP, and
authentication conditions without exposing raw account or project identifiers.
The existing audit table, sorting, pagination, and detail view remain unchanged.

`1.6.72` fixes the production bootstrap boundary found during real-browser
validation of that filter release. The application now installs the Ember 7
resolver through a native application class, replaces the obsolete global-app
add-on with a modular initializer, and emits flat Ember Intl 9 message keys so
the production login and authenticated routes render instead of failing or
showing missing-translation markers.

`1.6.73` restores Bootstrap 5's production interaction boundary. The runtime
is imported by the application module and exposed to the existing header
compatibility code, so collapse and dropdown controls execute instead of being
left as a dormant anonymous AMD module. This release does not change the audit
table or broaden the audit-filter redesign.

`1.6.79` restores the authenticated console's established Server `v1.6.358`
visual contract without reverting the modernized application. Bootstrap
`5.3.8`, Ember `7.2`, current authentication, audit filtering, dependencies,
and security fixes remain active. Only the incompatible global Bootstrap 5
reboot/layout stylesheet is replaced by provenance-bound light and dark
presentation snapshots; Bootstrap 5 remains the JavaScript interaction
runtime through small state-class bridges. The release browser smoke checks
the shared 45-pixel navigation, typography, footer geometry, overflow, and
security-icon rendering across the major environment and administration route
families so a full-page layout reset cannot silently return.

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

The Ember 7.2 runtime deliberately keeps AMD compatibility enabled for this
release because the classic application boundary still depends on the global
compatibility bridge. Enabling the module-only optional feature is a separate
migration gate: it must first replace the remaining barrel imports,
prototype extensions, and global module lookups, then repeat the full browser
and compatible-server regression suite. It is not silently enabled by this LTS
upgrade.
