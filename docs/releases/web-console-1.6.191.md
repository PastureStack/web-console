# Web Console 1.6.191

Published [1.6.191](https://github.com/PastureStack/web-console/releases/tag/1.6.191)
is an immutable security dependency refresh. Component publication and its
focused validation do not establish Server packaging, deployment or full-matrix
acceptance.

## Publication and validation

Signed producer: `1452148e0ca2c0dc798dc08a653eb90196d4f88b`. Protected
[PR #213](https://github.com/PastureStack/web-console/pull/213) merged as
`2405dfe5310f50e149550ee2f8f8fa55fff85c66`, with the identical tested tree
`c2b98b05f8da5cf4a8acaa2e630150ec92acd2ad`. The immutable numeric tag is
`1.6.191`; later documentation commits do not replace the producer.

The original CI archive, `web-console-1.6.191.tar.gz`, is 3,037,180 bytes,
SHA-256 `f9b28c25ae27057ae39e55fb29400b8ac459e07632a441eea011591f305950ab`.
The published archive and checksum passed anonymous readback. Publication used
the tested artifact without rebuilding it, retaining all thirteen locales.

[CI 39356413277](https://github.com/PastureStack/web-console/actions/runs/39356413277)
passed 36 focused Node tests, four native Chrome compiled-template tests, the
exact raw audit gate, actual Webpack and concat module inventories, the static
archive contract and two byte-identical production archives. Required CodeQL
checks passed independently. This evidence does not replace unrelated
historical acceptance results or complete pending role/backend/lifecycle/KVM
matrix items.

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

The raw source/build npm audit retains 29 Moderate, 7 High and 0 Critical
findings. Rechecked on 2026-10-20.
[braces CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
still has no official patch. Its raw HIGH severity is retained. The exact
seven-node build-only dependency closure is reviewed until 2026-10-27 00:00 UTC,
with expiry, new HIGH/CRITICAL, dependency drift, production reachability and
shipped-module checks remaining fail-closed. It is not a runtime waiver or an
upstream fix. The release's actual production module inventories passed.

[sprintf-js CVE-2026-97058](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)
also has no official patched version. Keep it tracked rather than accepting an
unrelated parent downgrade suggested by `npm audit fix --force`. No upstream
package is locally patched for these findings.

Official fixed advisories:
[Handlebars](https://github.com/handlebars-lang/handlebars.js/releases/tag/v4.7.10),
[fast-uri](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj).
