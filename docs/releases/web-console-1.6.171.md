# Web Console 1.6.171

Published shared Store fix; component publication is not packaged QA acceptance.

## Root cause and changes

In packaged native QA, subscribe delivered an inactive created local Volume
before the browser received its original HTTP 201 response. Importing that
initial response replaced the newer canonical model with registering fields.
The backend creation succeeded, but the frontend never reached the expected
stable model state. This is not fixed by relaxing allocation or loading checks.

`vendor/ember-api-store-compat/addon/mixins/type.js` marks only an ID-less new
record's POST with its concrete type, Store generation and API base. Existing
record saves and actions discard a reused marker. The marker is internal request
metadata, not JSON payload. The existing save merge and canonical alias logic
preserve the saved draft's identity.

`vendor/ember-api-store-compat/addon/services/store.js` uses a canonical model
already present for the exact opaque ID and concrete type only for a matching
create POST/201 in that same Store/generation/API base. It does not typeify the
old response's fields or nested resources over that model. HTTP status and xhr
metadata retain their contracts. Uncached create, GET, PUT, action, non-201,
204 and errors retain the existing path. This is not a general timestamp-based
ordering rule for all updates.

Compatibility revision 5 uses a new immutable archive; revision 4 is unchanged.
The lockfile's dependency versions/graph remain unchanged. No authentication,
backend, authorization, data migration or production configuration changes.

## Verification boundary

Ten regression tests use the installed Store/Resource/Schema/Collection package,
not an alternate handwritten store. A deferred HTTP barrier repeats the
subscribe-before-201 race 100 times without sleeps. Adjacent cases cover
uncached creation, subtype/base aliases, stale nested fields, case-sensitive
IDs, distinct stores, reset generation, changed base, ordinary methods,
204/errors, existing-save option reuse and action option reuse.

Focused local Chrome 153 validation passed 36/36 tests with zero failure, skip
or todo, including all ten new cases and 100 deferred-barrier iterations.
Adjacent Store/schema/reference, allocation-proof, route and subscribe-session
cases remain passing. The installed revision-5 archive matches the runtime source.
Exact-source official validation
[37094728912](https://github.com/PastureStack/web-console/actions/runs/37094728912)
passed 802/802 tests with zero failures, skips or todo, including all ten
create-order regressions; all 22 audit-gate selftests passed. Two production
builds produced the same archive SHA-256:
`49fac41ca93eb628d0877104f9512ef382ffd9dbc89e04c940196b3a9c57798b`
(2,981,230 bytes).

The signed immutable numeric
[release](https://github.com/PastureStack/web-console/releases/tag/1.6.171)
pins tested source `fc37f5af9320e492bec7e7244cd62144908b720e`.
PR161 squash-merged as `f7e0eefdd8322e5d0b5ab6c2d8cf427ad35f59f8`;
its tree `5f81762a276d9212adcaf2469134a88beb0339ec` is identical to the
tested source. Anonymous archive and checksum downloads match the formal
artifact; publication reused those bytes without rebuilding.

Server508 packaging and packaged native fresh-volume
create/cancel/refresh/denial/removal remain pending.
Historical failed QA receipts stay HOLD; the complete
permission/resource/locale matrix remains INCOMPLETE.

## Upstream-pending build dependency

Official run 37092519936 stopped before QUnit on the newly reviewed
[braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
The registry's latest version remains 3.0.3 and the advisory lists no patched
release. Existing build-tool consumers remain unchanged. Do not apply the npm
suggested forced Ember CLI downgrade or privately patch third-party code.

The [dated risk record](../security/npm-vendor-pending.json) keeps this High
finding visible. The live audit remains fail-closed at High for any other or
changed advisory, changed affected dependency nodes, non-development exposure,
expired review or audit failure. Only this exact reviewed build-only closure
may remain vendor-pending until 2026-10-10. That exception is not a claim that
the vulnerable package is patched or that the source graph has zero High
findings. The packaged static artifact must exclude the affected Node package.

The successful official run retained the raw audit totals: seven High, three
Moderate and zero Critical findings. Its bounded build-only result was
`PASS_BUILD_VENDOR_PENDING`; the High advisory remains unresolved until the
existing 2026-10-10 review boundary. Formal package checks found no affected
build-package modules in the static artifact, without making a runtime
not-affected VEX or zero-vulnerability claim. No dependency or security-policy
change is introduced by this documentation update.

## Upgrade and rollback

Use the separately released Server patch that packages this exact component.
Retain existing Compose environment, persistent volumes and the previous
immutable image. No database migration or runtime patch is required. This work
does not authorize company deployment or a change to HAProxy/OIDC settings.
