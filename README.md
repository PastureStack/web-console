# PastureStack Web Console

Web Console is the browser interface for environments, hosts, stacks, services,
containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve and modernize the
Rancher 1.6 ecosystem. It is not affiliated with Rancher Labs or SUSE.
This fork of [`rancher/ui`](https://github.com/rancher/ui) preserves upstream
history, authorship, licenses, and dependency notices.

## Current component

This source builds Web Console **1.6.198** and stdio bridge **0.2.0**. It adds
resource-family discovery, server-projected metadata and typed Stack, Service
and Container lifecycle plans, while retaining the seven existing tools. Browser
tools still start paused and require explicit opt-in. Pending adapters are
reported separately; this batch does not cover the whole console.

The [release note](docs/releases/web-console-1.6.198.md) records the scope and
validation boundaries. Exact producer and immutable artifact identities are
recorded with the [release assets](https://github.com/PastureStack/web-console/releases).
Component publication and Server/browser acceptance are separate results.

The release producer uses Node.js `24.22.1` / npm `12.0.2` in a digest-pinned
container and produces an immutable static archive with separate runtime and
build CycloneDX SBOMs. [SBOM coverage](docs/security/sbom.md) remains explicitly
incomplete for inherited vendor metadata; hosted-runner Ruby is tracked
separately. CI, Server assembly and deployment require their own evidence.

Use the [Server installation guide](https://github.com/PastureStack/server#quick-start)
for deployment. Historical changes remain in [release notes](docs/releases).

## Features and operator guides

- [Experimental AI collaboration](docs/webmcp.md): twelve typed tools for
  resource discovery, conditional descriptions and server-owned lifecycle plans.
  Disabled by default. Includes human review controls and an optional
  [dedicated-Key stdio bridge](bridge/README.md); native browser tools require
  a supported secure-context browser.
- Role-aware navigation and resource actions use API schema capabilities;
  the backend remains the authorization authority.
- [API Keys](https://github.com/PastureStack/server/blob/main/docs/api-keys.md):
  capability-gated access policies, expiration, reviewed changes with platform MFA,
  and per-key audit. Grants remain bounded by live owner permissions; new secrets
  are shown once. Legacy Keys and servers without policy capability retain the
  existing workflow.
- [Resources and hardware](docs/resources-and-hardware.md): shared memory,
  runtimes, GPU/graphics devices, and advanced container limits. Options require
  compatible API/agent versions and host capabilities; device visibility is not
  exclusive GPU allocation.
- [OpenID Connect](docs/openid-connect.md): provider configuration, stable identity
  assignment, provider switching, and local recovery.
- [Multi-factor authentication](docs/multi-factor-authentication.md): TOTP,
  passkeys, recovery codes, account recovery, and administrator controls.
- [Console workspace](docs/console-workspace.md): movable terminal, log, and VM
  console windows. Live entries can reconnect; ended entries do not reopen through
  late callbacks or remounts. Open a new entry explicitly after ending a session.
- [Operator-selected storage removal](docs/storage-bulk-remove.md): selection,
  preview, confirmation, and bounded concurrent removal.

Catalog translations use optional `io.pasturestack.catalog.name.<locale>` and
`io.pasturestack.catalog.description.<locale>` labels. Unknown locales and
third-party catalogs fall back to canonical metadata.

Machine driver cards display each driver's API name, including drivers that
share the generic icon. Catalog driver cards retain localized catalog names.

### Workload archiving

The **Archive** switch before stack sorting includes archived stacks and services;
it is off by default and remembers each user's choice separately for each
environment. Hidden counts do not replace actual resource totals. Direct detail
links remain available, with an archived badge and Restore in the existing menu.

Archiving requires a compatible server, the resource's existing update capability,
and completely stopped services and containers. System and infrastructure
resources cannot be archived. Archive only changes the persisted `archived` flag:
it does not stop, delete, or recreate anything. Mounted directories and volumes
remain; back up their source data yourself before moving hosts or deleting mount
sources. Restore the resource and its parent stack before starting it or adding
services. Restoring a stack preserves independently archived child services.

## Build and test

Use the supported toolchain in [COMPATIBILITY.md](COMPATIBILITY.md):

```sh
npm ci --ignore-scripts
npm run build -- --environment=production
npm test
```

To produce a release candidate with Docker, use the same isolated producer as
CI. It installs the frozen application and schema-verifier dependencies,
captures final module/file evidence, packages twice, verifies both SBOM sets
and writes the release sidecars to a dedicated output directory:

```sh
export GITHUB_SHA=$(git rev-parse HEAD)
export SOURCE_DATE_EPOCH=$(git show -s --format=%ct "$GITHUB_SHA")
export VALIDATION_SCOPE=sbom
export WEBMCP_MODE=off
release_dir=$(mktemp -d)
bash scripts/build-ui-release-candidate "$release_dir"
```

The archive root and `VERSION.txt` match the numeric package version. Runtime
inventory is checked against the packaged tree, including packaging exclusions,
rather than the raw Ember output. This command creates a candidate; publication
is a separate reviewed step. See [SBOM boundaries](docs/security/sbom.md).

`WEBMCP_MODE` is the AI collaboration capability ceiling (`off`, `read-only`,
or `enabled`); the producer and workflow default to `off`. Select `enabled`
explicitly to include the full collaboration panel and tools. Every new page
still starts with browser tools off, until the user opts in through that panel.
The archive's `webmcp-build.json` and matching `*-webmcp.json` release sidecar
record the ceiling and fixed `initialMode: off`; their bytes are covered by the
archive/manifest and sidecar checksums. Publish one selected profile per version.

Component tests, artifact verification, and real-host/browser acceptance are
separate evidence. Do not infer full resource/role/hardware coverage from a
successful build. See [SECURITY.md](SECURITY.md) and [ORIGIN.md](ORIGIN.md)
for security boundaries and provenance.

## License and attribution

The inherited project uses [Apache License 2.0](LICENSE), with attribution in
[COPYRIGHT_DETAILS.md](COPYRIGHT_DETAILS.md). Bundled dependencies retain their
own licenses and notices. Contributors claim authorship only for their changes.
