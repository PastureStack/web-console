# Web Console 1.6.172

Published first-delivery repair. Official tests and signed immutable component
publication are complete; separate QA deployment and fresh-key native acceptance
remain pending. Historical failed receipts remain HOLD.

## Root cause and contract

Revision 5 correctly adopts a newer cached subscribe model instead of importing
an older POST/201 snapshot. For an API key, subscribe can already contain
`secretValue: null`; discarding the whole 201 also loses its only delivery of the
new secret. The API-key editor therefore cannot show its expected detached
first-delivery clone. Requiring canonical Store secrets to survive later
redacted subscribe updates is neither the fix nor the acceptance contract.

Engine 333 source `0d94f7d879d314235e582a7f4062914a27b82709` maps auth-overlay
permission `o` to `FieldImpl.readOnCreateOnly` in `AuthOverlayPostProcessor`.
`Field.isReadOnCreateOnly` and its JavaBean implementation export the actual
Schema resource-field property `readOnCreateOnly`. This repair uses that exact
property; it does not invent a schema flag or merge all create-response fields.

## Minimal change

An ID-less create request captures only Schema-marked field names in its
nonenumerable internal identity metadata. An opt-in request-private Symbol
callback transports only those successful POST/201 values. API-key editing is
the sole NewOrEdit opt-in. Values are withheld from the canonical import and
consumed once into the editor's detached clone, whose visible/copy value remains
independent of later subscribe redaction. Normal cached state and nested models
are not re-imported from the older response.

Delivery requires the same Store, generation, API base, exact generated ID,
concrete type and account binding. The existing save owner clears only its own
pending callback and delivery, including failed hooks and synchronous completion
exceptions. Duplicate submissions neither resend create nor clear the owner's
lock or values. Existing hook arguments/results, non-opted-in consumers, backend
permissions, API payloads and request counts remain unchanged.

API-store compatibility revision 6 is a new archive. Earlier archives and
upstream license text are retained; dependency versions and graph are unchanged.
The source/package checker accepts Windows license line endings while requiring
the unchanged upstream content and exact source/archive equality.

## Verification boundary

The ten prior installed-Store ordering regressions remain. Added cases cover
actual API-key doneSaving delivery, redacted subscribe before 201, later
redaction, personal/project Stores (100 deterministic deferred HTTP barriers
each, without sleeps), uncached one-shot delivery, private metadata, store/
generation/base/type/account mismatch, and synchronous delivery exceptions.
NewOrEdit tests cover delivery cleanup across success, request rejection,
synchronous doneSaving/completion exceptions and rejected duplicate submissions;
ordinary consumers keep their prior options and return value.

Exact-source official validation
[37109872791](https://github.com/PastureStack/web-console/actions/runs/37109872791)
passed 808/808 tests with zero failures, skips or todo, including fourteen
installed-Store ordering cases and two save-owner cases. The two production
builds produced byte-identical archives. The signed immutable numeric
[release](https://github.com/PastureStack/web-console/releases/tag/1.6.172)
pins source `daab6e8ed5206562feb60e6549a3b9e72b4c8381` and tested tree
`8f6c8eb930fe77d6983a37e9b30912a384af5e7e`; source, merge-source and tag
signatures were verified. Later documentation commits are not the tested
runtime source. Archive SHA-256 is
`9a21c5e6ff9fbb274dbc7c45ec1ccffdbff33a945544b64d5976b14ee9752bfa`
(2,981,642 bytes). Anonymous public archive and checksum downloads match the
same formal CI bytes. Publication reused that archive without rebuilding.

The build audit is `PASS_BUILD_VENDOR_PENDING`, not a zero-vulnerability claim.
The reviewed development-only `GHSA-vfj7-8cjw-p6xm` closure remains vendor
pending; dependency versions, graph and audit thresholds are unchanged. No
runtime-not-affected claim is made. See the
[bounded review record](../security/npm-vendor-pending.json).

Separately published
[Server `v1.6.510`](https://github.com/PastureStack/server/releases/tag/v1.6.510)
packages Engine333 and this exact Web Console source/archive. Its
[official publication run](https://github.com/PastureStack/server/actions/runs/37110936143)
and public GHCR readback verify the immutable image, component identity and
release assets; they do not establish QA deployment or native fresh-key
first-delivery acceptance. Those gates remain pending. Earlier local dependency
layout failures and native HOLD receipts are not promoted by the official CI
success. The complete permission/resource/locale matrix remains INCOMPLETE.

## Upgrade and rollback

Use only the separately published Server package containing this exact component.
Retain existing settings, persistent volumes and previous immutable artifacts.
This Web Console repair adds no database migration or backend API/permission
change. Component and Server publication do not authorize deployment, live
retries or a change to authentication settings.
