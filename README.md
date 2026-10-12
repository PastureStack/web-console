# PastureStack Web Console

Web Console is the browser interface for environments, hosts, stacks, services,
containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve and modernize the
Rancher 1.6 ecosystem. It is not affiliated with Rancher Labs or SUSE.
This fork of [`rancher/ui`](https://github.com/rancher/ui) preserves upstream
history, authorship, licenses, and dependency notices.

## Current release

Web Console `1.6.183` is the current source candidate, not a published archive or
Server image. This minimal candidate restores add-host Close and Back actions by
explicitly dispatching their closures to the route. See the
[candidate release note](docs/releases/web-console-1.6.183.md).

[Web Console 1.6.182](https://github.com/PastureStack/web-console/releases/tag/1.6.182)
is published with a shared clipboard fix that passes the native click event for
copy buttons, including clicks on their nested icons. It retains capability-gated
API Key access settings,
expiration, reviewed changes with platform MFA, and per-key audit
filtering and details. Every grant
remains bounded by the owner's live permissions; operation choices are not
claims of authority. Legacy Keys are not automatically narrowed during an upgrade;
the existing workflow remains available when the server has no policy capability.
New secrets are shown once at creation, not on later reopen/list/detail views.
Resource scopes use searchable authorized environment, stack, and resource
names, including their context in the review. Operators do not enter resource
IDs; stable references remain an internal API detail. Unavailable or ambiguous
names block submission rather than guessing a target.
Environment choices use the same fresh, role-aware project query as navigation:
administrators can select readable environments without direct membership;
ordinary users still see only the environments returned for their account.
Choosing an environment, stack, or resource closes its menu before loading
dependent choices or verifying the selected resource.
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
Audit reasons wrap within resizable columns so explanatory text stays readable.
Review and audit operations use translated labels. Loading or denied audit requests
are not displayed as an empty result; unknown outcomes do not imply success.
API Key status, help and error wording uses readable theme text in light and dark
layouts; state colors remain decorative accents rather than the only indication.
Keyboard-highlighted scope names and unselected hints use the same readable theme
foreground.
Initial form autofocus does not replace a control already chosen by keyboard
navigation or by a child selector. The API Key modal owns its initial focus;
its shared name form does not schedule a second focus operation.
Narrow rule forms use their available width; multi-line scope names stay inside
a viewport-bounded dropdown scroll region.
Oversized audit queries keep their filters visible and offer an explicit narrower
time range. Failed queries stop automatic polling; exports check the response
before downloading and show translated errors. Export menus close before the
pending-download lock so consecutive JSON, CSV and Excel exports remain usable.
Pagination and export responses
from an older query or authenticated session cannot replace current results.
Policy, expiry and audit errors use the existing console error handling; an HTTP
response is not a declaration of background or stream completion. See the matching
Server's [API Key guide](https://github.com/PastureStack/server/blob/main/docs/api-keys.md).
Component publication and complete Server acceptance are separate results.

The console archive is published independently of Server assembly. The published
[Server v1.6.521](https://github.com/PastureStack/server/releases/tag/v1.6.521)
release includes Web Console 1.6.181 and Engine 0.183.337. This release pairing
has not changed with the independent publication of Web Console 1.6.182;
the new console archive has not been deployed to QA. Neither publication nor
this release pairing implies complete platform-matrix acceptance.

For component identities, checksums, focused tests, and known verification limits,
see the [current release note](docs/releases/web-console-1.6.182.md).
The clipboard patch passed two focused tests and production build/package checks;
it does not complete AUD-07/AUD-10 permission-withdrawal acceptance or the whole matrix.
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
