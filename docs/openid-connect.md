# OpenID Connect

PastureStack Web Console provides one provider-neutral OpenID Connect
configuration card. Vendor-specific buttons and configuration pages are
intentionally not added.

## Before configuration

Create a confidential OpenID Connect client in the identity provider and
register the control-platform callback:

```text
https://CONTROL-PLATFORM/login/oidc-auth
```

Use the exact scheme and authority that browsers use to reach the platform.
The provider must expose a discovery document, an authorization endpoint, a
token endpoint, a JSON Web Key Set endpoint, and a UserInfo endpoint.

Keep at least one tested local system-administrator account available as a
recovery path. Enabling an external provider does not delete or replace that
account's local password.

## Configuration flow

The access-control page separates configuration into three explicit steps:

1. **Validate configuration** checks discovery, endpoint security, TLS trust,
   client settings, and supported signing algorithms without changing the
   active provider.
2. **Test sign-in** completes a real authorization-code exchange. The test
   result proves that the proposed configuration can authenticate, but it does
   not create a platform browser session or expose the provider access token.
3. **Activate and sign in** starts a second, fresh authorization flow, enables
   the reviewed configuration, and creates the session through the normal
   platform token endpoint.

Changing any field invalidates the prior validation and test result.
Authorization codes are single-use and are never carried from the test flow
into activation.

The browser treats the embedded provider configuration as a dedicated writable
resource. Provider labels are configuration data and are not derived from the
display-name calculation used by infrastructure resources.

## Private certificate authorities

For a private identity provider, paste the PEM-encoded issuing certificate
authority into the certificate-authority field. This extends the service's
system trust store. It does not turn off hostname or certificate validation.

The browser must also trust the identity provider through the organization's
normal endpoint-management policy.

## Platform accounts and sign-in identities

A platform account is the stable authorization principal. Local credentials
and external identities are login methods linked to that account; changing the
active provider does not create a new permission container.

An OpenID Connect identity is matched only by the provider's exact `issuer`
and immutable `sub` claim. Display names, usernames, and email addresses are
never automatic matching keys. This prevents two people with a reused or
duplicate profile field from receiving each other's permissions.

After a test sign-in, a system administrator must choose one explicit action:

- link the verified identity to the selected existing platform account;
- keep its existing account assignment;
- reassign it from a named source account to a named target account.

Reassignment can copy direct project memberships and administrator access to
the target account. It never copies passwords, API keys, active sessions,
personal MFA factors, recovery methods, or audit history. The administrator
must then choose whether the old account is kept, disabled, or stripped of
direct permissions and disabled. A disabled matched account has a separate
restore action.

Every destructive choice is displayed in an exact confirmation summary.
Changing the source, target, permission choice, or old-account disposition
invalidates that confirmation.

## Claims and groups

The default claim mapping is:

- username: `preferred_username`;
- display name: `name`;
- email: `email`;
- groups: `groups`.

Claim names can be changed for providers that publish equivalent information
under different keys. The `openid` scope is always required. Add `profile`,
`email`, or a provider-specific group scope only when those claims are needed.

## Safe provider switching and recovery

Access control remains enabled throughout a provider change. The platform
issues a short-lived, account-and-identity-bound, single-use switch ticket
before changing the provider. The final sign-in must prove the same external
identity. If it fails, the prior authenticated browser session is restored and
the ticket can establish the verified recovery administrator session without
resetting a password.

When an external provider is unavailable, the sign-in page exposes a distinct
local-recovery path. It accepts only an existing, active local system
administrator and still applies that account's MFA policy. A system
administrator can also verify an existing local administrator from the
access-control page and switch the active provider back to local
authentication without ever disabling security.

Provider changes invalidate sessions issued by the previous provider. Do not
remove the final tested local recovery credential.
