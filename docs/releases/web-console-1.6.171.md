# Web Console 1.6.171

Candidate shared Store fix; publication and packaged QA remain separate gates.

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
Exact-source official validation, signed numeric release and packaged native
fresh-volume create/cancel/refresh/denial/removal remain pending.
Historical failed QA receipts stay HOLD; the complete
permission/resource/locale matrix remains INCOMPLETE.

## Upgrade and rollback

Use the separately released Server patch that packages this exact component.
Retain existing Compose environment, persistent volumes and the previous
immutable image. No database migration or runtime patch is required. This work
does not authorize company deployment or a change to HAProxy/OIDC settings.
