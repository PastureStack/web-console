# Web Console 1.6.200

Web Console 1.6.200 and bridge 0.2.2 are [published](https://github.com/PastureStack/web-console/releases/tag/1.6.200).
The release preserves the original qualified CI artifacts and adds no npm
dependency changes beyond the root package versions. All 13 release assets were
downloaded anonymously and matched their recorded SHA256 values.

## Bounded workflows

Catalog discovery binds the named catalog/template/version and source revision.
The Compose Stack flow accepts supported typed questions and resolves references
by names and returned scoped references. Private answers are completed by the
human in the ordinary console. Launch needs live read/create/update permissions
at the destination, not Project PUT, and uses normal Stack/Compose owners.
Caller-supplied IDs, arbitrary URLs/YAML and extra grants are not accepted.
External volumes, unsupported graph types and other Catalog administration remain
pending; unavailable fields are not counted as accepted coverage.

Stopped Stack/Service Archive and restore use the existing native owner. Running
resources cannot be archived; mounted-directory data needs review. Restore changes
metadata only and never starts workloads. Infra/system and parent/child checks,
current roles, Key ceilings, cross-ID denials and normal audit remain authoritative.

Human review keeps exact source/target bindings and current ownership. Missing or
ambiguous reference choices require explicit selection. Accepted work is not
described as unexecuted; uncertain apply responses retain the original operation.
A fixed background authorization denial stays failed with verifiedResult=false,
warns about possible partial changes through the 13-language alert and retains
the original reference. Late replies cannot clear a newer plan or reopen approval.
Browser tools start off on every new page and require explicit user opt-in.

## Qualification and immutable provenance

The [full producer run](https://github.com/PastureStack/web-console/actions/runs/40956022401)
passed 1,121 Ember tests with zero failures. The
[required CodeQL run](https://github.com/PastureStack/web-console/actions/runs/40956025014)
passed. The actual standalone ZIP passed Node.js 24.22.1 / npm 12.0.2 clean
`npm ci --ignore-scripts --no-audit --no-fund`, 47 Catalog/Archive cases and one
real SDK loopback stdio handshake. These adapter checks are separate from live
Server and browser workflow acceptance.

| Provenance field | Immutable value |
| --- | --- |
| Original artifact producer | `03e0d7b25b8dfcbc45baecf6d448834016aac649` |
| Published tag / squash merge | `af08a99885012eb8c770a3266a341e8ffd2a17f5` |
| Shared source tree | `3ebb0def9e9f1c0c9e412d6c812f79f10df30489` |
| Producer workflow / original artifact ID | `40956022401` / `12934635169` |
| Reviewed Web package lock SHA256 | `1797dd27bb7b1c6b86b8689435e916b03523a9fdf45c5178ec7c2ea05706d4bd` |

The tag and original producer have the same tree. Archive provenance remains
bound to that producer; documentation updates do not replace the released bytes.
The bridge ZIP contains 25 exact Git-source files plus its SBOM and manifest;
its entry point is `bridge/server.mjs`. The template inventory remains 615 actions.

| Published asset | SHA256 |
| --- | --- |
| [Static archive](https://github.com/PastureStack/web-console/releases/download/1.6.200/web-console-1.6.200.tar.gz) | `97fe46c426cb83263fcfc7f5884c15ca90f7ec3ebec71d9ca023d8b7ad2665c0` |
| [Runtime SBOM](https://github.com/PastureStack/web-console/releases/download/1.6.200/web-console-1.6.200-runtime.cdx.json) | `0ce1f6b99e1e449c545d3d7df65302fdb58d1974fecea6477b20262c2148921c` |
| [Build SBOM](https://github.com/PastureStack/web-console/releases/download/1.6.200/web-console-1.6.200-build.cdx.json) | `9f13b3b2a25549fca42283d2cc83df0178c0ecb783f5f2355e696d1f5059baea` |
| [Bridge 0.2.2 ZIP](https://github.com/PastureStack/web-console/releases/download/1.6.200/pasturestack-webmcp-bridge-0.2.2.zip) | `f6c2e4496aaa629925cbfc3217b7bdbfb96d710e9c51899bb8b15d8704c8da7c` |
| [Bridge SBOM](https://github.com/PastureStack/web-console/releases/download/1.6.200/webmcp-bridge.cdx.json) | `dde9f55749b3d5d1d680fe0b334d7b4fb9b3fed10aa59abd4cd4a4cbeba6a723` |

Checksums, artifact manifests and publication metadata are attached to the same
release. Older published versions and their immutable artifacts are preserved.

## Pending acceptance

Combined Server and designated Catalog/Archive browser, role and weak-model
runtime acceptance remain **PENDING**. The current inventory records 54 groups
with partial typed source coverage and 189 without a complete typed workflow,
out of 243 business groups. No whole-group PASS is claimed from those source
counts. Twelve tools and passing component CI do not establish complete frontend
coverage. Earlier unrelated PASS and original failures retain their own scopes.
