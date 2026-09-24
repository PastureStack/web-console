# Web Console 1.6.132

Environment detail/edit now loads its network list with the selected project's
`X-Api-Project-Id` header. The same route already used that header to find the
official network-policy-manager stack, and the form already used it when
saving a network policy. For a non-admin project member, the old unscoped
network query returned an empty list, so the form hid valid network policy
controls even though a scoped API request could read and update the network.

The route test checks that the network filter and project header both refer
to the selected environment. The API's per-role update capability remains the
source of truth; this release does not grant new network permissions.

This is a browser-only correction paired with the unchanged Orchestration
Engine `0.183.322`. It does not change OIDC, MFA, project membership, or
network-policy-manager behavior.
