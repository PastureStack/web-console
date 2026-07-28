# Multi-factor authentication

PastureStack places the MFA gate after primary authentication and before a
platform session is created. A pending challenge stays only in memory in the
browser; no session cookie is written until verification succeeds.

## Supported methods

- Authenticator applications use RFC 6238 TOTP with a 160-bit secret, SHA-1,
  six digits, and a 30-second period. The server accepts only the immediately
  adjacent clock steps and rejects reuse of an accepted step.
- Passkeys use WebAuthn and support platform authenticators such as Windows
  Hello, cross-device phone flows, and hardware security keys. User
  verification is required.
- Recovery codes are randomly generated, stored only as hashes, shown once,
  and consumed once.
- A verified email address can recover an account after primary
  authentication. Email is not presented as an MFA factor. Successful email
  recovery revokes existing factors and sessions, then requires fresh
  enrollment.

The passkey limit defaults to five per account and can be configured from one
to twenty. TOTP is intentionally one shared-secret enrollment per account;
passkeys provide the multi-device option.

## Administrator workflow

The MFA administration page lets a system administrator select an active
interactive account, inspect its factors, register a factor with the account
holder, revoke individual or all factors, regenerate recovery codes, and
verify or remove a recovery email address. Register a factor for another
account only on that account holder's trusted device.

Changing factors, recovery codes, or a recovery email revokes that account's
active sessions. If the administrator changes their own account, the console
requires sign-in again after any one-time recovery codes have been saved.

Before enforcing MFA for administrators or all users, the current
administrator must already have a primary factor. An enrolled account cannot
remove its last required factor; another factor must be registered first.

## WebAuthn configuration

Configure the exact browser origin, relying-party ID, and display name.
Production origins must use HTTPS. The relying-party ID must equal the origin
host or be a registrable parent domain; public suffixes are rejected. Plain
HTTP is accepted only for `localhost` or another loopback origin used in an
isolated test.

Changing the origin or relying-party ID is blocked while passkeys exist,
because existing credentials are scoped to the old relying party.

## SMTP and email recovery

SMTP settings include the server, port, sender, optional credentials,
connection and read timeouts, TLS mode, and code lifetime. Remote SMTP must use
STARTTLS or implicit TLS with hostname verification. Plain SMTP is accepted
only on loopback for an isolated fake-server test.

Use **Save and send test email** to validate a candidate configuration before
it is persisted. A failed test does not replace the working configuration.
Saved SMTP passwords are encrypted and are never returned by the API; the
administrator can replace or explicitly clear one.

Email security codes contain six digits, expire within ten minutes, are
single-use, and stop accepting guesses after five failed attempts. Sending is
rate-limited.
