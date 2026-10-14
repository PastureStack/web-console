# PastureStack Web Console

Web Console is the browser interface for environments, hosts, stacks, services,
containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve and modernize the
Rancher 1.6 ecosystem. It is not affiliated with Rancher Labs or SUSE.
This fork of [`rancher/ui`](https://github.com/rancher/ui) preserves upstream
history, authorship, licenses, and dependency notices.

## Current component candidate and published Server

[Web Console 1.6.188](docs/releases/web-console-1.6.188.md) is a new candidate
that repairs native hover listener lifecycle after
actual-browser findings in `1.6.187`. It retains native clipboard messages in
all 13 supported locales and left-to-right host commands in RTL interfaces.
Published Server `v1.6.532` packages Web Console `1.6.187` with Engine
`v0.183.348` and is deployed to QA 8080. The candidate's immutable publication,
new Server pairing and 52 actual-browser locale/width/theme cases remain pending.

The independent `/account/keys` page provides personal API Keys for users with no accessible
environment. It reuses the existing editor and audit view, lists only the
current owner's Keys, and does not grant environment access. Existing environment
Key pages and Hooks retain their original navigation and behavior.

Host onboarding still follows the native capability of the actual submission:
RegistrationToken POST for Custom, Host POST for built-in/Other forms. Machine
API POST alone grants neither form. Native clipboard and Close/Back controls
preserve the existing host-onboarding workflow.

For platform installation, see the
[Server current-release guide](https://github.com/PastureStack/server#current-release)
and its published component pairing. Candidate verification and acceptance
boundaries are recorded separately.

For candidate scope and verification status, see the
[1.6.188 release note](docs/releases/web-console-1.6.188.md). Published component
identities remain in the [1.6.187 release note](docs/releases/web-console-1.6.187.md).
Historical changes are in [release notes](docs/releases), not this quick-start guide.
Use the [Server installation guide](https://github.com/PastureStack/server#quick-start)
for deployment; the console archive alone is not a control plane.

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
