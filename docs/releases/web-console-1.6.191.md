# Web Console 1.6.191

Security dependency refresh; publication and packaged-Server verification are
pending until linked to immutable build evidence.

## Changes

- Handlebars `4.7.9` → `4.7.10`: official fixes for CVE-2026-106444,
  CVE-2026-106445 and CVE-2026-106446. This package is used by Node build tools,
  not Ember's separate Glimmer compiler. Package presence alone does not prove
  an exploitable deployed endpoint.
- fast-uri `3.1.7` → `3.1.8`: official host normalization fix for CVE-2026-86472.
- The active browser-test baseline must match the actual release lock; tests no
  longer replace the current lock with an older dependency graph. The browser
  harness uses the supported `testem.js` configuration.
- Dependency-only validation covers patched package behavior, audit fail-closed
  cases, native compiled-template tests, two reproducible production builds,
  browser module inventories and the existing static archive contract. Separate
  required CodeQL checks are not skipped by this validation scope.

No application API, role, token/session, OIDC, MFA, lifecycle or runtime security
setting changes are included. Unaffected historical acceptance evidence remains
valid; this refresh does not complete unrelated pending matrix items or KVM.

## Official findings still pending

Rechecked on 2026-10-20. [braces CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
still has no official patch. Its raw HIGH severity is retained. The exact
seven-node build-only dependency closure is reviewed until 2026-10-27 00:00 UTC,
with expiry, new HIGH/CRITICAL, dependency drift, production reachability and
shipped-module checks remaining fail-closed. It is not a runtime waiver or an
upstream fix. The real production module inventory must pass before publication.

[sprintf-js CVE-2026-97058](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)
also has no official patched version. Keep it tracked rather than accepting an
unrelated parent downgrade suggested by `npm audit fix --force`. No upstream
package is locally patched for these findings.

Official fixed advisories:
[Handlebars](https://github.com/handlebars-lang/handlebars.js/releases/tag/v4.7.10),
[fast-uri](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj).
