# PastureStack Web Console

Web Console is the browser interface for environments, hosts, stacks, services,
containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve and modernize the
Rancher 1.6 ecosystem. It is not affiliated with Rancher Labs or SUSE.
This fork of [`rancher/ui`](https://github.com/rancher/ui) preserves upstream
history, authorship, licenses, and dependency notices.

## Current component

[Web Console **1.6.219** / bridge **0.2.21**](https://github.com/PastureStack/web-console/releases/tag/1.6.219)
is published. Matching published Engine **0.183.378** and a qualified compatible
Server assembly are required. The new platform Key-audit detail also requires
the Server571 broker projection. Use numeric release versions in the linked
installation guides.

API Key client-report explanations and long code values wrap inside their list
and detail columns, including narrow RTL layouts. Other audit grid cells retain
their horizontal scrolling and resize behavior.

API Key details show configured policy and read-only capability information,
without claiming effective grants. Typed TCP load-balancer creation requires
explicit activation and complete ordered listener/backend rules. Load balancers
can start or stop through the native lifecycle while preserving configuration.
Writes retain fresh authority, human review and durable receipts; native
acceptance of these new workflows remains pending.

AI resource reviews stay anchored to the viewport when the page is scrolled.
Long values scroll within the dialog; narrow layouts, classic scrollbars and
RTL keep the reviewed values and confirmation footer reachable.

Standalone Container create plans accept native port mappings with exact human
review. Creation verifies stopped configuration, without reserving a port or
proving a live binding. Start requires a separate approved plan; existing
Service allocation and health checks remain unchanged. Native Container port
acceptance remains pending.

Read-only process discovery, details and bounded diagnostics use the native
global process owner and fresh role, Key and schema checks. Registered names
and fixed enums replace raw logs and payloads. Hidden, empty or truncated
diagnostics remain unknown; Project ownership grants no global process access.

Human-reviewed metadata changes include the currently selected Project and
load-balancer names/descriptions. Editing another visible Project requires a
normal context switch and a fresh reference. Load-balancer configuration, ports,
backend links, certificates, scale and lifecycle stay outside this metadata subset.
The explicit Bridge profile writer binds a new private profile to the chosen
Project's stable native identity, so a permanent rename survives restart without
switching to another same-name Project. Existing profiles retain their query
and description workflows; see the [Bridge setup guide](bridge/README.md).

Host changes are limited to human-approved name/description updates. Host detail
shows at most fifty freshly authorized container references and readable Stack
names. Host and Volume reads share the native Service-to-Stack relation when a
container has no direct Stack field. Ambiguous, hidden or changed relations stay
unknown; empty results do not establish an empty Host, unused storage or safe
removal. Host lifecycle and scheduling remain separate normal workflows.

Service lookup guidance explains when to omit `stackRef` and compare Stack names,
or first obtain an opaque reference from `find_stacks`. Native authorization,
reference validation, Key scope and human approval remain unchanged.

Resource list and detail share fresh typed Stack-parent references. Follow
`get_resource(parentRef)` to read the currently authorized Stack name before
selecting a same-name resource; unavailable parent names remain unavailable.
Bound Bridge profiles first learn the server-verified dedicated-Key revision
through discovery, then read the exact saved Project identity. Discovery rows
never select a target or replace its saved endpoint, ID or opaque UUID.

Ordinary Service upgrade plans now include finish, rollback and cancel-upgrade
through the same preview, human review and verified-operation flow. These three
operations take empty parameters and retain native phase, owner and Key upgrade
checks. Cancellation verifies its native checkpoint; it does not complete an
upgrade or rollback. Cancel-rollback remains unavailable.

Twelve shared typed tools provide resource discovery and human-reviewed changes
for supported workloads, External Services, DNS Aliases, audit metadata, and
Certificate names/descriptions. Certificate PEM material, keys, chains, renewal
and removal stay in the normal human interface. Tools use opaque references;
raw resource IDs, private audit payloads and credentials are not exposed.
Select `apiKeyRestricted` explicitly for restricted-Key discovery and audit;
the default searches ordinary `apiKey` only. Family coverage remains partial.
Pending-plan reminders use page content so footer controls remain available,
and confirmation errors provide safe permission guidance in all thirteen locales.

Normal UI, session, Full-access and human-confirmation protections remain.
Original CI, artifact checks, archive/SBOM attestations and anonymous byte/SHA256
verification of all thirteen public assets passed. Evidence is recorded in the
[release metadata](https://github.com/PastureStack/web-console/releases/download/1.6.219/web219-release-metadata.json).
Component publication does not establish designated Server/workflow acceptance.
Native Process acceptance remains pending; whole-family/243-group completion is
not claimed.

Use the [Server installation guide](https://github.com/PastureStack/server#quick-start)
for deployment. Historical evidence remains in [release notes](docs/releases).

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
