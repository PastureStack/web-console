# Security Policy

## Supported state

This repository is under migration review and is not release-ready.

## Security boundaries

- The console handles API credentials, cookies, authentication redirects, secrets, shell and console sessions, logs, and user-supplied content.
- Remote API, catalog, log, terminal, and error content must be treated as untrusted.
- Bundled browser dependencies, generated assets, and source maps require review before publication.
- Do not commit credentials, private endpoints, captured production responses, certificates, or session data.

## Reporting

Report suspected vulnerabilities through this repository's private security advisory channel. Do not include credentials or production data in a public issue.
