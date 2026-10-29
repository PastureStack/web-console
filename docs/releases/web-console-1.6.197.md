# Web Console 1.6.197

Published on 2026-10-29 from original producer
`4c18b92c926bdadc66d9da5cb1e1cedb5d5677f3`. The release tag points to the
approved merge `9245399b13fc92e65418cdc6837c86e5b6774b02`; both have source tree
`b7328e035dabfe4a994ca97bc37f4fe8a857226f`. The original CI bytes were retained
without rebuilding after merge.

[Full producer CI](https://github.com/PastureStack/web-console/actions/runs/40866485520)
passed all 1,121 Ember tests, the existing security checks and a reproducible
double build. The 31 focused session tests passed locally.
[CodeQL](https://github.com/PastureStack/web-console/actions/runs/40866486215)
passed both analyses and its no-new-alerts check. All seven published assets
were downloaded anonymously and matched the retained producer bytes.
Provenance and runtime-SBOM attestations, and the Server SBOM consumer with
`--webmcp-ceiling enabled`, also passed.

| Published artifact | SHA-256 |
| --- | --- |
| [Static archive](https://github.com/PastureStack/web-console/releases/download/1.6.197/web-console-1.6.197.tar.gz) | `f45b4c1357199bed491f5a708d6103996f7f03313b6045d3e81f6bb7464fd7ad` |
| [Runtime SBOM](https://github.com/PastureStack/web-console/releases/download/1.6.197/web-console-1.6.197-runtime.cdx.json) | `04476100b2c764963ed71c33dfb4917e8cb8cae70c5ca0d64d4b34a004b17421` |
| [Build SBOM](https://github.com/PastureStack/web-console/releases/download/1.6.197/web-console-1.6.197-build.cdx.json) | `fc21ff52fdbe28a3eba0bbad38dad247ddf920911bf1e3c3300823111ae78dcd` |

The producer lockfile SHA-256 is
`83f664af0919f9ac42c220064a63f6a6f78b5bf7b4ddaf76601d6d973994a464`.

This maintenance release repairs actor restoration when a valid cookie opens
a fresh browser session. The current-token response can contain a verified
identity while omitting `accountId`; its policy headers identify a virtual
token account. After identity validation, the console reads the authenticated
API root's `X-Api-User-Id` to recover the real actor. It does not decode the JWT
or use a client-supplied identity as an account ID.

A legacy shared session with a null actor is repaired only while its cookie
and generation still match under the existing session mutex. Delayed replies
cannot replace a newer login. Login-options responses remain unauthenticated,
and permission failures keep their existing handling. Ordinary credential and
MFA login flows are unchanged.

The AI collaboration build ceiling remains an explicit producer option, and
each browser page still starts with tools paused. Human approval remains a
normal authenticated UI action. The standalone bridge 0.1.0 and its shared
command-engine sources are unchanged; this release does not republish it.
Its compatible [immutable 0.1.0 ZIP](https://github.com/PastureStack/web-console/releases/download/1.6.196/pasturestack-webmcp-bridge-0.1.0.zip)
remains under the 1.6.196 release with SHA-256
`d5f26457989147d77a6c6cf0a41985f805901edb0e448b3946a215e003fd5824`.

The [release assets](https://github.com/PastureStack/web-console/releases/tag/1.6.197)
include the static archive, source/profile manifest, checksums and separate
runtime/build SBOMs. Server assembly and deployed-runtime acceptance remain
separate from the browser component release.
