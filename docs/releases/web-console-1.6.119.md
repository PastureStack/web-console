# Web Console 1.6.119

- Replace the getter-only external-service `healthState` computed property with
  a writable default so API hydration can preserve `healthy`, unhealthy states,
  and `null` without a setter exception.
- Accept top-level structured Authentication Service rejections in addition to
  transport wrappers. Stable error codes and bound MFA request digests now reach
  the existing strict validation, one-confirmation, one-retry path unchanged.
- Route the service selector through an explicit child action and write the
  result to the owning load-balancer `PortRule.serviceId`. Editing PUT payloads
  now retain the selected backend instead of displaying a value that was never
  saved.
- Add browser regression coverage for writable API model hydration, direct and
  wrapped OIDC errors, malformed challenge rejection, bounded MFA retry, and a
  real DOM service selection through the submitted resource payload.
- Preserve all `1.6.117` cross-tab session-ownership guarantees and the
  `1.6.118` OIDC access-policy flow. JWTs remain outside Web Storage, and only
  explicit logout requests server-side token revocation.

Use this release with Authentication Service `v0.4.38` and Orchestration Engine
`0.183.304` or newer for the complete session, OIDC policy, and identity-type
contract.
