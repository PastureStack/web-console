# Web Console 1.6.124

Web Console 1.6.124 restores authoritative environment selection for direct
links and browser refreshes after the Ember 7 router upgrade.

## Environment routing

- The authenticated parent route reads `project_id` from Ember's public
  destination RouteInfo tree, including nested stack, service, container,
  infrastructure, catalog, and API routes.
- A permitted environment named by `/env/:project_id` is selected before the
  tab-session and saved Default fallbacks. Refreshing or opening a shared link
  therefore cannot silently replace it with another accessible environment.
- The compatibility fallback for older transition stubs remains available.
  Missing, inactive, or inaccessible environment IDs continue through the
  existing server-authorized fallback path.
- No role, schema capability, authentication, Cookie, MFA, Passkey, WebSocket,
  terminal, log-window, or workload runtime contract changes are included.

## Verification boundary

Focused route tests cover a nested Ember 7 RouteInfo tree, the legacy
transition shape, and propagation of the requested project into the shared
project-selection service. The release gate retains the full browser suite,
reproducible production build, and isolated owner, member, restricted,
read-only, no-access, and site-denied authorization matrix.

Use this release with Orchestration Engine `0.183.317` and PastureStack Server
`v1.6.459`. No HAProxy or identity-provider configuration change is required.
