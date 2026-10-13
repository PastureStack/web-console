# Web Console 1.6.185

## Scope

Personal API Keys no longer require an accessible environment. The independent
`/account/keys` page shares the existing Key route, controller, editor, and audit
template through an account-only variant. It loads owner-filtered `userStore`
collections only; it does not query or display environment Keys.

Users without a selected environment receive one context-free API navigation
entry. Existing environment navigation, Key pages, and Hooks remain unchanged.
Key audit actions retain the account page and its `targetKey` query parameter;
changing the viewer still clears the previous viewer's audit selection.

No backend authorization, policy grant, authentication, session-generation,
cookie, OIDC, TOTP, Passkey, stylesheet, or translation contract is changed.
Existing permission-denied and load failures propagate to the normal error UI.

## Verification

Ten focused Chrome tests passed for the shared route and controller, owner-only
lists, absent restricted-schema fallback, errors, navigation, and both Key types'
audit actions. The existing environment-mode behavior is included in this
affected-area check; unrelated suites were not replayed.

Production packaging, Server component pairing, and native account-page
acceptance are separate gates. This source note does not claim complete
resource/role-matrix acceptance or a deployed Server image.

## Compatibility

The independent account page uses the existing account API and schema
capabilities. It adds no API endpoint, special request header, or permission.
Use the Server repository's current-release guide for the published immutable
image and installation instructions.
