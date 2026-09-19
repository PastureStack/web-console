# Web Console 1.6.120

- Move shared cookie and session-generation reads inside the origin-level
  authentication mutex, eliminating the half-committed state observed when a
  peer tab reacted between cookie write and generation commit.
- Deliver session ownership changes through both browser storage events and a
  non-sensitive `BroadcastChannel`, then serialize duplicate or overlapping
  removal and login notifications through one reconciliation path.
- Revalidate a committed cookie when a tab enters the login route, so a refresh
  or a notification missed during navigation resumes the authenticated session
  without repeating OIDC, TOTP, or Passkey. Active OIDC callbacks retain their
  captured generation and continue through the stale-callback guard.
- Route initial-transition 401 failures through the owning transition, preserve
  ordinary 403 permission failures, and keep direct post-refresh logout bound
  to the generation that was actually revalidated.
- Add deterministic barriers for cookie/generation commit ordering, queued
  removal/login events, refresh recovery, and TOTP/Passkey delayed-401 races.
  The race suite repeats the critical ordering 100 times.
- Add production browser acceptance for three same-origin tabs, automatic
  adoption, authenticated API and WebSocket access, zero passive DELETEs, one
  coalesced explicit DELETE, and absence of JWT material in Web Storage.

Use this release with Authentication Service `v0.4.39` and Orchestration Engine
`0.183.309` or newer for the complete session-bound logout and OIDC access-policy
contract.
