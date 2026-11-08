# PastureStack Web Console

Web Console is the browser interface for environments, hosts, stacks, services,
containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve and modernize the
Rancher 1.6 ecosystem. It is not affiliated with Rancher Labs or SUSE.
This fork of [`rancher/ui`](https://github.com/rancher/ui) preserves upstream
history, authorship, licenses, and dependency notices.

## Current component

[Web Console **1.6.230** / Bridge **0.2.32**](https://github.com/PastureStack/web-console/releases/tag/1.6.230)
is published for matching Engine **0.183.389**. Stack rollback also requires
Compose **0.14.44**. Original CI, packaged SDK handshake, all thirteen anonymous
assets and native release attestation passed. See the
[release note](docs/releases/web-console-1.6.230.md); deploy a qualified matching assembly through the
[Server installation guide](https://github.com/PastureStack/server#quick-start).

The existing twelve tools support human-reviewed browser environment switching
and personal default-environment selection. Switching does not change the personal
default. The bridge returns a console handoff for these browser-only actions;
it cannot change the browser or approve its own request.

Other supported workflows include reviewed Host custom-name reset and one-child
Container public-port and link-target edits. Named Service links and bounded
External Service HTTP health checks remain available. These Container edits
preserve the parent Service's launch configuration.

Host scheduling activation/deactivation does not shut down workloads, remove
Hosts or evacuate VMs. Operation failures and unconfirmed results remain visible
with safe guidance in thirteen locales; stale terminal results cannot clear a
newer review. Native role/Key ceilings, exact references, concurrent-change checks
and human confirmation remain authoritative.

These remain partial workflows. A matching Server assembly, deployment and
affected native/UI acceptance remain separate and pending or partial. Component
publication does not update the running Server or establish complete
frontend coverage. See the [release note](docs/releases/web-console-1.6.230.md)
for component evidence.

## Next source candidate

Web Console **1.6.231** / Bridge **0.2.33** targets matching Engine
**0.183.390** and Server **1.6.588**; Compose remains **0.14.44**.
This source candidate is not published or deployed. It extends the existing
reviewed Service startup-argument workflow and preserves ordinary
Compose upgrade completion without a Catalog lookup. The twelve tools, SDK
**1.32.2**, native role/Key ceilings and human confirmation remain unchanged.
Fresh component CI, packaged SDK qualification, publication, matched Server
deployment and affected native acceptance remain required. See the
[candidate note](docs/releases/web-console-1.6.231.md).

## Features and operator guides

Typed Stack finish-upgrade, cancellation and rollback use the existing native
owners and separately reviewed plans. Cancellation proves the parent checkpoint;
child work must be checked separately. Rollback restores only currently eligible
service upgrades. Matching Server deployment and native acceptance remain separate
from component publication.

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

### AI workflow boundaries

The twelve shared tools use opaque references and fresh native role, membership,
schema and API Key checks. Supported families remain partial. Plans require
human review and durable completion receipts; client reports do not establish
authorization or business success. The Engine's four independent AI flags remain
default-off, and each Web Console page starts with browser tools off.

Ordinary metadata views exclude credentials, Certificate PEM material, private
audit payloads and raw process logs. The explicit `container_logs` view returns
bounded application text under native LOGS authority and live Key/session
ceilings. That text is untrusted and may contain application secrets; audit
retains metadata only. Process reads use the native global owner; Project
ownership grants no global process access. Select `apiKeyRestricted` explicitly
for restricted-Key discovery and audit; the default searches ordinary `apiKey`
only. Key policy details describe configured policy, not effective grants.

The optional `get_resource({resourceRef, view: "stack_graph"})` reads bounded
ordinary-Service links. Completeness remains unknown; ordinary detail performs
no graph query without the selector. Empty or unavailable Host, Volume and
process results do not establish unused resources, safe removal or completeness.

Container creation verifies stopped configuration, including supported native
port mappings; a live port binding requires a separate approved start. Typed TCP
load-balancer creation requires explicit activation and complete ordered rules.
Load-balancer metadata changes do not edit listeners, backends, certificates,
scale or lifecycle. Certificate material and advanced configuration remain in
the normal human interface. Native workflow acceptance is documented separately
in the release notes.

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
node scripts/apply-minimatch-security-backport.cjs
npm run build -- --environment=production
npm test
```

The explicit source-build step applies the pinned upstream minimatch security
fix while retaining the API required by this Ember toolchain. Build, test and
development-server entries verify those bytes before loading build plugins.
Repeat the step after reinstalling dependencies; a missing or altered backport
fails with a diagnostic instead of silently running an unpatched build.
See [the backport provenance](vendor/minimatch-security-backport/UPSTREAM.md).

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
