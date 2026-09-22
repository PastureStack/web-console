# Web Console 1.6.125

Web Console 1.6.125 keeps the account administration page usable when its
inventory includes an inactive historical account.

## Account identity loading

- Every readable account still receives a fresh, exact-account
  `authIdentityLink` query, so OpenID Connect and local login identities remain
  authoritative and cannot bleed between rows.
- An `AccountNotFound` response from that endpoint is isolated to the affected
  historical row. The row remains visible and uses its embedded
  `externalIdType` and `externalId` as the existing display fallback.
- HTTP 401, 403, 5xx, transport, and unexpected failures are not swallowed;
  they continue to reject the route and reach the diagnostic error page.
- Account name and description rendering, MFA controls, authorization schema,
  session generation, mutex, session-bound logout, and OpenID Connect flows are
  unchanged.

## Verification boundary

Focused route tests cover authoritative links, isolated HTTP 404 fallback, and
propagation of non-404 failures. Browser acceptance uses a bound administrator
session against the QA API and verifies every rendered account row, description
cell, and identity cell before one explicit session-bound logout.

Use this release with Orchestration Engine `0.183.318` and PastureStack Server
`v1.6.461`. No HAProxy or identity-provider configuration change is required.
