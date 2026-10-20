# PastureStack Web Console

Web Console is the browser interface for environments, hosts, stacks, services,
containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve and modernize the
Rancher 1.6 ecosystem. It is not affiliated with Rancher Labs or SUSE.
This fork of [`rancher/ui`](https://github.com/rancher/ui) preserves upstream
history, authorship, licenses, and dependency notices.

## Current component

Published [Web Console 1.6.191](docs/releases/web-console-1.6.191.md) updates the
Node build dependencies Handlebars and fast-uri to their official security patch releases.
It preserves the existing archive, API Key, authentication, host registration,
role and navigation contracts. Build dependency findings are tracked separately
from the modules actually packaged for browsers; an unresolved build-only
finding is not described as a runtime fix.

Publication identities and verification scope are recorded in the
[release note](docs/releases/web-console-1.6.191.md) and
[compatibility contract](COMPATIBILITY.md). The immutable
[1.6.191 release](https://github.com/PastureStack/web-console/releases/tag/1.6.191)
contains the original tested CI artifact. Component publication does not
establish Server deployment or complete the historical acceptance matrix.

Use the [Server installation guide](https://github.com/PastureStack/server#quick-start)
for deployment. Historical changes remain in [release notes](docs/releases).

## Features and operator guides

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
