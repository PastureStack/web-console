# Static console SBOM boundaries

The release publishes separate CycloneDX documents:

- `runtime.cdx.json`: production browser inputs and archive/file identity.
- `build.cdx.json`: actual installed npm build inputs, including development
  dependencies and the separately installed release schema verifier closure.
- `artifact-manifest.json`: evidence tying both documents to the exact archive,
  lockfile and source commit.

[Web Console 1.6.195](../releases/web-console-1.6.195.md) is published as an
immutable release from producer `f905bc12daae18d98a6ac65942625562fff2a424`.
Its [successful production run](https://github.com/PastureStack/web-console/actions/runs/40086505425)
produced two identical archives and SBOM sets, validated both BOMs against the
official CycloneDX 1.6 schema, and completed archive-provenance and runtime-SBOM
attestations. Anonymous release downloads matched the retained artifact hashes.
Exact SHA-256 values and the 69 focused-check breakdown are in the release note.

These are sidecars; no source maps, private paths or CI-host package lists are
inserted into the static site. A dependency marked `dev` can still be bundled
into a browser, so its runtime classification comes from build evidence, not
the npm flag alone. Hash-identified inherited vendor snapshots retain their
known provenance and disclose unavailable upstream version/license metadata.
Read each document's composition and properties before treating it as an
exhaustive upstream dependency claim.

Both production builds and their SBOM outputs must be byte-identical. Missing
inventories, a changed lockfile or an archive that does not match its checksum
and built files must fail the generator. New tests exercise these rejection
paths instead of weakening validation to accept unknown input.

Runtime membership uses the per-asset Webpack module graph and emitted byte
hashes, selected against the retained packaged files. The full compilation
graph remains security-gate evidence; modules present only in removed test
chunks are not classified as browser runtime. Concat outputs use the same
retained-file selection. Asset-map entries and exact paths take precedence;
without an asset map, only a unique same-directory/stem name with a standard
32-hex fingerprint is accepted.
Webpack's original byte hashes remain as `webpackAssetSHA256`; after Ember's
production post-processing, the fixed-path finalizer records the final dist
hashes and its stage in the inventory. Only that evidence sidecar changes.
The generator still requires those final bytes to match the original archive.

The producer passes `--verifier-root tools/sbom-verifier` and manifest/lock
SHA-256 values captured before installation. The generator checks these pins,
the frozen lock, npm's installed lock and the installed package identities.
Verifier components use the separate `verifier-npm:` namespace, reached through
`tool:sbom-verifier` and its direct dependency edges in the build BOM. The build
metadata and artifact manifest record both verifier source hashes. These tools
are excluded from the runtime BOM. If the optional verifier input is omitted
outside the release producer, build coverage explicitly states that exclusion.

The published runtime composition is `incomplete`. Frozen AWS and noVNC bundles
still lack complete embedded-module version/license metadata; Bootswatch and
Lato upstream identity or font-license evidence is also incomplete. Generated
module attribution, shared addon app-tree ownership and fixed Sass inputs retain
their stated limitations. Publication and passing checks do not close these
coverage gaps or constitute a whole-feature/role acceptance result.

## Ruby / Onigmo

The [Ruby advisory of 2026-10-23](https://www.ruby-lang.org/en/news/2026/10/23/regexp-fixes-for-gitlab-cves/)
tracks the fixes associated with GitLab's CVE-2026-89078, CVE-2026-93577,
CVE-2026-97229 and CVE-2026-110264. Ruby 4.0.9, 3.4.12 and 3.3.13 contain all
four fixes. A timeout or pattern-length limit is not a substitute for a fix.

The browser does not run Ruby. The actual hosted runner is a separate boundary:
its preinstalled Ruby SDKs must not be silently described as absent just because
the project uses Node. CI captures installed OS packages and bounded system,
toolcache and Homebrew Ruby binaries. This records presence and exact version,
not evidence of activation or a complete inventory of every hosted-runner SDK.
Distribution patch status requires the vendor's backport record; a version
comparison alone is not enough. The maintained console build does not invoke
Ruby or compile user-provided patterns through Onigmo. Official artifact
production runs inside the digest-pinned Node container with read-only source,
an isolated working directory and no host toolcache, Homebrew or Docker socket.
Installed packages and Ruby binaries are inventoried before and after the build;
both inventories must establish that Ruby is absent. This is verified isolation,
not a claim that the host's preinstalled SDKs were patched. Runner-image
residuals and official fixed versions remain tracked separately from browser
findings until the hosted image's vendor publishes verifiable replacements.
The 1.6.195 host inventory records toolcache Ruby 3.3.12, 3.4.11 and 4.0.7,
plus Homebrew Ruby 4.0.7, below those official fixed releases. System Ruby 3.2.3
(`3.2.3-1ubuntu0.24.04.8`) and toolcache Ruby 3.2.11 require separate vendor or
backport evidence. They were not imported into the producer container; neither
the release nor its SBOM claims those host installations were patched.

The release-only schema verifier has its own frozen npm lock and uses patched
Ajv 8.20.0. It is not part of the application's dependency graph or browser
bundle. CI verifies the official CycloneDX 1.6 schema checksums and validates
both generated BOMs against them.

Oniguruma and Ruby's Onigmo are different components; do not substitute one
package name for the other when deciding applicability.
