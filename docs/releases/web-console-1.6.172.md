# Web Console 1.6.172

Candidate first-delivery repair. Official tests, publication and packaged QA
are separate pending gates; historical failed receipts remain HOLD.

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

Source/package checks pass. The local Chrome suite has not started because the
local junction-based dependency layout is incomplete; it is not reported as a
test PASS. Exact-source official tests, immutable publication and packaged native
first-delivery acceptance remain pending. Historical HOLDs and the complete
permission/resource/locale matrix are not promoted.

## Upgrade and rollback

Use only a separately published Server package containing this exact component.
Retain existing settings, persistent volumes and previous immutable artifacts.
No database migration or backend change is required. This candidate does not
authorize deployment, live retries or a change to authentication settings.
