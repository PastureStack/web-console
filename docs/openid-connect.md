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

Keep a tested local administrative account available as a recovery path.

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

## Private certificate authorities

For a private identity provider, paste the PEM-encoded issuing certificate
authority into the certificate-authority field. This extends the service's
system trust store. It does not turn off hostname or certificate validation.

The browser must also trust the identity provider through the organization's
normal endpoint-management policy.

## Claims and groups

The default claim mapping is:

- username: `preferred_username`;
- display name: `name`;
- email: `email`;
- groups: `groups`.

Claim names can be changed for providers that publish equivalent information
under different keys. The `openid` scope is always required. Add `profile`,
`email`, or a provider-specific group scope only when those claims are needed.

## Recovery

Do not sign out of the existing administrative session until the activated
provider has completed a fresh login and the access-control page reloads
successfully. If the final session exchange fails, the console attempts to
return OpenID Connect to a disabled recovery state and reports that local
authentication remains available.

