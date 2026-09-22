# Security Policy

## Supported state

The maintained compatibility release is the pure numeric `1.6.124` line used
by the current PastureStack Server release. Earlier branded coordinates are
historical records and are not current release or deployment targets.
Authentication-provider combinations must still be validated by an
administrator before activation.

## Security boundaries

- The console handles API credentials, cookies, authentication redirects, secrets, shell and console sessions, logs, and user-supplied content.
- OpenID Connect state, nonce, PKCE verifier, authorization code, and provider
  configuration are sensitive. The browser must verify state before accepting
  a callback, must not reuse authorization codes, and must not retain flow
  material after completion or failure.
- Testing a proposed OpenID Connect provider must not change the active
  authentication method or write an upstream access token into a browser
  cookie. A fresh authorization flow is required for activation.
- External identities are assigned by their exact provider, issuer, and
  subject. A username, display name, or email address is never an automatic
  account-matching key.
- Provider switching keeps access control enabled and uses short-lived,
  single-use proofs bound to the intended account and identity. Local recovery
  is restricted to an active system administrator and remains subject to MFA.
- MFA login must complete before a browser session is stored. TOTP and email
  challenges are rate-limited, single-use, and short-lived; email is an
  account-recovery channel, not an authentication factor.
- Browser tabs share one origin-level authentication mutex. Only explicit user
  logout may revoke a server token; passive failures reconcile session
  generation ownership without clearing or revoking a newer session. Cookie and
  generation reads occur after acquiring that mutex, and login-route recovery
  revalidates a committed session if a storage or channel notification was
  missed during navigation. JWTs must never be written to Web Storage, URLs,
  logs, or diagnostics. A successful current-token HTTP response is not
  sufficient proof of an authenticated session: provider login options with no
  account, user, or user identity must follow the same non-destructive 401
  recovery path.
- MFA enrollment, recovery-code generation, and recovery-address verification
  require the account holder's own authenticated session. Administrators may
  inspect and revoke another account's factors, but cannot create or retrieve
  authentication material for that account.
- Authenticator-enrollment QR codes are generated locally in the browser; a
  provisioning secret must never be sent to an external rendering service.
- OIDC site-access expansion uses a one-time MFA confirmation bound to the
  authenticated operator, fixed operation purpose, and canonical request
  digest. The browser retries the save at most once and clears the confirmation
  ticket on success, cancellation, and failure. Unrestricted mode must submit an
  explicit empty authorized-identity list.
- WebAuthn requires user verification, the exact origin, a matching
  relying-party ID, and a non-public-suffix relying-party domain. HTTP is
  accepted only for a loopback test origin.
- Remote API, catalog, log, terminal, and error content must be treated as untrusted.
- Bundled browser dependencies, generated assets, and source maps require review before publication.
- Do not commit credentials, private endpoints, captured production responses, certificates, or session data.

## Reporting

Report suspected vulnerabilities through this repository's private security advisory channel. Do not include credentials or production data in a public issue.
