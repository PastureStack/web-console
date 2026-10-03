# Web Console 1.6.173

Candidate; official validation and publication are pending.

## Root cause and minimal repair

The environment-create form maps native `ProjectTemplate` resources to choice
cards. It incorrectly read `localizedName`, a Catalog Template property which
the native model does not implement, leaving labels empty. Read the native
resource's `name` instead. Preserve the existing name-dependent sorting and
selection by exact template ID; do not translate user-defined names or add a
fallback which conceals a missing model contract.

The bounded consumer review found this incorrect native-model lookup only in
`app/components/view-edit-project/component.js`. Catalog templates legitimately
use `localizedName` and are unchanged. No API, permission, membership, save-hook,
OIDC, MFA, session-generation or WebSocket contract changes.

## Verification and release boundaries

Regressions must use the real native model without an invented `localizedName`,
verify rendered labels and sorting, rename reactivity and exact-ID card
selection. Existing environment permission tests remain applicable. Packaged
native creation, owner/member Host acceptance and the fresh API-key delivery
acceptance remain separate gates. Historical HOLD receipts remain HOLD and
the full permission/resource/locale matrix remains INCOMPLETE.

Use a new immutable numeric component tag and a new immutable Server patch
image. Preserve existing Compose options, volumes, HTTPS origin and prior image
for rollback. Do not deploy the company instance as part of this QA repair.
