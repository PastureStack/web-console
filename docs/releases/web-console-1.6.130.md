# Web Console 1.6.130

Direct stack, account-list, and account-security routes now pass useful,
localized 403/404 and server-failure explanations to the existing error page.
The 401 path remains unchanged so the shared-session recovery logic retains
ownership of expired sessions. A 403 is presented like a missing resource on
direct resource reads, without exposing whether another account owns it.

The account list no longer treats every identity-link 404 as an empty identity.
Only an inactive account with the explicit `AccountNotFound` code gets the
historical-row fallback; authorization and backend failures remain visible.
Account password and environment-member validation messages are translated.
Traditional Chinese and English copy is included; other bundled locales use
the existing English fallback until reviewed translations are available.

Focused Chrome unit and integration tests cover direct-route 401/403/404/5xx,
identity-link denial, translated validation, and capability-aware environment
edits. No backend permission, OIDC, session, or API contract changes are made
by this Web Console release.
