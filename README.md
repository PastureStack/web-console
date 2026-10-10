# PastureStack Web Console

Web Console is the browser interface for environments, hosts, stacks, services,
containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve and modernize the
Rancher 1.6 ecosystem. It is not affiliated with Rancher Labs or SUSE.
This fork of [`rancher/ui`](https://github.com/rancher/ui) preserves upstream
history, authorship, licenses, and dependency notices.

## Current release

The 1.6.181 source candidate adds capability-gated API Key access settings,
expiration, reviewed changes with platform MFA, and per-key audit
filtering and details for the matching Server v1.6.519 contract. Every grant
remains bounded by the owner's live permissions; operation choices are not
claims of authority. Legacy Keys are not automatically narrowed during an upgrade;
the existing workflow remains available when the server has no policy capability.
New secrets are shown once at creation, not on later reopen/list/detail views.
Resource scopes use searchable authorized environment, stack, and resource
names, including their context in the review. Operators do not enter resource
IDs; stable references remain an internal API detail. Unavailable or ambiguous
names block submission rather than guessing a target.
Choose allow-by-default with deny exceptions (blacklist), or deny-by-default
with allow exceptions (whitelist). Both support direct exception editing;
switching the default preserves existing exceptions. Without exceptions,
the original full-access or closed behavior is retained. The resource-by-operation
matrix previews the draft and reviewed policy, including deny precedence,
partial scopes, unresolved relationships and expiry. It does not grant or
predict permissions beyond the owner's live access.
Reloading a newer policy revision revalidates selected names and capabilities;
pending evidence from an older reload or owner is not reused in the matrix.
The key editor stays within narrow viewports while the matrix scrolls internally
with its operation headings and resource rows intact;
the existing desktop modal sizing is retained.
Per-key audit opens from the row's existing action menu, without adding an extra
button outside the actions column; audit results still follow live viewer access.
The close control is below the audit block, after its filters, results and details.
Policy, expiry and audit errors use the existing console error handling; an HTTP
response is not a declaration of background or stream completion. See the matching
Server's [API Key guide](https://github.com/PastureStack/server/blob/main/docs/api-keys.md).
Candidate browser acceptance and publication are separate steps.

[Web Console 1.6.180](https://github.com/PastureStack/web-console/releases/tag/1.6.180)
is published, fixing all-time audit listing, polling and JSON/XLSX export
queries. This contract requires the matching Server v1.6.518 broker.
The console archive is published independently of Server assembly.

For component identities, checksums, focused tests, and known verification limits,
see the [current release note](docs/releases/web-console-1.6.180.md).
Historical changes are in [release notes](docs/releases), not this quick-start guide.
Use the [Server installation guide](https://github.com/PastureStack/server#quick-start)
for deployment; the console archive alone is not a control plane.

## Features and operator guides

- Role-aware navigation and resource actions use API schema capabilities;
  the backend remains the authorization authority.
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

## Build and test

Use the supported toolchain in [COMPATIBILITY.md](COMPATIBILITY.md):

```sh
npm ci --ignore-scripts
npm run build -- --environment=production
npm test
package_version=$(node -p 'require("./package.json").version')
bash scripts/package-static-candidate \
  "$package_version" dist "build/ui/${package_version}.tar.gz"
```

Packaging uses the current Git commit timestamp, or an explicit
`SOURCE_DATE_EPOCH`, and emits a deterministic archive plus portable SHA-256
checksum. The archive root and `VERSION.txt` must match the numeric package
version. This creates a candidate; publication is a separate reviewed step.

Component tests, artifact verification, and real-host/browser acceptance are
separate evidence. Do not infer full resource/role/hardware coverage from a
successful build. See [SECURITY.md](SECURITY.md) and [ORIGIN.md](ORIGIN.md)
for security boundaries and provenance.

## License and attribution

The inherited project uses [Apache License 2.0](LICENSE), with attribution in
[COPYRIGHT_DETAILS.md](COPYRIGHT_DETAILS.md). Bundled dependencies retain their
own licenses and notices. Contributors claim authorship only for their changes.
