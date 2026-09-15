# Web Console 1.6.118

- Clear `allowedIdentities` whenever OIDC site access switches to unrestricted,
  preventing a stale allowlist from surviving a permission expansion.
- Normalize and deduplicate restricted or required OIDC users and groups by
  principal type and immutable external ID before submission.
- Handle stable Authentication Service policy errors without exposing raw
  response content. Local recovery, MFA confirmation, and invalid identity
  policies now produce distinct localized guidance.
- Bind an access-expansion confirmation to the backend-supplied operation
  purpose and canonical request digest, then retry the save exactly once.
  Malformed challenges are rejected before opening the dialog, and the one-time
  ticket is cleared after success, cancellation, or failure.
- Preserve the complete `1.6.117` cross-tab session-ownership fix, including
  explicit-only token revocation, deterministic session-generation adoption,
  stale callback protection, refresh recovery, and JWT confinement to cookie
  and memory.
- Add focused browser-unit coverage for unrestricted clearing, principal
  normalization and deduplication, stable errors, malformed challenges, and
  bounded MFA retry behavior.

Use this release with Authentication Service `v0.4.37` and Orchestration Engine
`0.183.303` or newer for the complete OIDC policy-update boundary.
