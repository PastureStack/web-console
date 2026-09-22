# Web Console 1.6.123

Web Console 1.6.123 aligns workload entry points and account identity display
with the authorization data returned by the current environment.

## Permission-aware workload entry points

- Stack, service, load-balancer, alias, external-service, virtual-machine, and
  catalog launch routes verify the effective schema before loading. Direct URL
  navigation cannot bypass a missing POST or PUT method.
- The stack, service, and catalog creation controls are hidden when the same
  schema method is absent. Catalog refresh and environment-catalog management
  additionally require a project management action link.
- Capability properties depend on the current project, so changing
  environments re-evaluates the server-provided schema instead of retaining a
  previous environment's decision.
- The console does not redefine roles. The owner, member, restricted,
  read-only, and no-access matrix remains the Server's authorization contract.

## Account identity inventory

- Account administration always shows name and description, including an
  explicit empty value when the account has no description.
- Each displayed account loads its exact `authIdentityLink` collection. Local
  and OpenID Connect identities are rendered from those authoritative links;
  legacy account fields are used only as a compatibility fallback.
- Editing an account preserves the loaded identity inventory without writing
  it back as account data.

## Verification boundary

Focused route and controller tests cover authorized create, denied direct
navigation, PUT-only upgrade, project-switch capability invalidation, catalog
management guards, and exact account-to-identity filtering. The full Node 24
browser suite, production build, and isolated multi-account authorization
matrix remain release gates.

Use this release with Orchestration Engine `0.183.317` and PastureStack Server
`v1.6.458`. No HAProxy, authentication-provider, Cookie, MFA, Passkey, terminal,
log-window, or workload runtime contract changes are required.
