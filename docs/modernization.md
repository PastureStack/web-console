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
English. Keep screenshots and output outside the repository.

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

The direct test migration removes `moduleFor` and `moduleForComponent` usage. The compatible compiler remains pinned at `vendor/ember/ember-template-compiler.js`; its provenance and license must continue to be audited with the other vendored assets.

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

The **No-Publish Ember Runtime Bower Removal** retains the compatible runtime under `components/ember`, uses `jquery@3.7.1`, and provides an audited `ember-module-shim`; this is not a framework upgrade. The **No-Publish ember-browserify Removal** replaces `npm:` pseudo-imports and `ember-browserify` with native `sourceType: module` imports, `ember-cli-terser`, and the maintained `intl-format-cache/memoizer` path.
