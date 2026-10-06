# PastureStack Web Console

Web Console is the browser interface for environments, hosts, stacks, services,
containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve and modernize the
Rancher 1.6 ecosystem. It is not affiliated with Rancher Labs or SUSE.
This fork of [`rancher/ui`](https://github.com/rancher/ui) preserves upstream
history, authorship, licenses, and dependency notices.

## Current release

[Web Console 1.6.179](https://github.com/PastureStack/web-console/releases/tag/1.6.179)
packages the reviewed Moment 2.31.0 and compatible dependency updates already
merged on `main`, plus the official shell-quote 1.11.0 security fix in both npm
and the browser bundle. Its archive is published independently of Server assembly.
It is packaged in [Server v1.6.517](https://github.com/PastureStack/server/releases/tag/v1.6.517).

For component identities, checksums, focused tests, and known verification limits,
see the [current release note](docs/releases/web-console-1.6.179.md).
Historical changes are in [release notes](docs/releases), not this quick-start guide.
Use the Server image for deployment; the console archive alone is not a control plane.

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
