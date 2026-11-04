# Official minimatch preprocessing security backport

This source-packaged dependency preserves the minimatch 10.2.6 matcher API and
applies the preprocessing fix released in minimatch 11.0.1 for
[CVE-2026-118764](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249).
It is not a runtime patch or an upstream 10.x release.

The exact upstream 10.2.6 npm archive is retained with SHA256
`5a3d2c8074a28229665727e47b8a1090941856a7962905efe05d20d3760355f8`.
Its registry integrity is
`sha512-vpLQEs+VLCr1nU0BXS07maYoFwlDAH0gngQuuttxIwutDFEMHq2blX+8vpgxDdK3J1PwjCJiep77OitTZ4Ll1A==`.
The signed upstream fix tag resolves to commit
`47afe882784638ccdee8d30e0b7516aed2b589a9`; the retained `src/index.ts` from that
commit has SHA256 `eff2f23257708f4bd102cf94d746c8f26f5887e993e6de0f3c139bdae924c37b`.

Only the official three security changes are backported: the existing
`braceExpandMax` bounds `**/..` preprocessing expansion, and sets above 1000
rows skip the redundant pairwise optimization. No custom limit or matcher is
introduced. CommonJS and ESM distributions receive the same fix. `matchOne`,
`makeRe`, RegExp pattern entries, dependency declarations and the remaining
upstream distribution files retain their existing API/behavior.

Patched index JavaScript is not misrepresented as a fresh TypeScript build.
The four upstream index source maps are omitted, their references are removed,
and the patched TypeScript source plus file hashes are included for review.
The original license is retained. Reproduce/check the immutable archive with
`python scripts/build-minimatch-security-backport.py --build` (creation only)
or without `--build` (read-only byte-for-byte verification).

The reviewed glob CommonJS wrapper uses the official `glob-real/raw` export so
its matcher resolves to this dependency. glob 13's unused default bundle still
contains its original embedded matcher; it is not claimed to be patched or
removed. The focused dependency/entry guard rejects first-party default imports
that would bypass the reviewed raw route. Raw vulnerability reports remain
separate from this exact-artifact backport qualification.
