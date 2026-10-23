# Web Console 1.6.194

Published from signed producer `f47283ff6d18516040c0ee0782ac0a0314b67538`.
The original 3,093,881-byte `web-console-1.6.194.tar.gz` has SHA-256
`fe83f57dd1202766579b848f1bee75e7c05536db2fbb1f58de2bbb21829b1221`.
Its anonymous download matches the retained CI artifact. The protected
PR #220 merge is signed and has the same source tree.

The static build toolchain moves to the official Node.js 24.22.1 security
release, with npm 12.0.2 and the existing browser package versions. The Node
archive SHA-256 and immutable builder digest are pinned. CI source verification
uses Python 3.14.9, pip 26.2.2, and certifi 2026.10.19.

The archive layout, API contracts, service-upgrade behavior, and 13 locales
retain the previous release contract.
[Exact-producer CI](https://github.com/PastureStack/web-console/actions/runs/39949985532)
passed 36 focused Node checks, four native Chrome template tests, the existing
dependency-security gate, module inventory and two byte-identical production
builds. The archive contains all 13 locales and no source maps. Required
CodeQL checks passed independently. Existing reviewed build-only dependency
exceptions were not expanded. Server assembly, deployment and unrelated
resource/role matrices remain separate evidence.
