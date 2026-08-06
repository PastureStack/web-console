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

Catalog localization is additive. The canonical `name` and `description`
fields remain unchanged, while optional
`io.pasturestack.catalog.name.<locale>` and
`io.pasturestack.catalog.description.<locale>` labels provide exact-locale
display text. Missing or blank labels must fall back to the canonical fields.
