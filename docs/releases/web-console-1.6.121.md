# Web Console 1.6.121

- Treat the HTTP 200 provider login-options object returned by `GET /token` as
  unauthenticated when `accountId`, `user`, and `userIdentity` are all empty.
  Current-token validation deliberately does not depend on an exposed JWT.
- Normalize that response to `{status: 401, message: 'No authenticated
  session'}` so authenticated and login routes use the existing recovery path
  instead of adopting an expired Cookie and entering a loading loop.
- Preserve the origin-level authentication mutex and generation ownership: only
  a still-matching Cookie and generation are cleared, exactly once. A delayed
  response cannot clear a newer login, and passive recovery never sends
  `DELETE /token/current`.
- Add deterministic coverage for the login-options response in
  `ensureSession`, direct validation, three simultaneous passive failures, and
  a newer session committed behind a deferred response. Existing 100-run
  TOTP/Passkey race, OIDC callback, explicit logout, 403, and cookie-readback
  tests remain part of the release gate.

Use this release with Authentication Service `v0.4.41` and Orchestration Engine
`0.183.309` or newer for the complete session-bound logout and OIDC access-policy
contract.
