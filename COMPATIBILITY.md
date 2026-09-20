# Compatibility Contract

Web Console preserves compatible API paths, schema and resource names, action names, setting keys, authentication routes, catalog fields, orchestration framework identifiers, generated model properties, and server-provided links.

Visible branding, product-owned assets, icon identifiers, package metadata, and operator documentation use PastureStack. Historical identifiers remain only where they are server data or protocol contracts and must not be mechanically replaced.

The published package identity is `@pasturestack/web-console`, while the Ember 2 runtime keeps the neutral internal `ui/` module prefix used by existing imports. The static server artifact must contain a fingerprinted `/assets/ui*.js` entry and matching `index.html` reference; changing either side requires a coordinated Server packaging test.

Before release, validate login and logout, environment selection, hosts, stacks, services, containers, shell, logs, console, catalog, storage, networking, access control, settings, API errors, browser navigation, `en-US`, and `zh-TW` against an isolated compatible server.

The generic OpenID Connect interface depends on the authentication service
publishing `oidcconfig` and the staged `POST /v1-auth/redirectUrl` contract.
Configuration validation and the first real provider sign-in do not replace
the active authentication method. Activation uses a fresh authorization code
and the normal platform token endpoint; an authorization code is never reused.
The Web Console stores PKCE verifier, state, and nonce only for the active
browser flow and clears them after completion or failure.

Authentication errors may arrive either as a transport wrapper or as a
top-level structured rejection. Both forms must retain the stable error code
and the operation-bound MFA request digest; malformed digests never trigger a
confirmation retry. Load-balancer target selectors use explicit one-way data
flow back to the owning `PortRule.serviceId`, and the resource serializer must
carry that value in editing PUT requests. API hydration remains authoritative
over local model defaults, including nullable health states.

Same-origin tabs coordinate login commit, session adoption, and explicit logout
through one mutex. A peer must read both the cookie and the non-sensitive
generation only after it owns that mutex, validate `GET /token`, and recover on
the login route if a storage or `BroadcastChannel` notification was missed.
Passive 401, 403, WebSocket, timer, storage, and route errors must never invoke
server-side logout; only a user action may issue the generation-bound DELETE.
The current-token collection is authenticated only when its first token carries
a non-empty `accountId`, `user`, or `userIdentity`. A provider login-options
object returned with HTTP 200 and no identity is an unauthenticated response,
not a session. The console converts it to its stable local 401 contract and may
clear shared state only while the same Cookie and generation still match under
the authentication mutex; recovery routes to login instead of reloading.

Catalog localization is additive. The canonical `name` and `description`
fields remain unchanged, while optional
`io.pasturestack.catalog.name.<locale>` and
`io.pasturestack.catalog.description.<locale>` labels provide exact-locale
display text. Missing or blank labels must fall back to the canonical fields.
