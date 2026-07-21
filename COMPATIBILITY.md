# Compatibility Contract

Web Console preserves compatible API paths, schema and resource names, action names, setting keys, authentication routes, catalog fields, orchestration framework identifiers, generated model properties, and server-provided links.

Visible branding, product-owned assets, icon identifiers, package metadata, and operator documentation use PastureStack. Historical identifiers remain only where they are server data or protocol contracts and must not be mechanically replaced.

The published package identity is `@pasturestack/web-console`, while the Ember 2 runtime keeps the neutral internal `ui/` module prefix used by existing imports. The static server artifact must contain a fingerprinted `/assets/ui*.js` entry and matching `index.html` reference; changing either side requires a coordinated Server packaging test.

Before release, validate login and logout, environment selection, hosts, stacks, services, containers, shell, logs, console, catalog, storage, networking, access control, settings, API errors, browser navigation, `en-US`, and `zh-TW` against an isolated compatible server.
