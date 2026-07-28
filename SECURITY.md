# Security Policy

## Supported state

The `1.6.56-pasturestack.x` compatibility line is maintained for the matching
PastureStack Server release. Authentication-provider combinations must still
be validated by an administrator before activation.

## Security boundaries

- The console handles API credentials, cookies, authentication redirects, secrets, shell and console sessions, logs, and user-supplied content.
- OpenID Connect state, nonce, PKCE verifier, authorization code, and provider
  configuration are sensitive. The browser must verify state before accepting
  a callback, must not reuse authorization codes, and must not retain flow
  material after completion or failure.
- Testing a proposed OpenID Connect provider must not change the active
  authentication method or write an upstream access token into a browser
  cookie. A fresh authorization flow is required for activation.
- Remote API, catalog, log, terminal, and error content must be treated as untrusted.
- Bundled browser dependencies, generated assets, and source maps require review before publication.
- Do not commit credentials, private endpoints, captured production responses, certificates, or session data.

## Reporting

Report suspected vulnerabilities through this repository's private security advisory channel. Do not include credentials or production data in a public issue.
