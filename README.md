# PastureStack Web Console

Web Console provides the browser interface for compatible environments, hosts, stacks, services, containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve, audit, and modernize the Rancher 1.6 ecosystem. It is not affiliated with or endorsed by Rancher Labs or SUSE.

**Upstream:** [`rancher/ui`](https://github.com/rancher/ui), preserved from its `1.6-dev` line. This GitHub fork retains upstream history, authorship, dates, tags, licenses, and dependency notices. PastureStack maintenance is consolidated into one commit after the preserved upstream boundary.

## Project status

The current compatibility release is `1.6.111`. It retains the existing Node 24, Ember, Sass,
dependency, browser-smoke, terminal, console, and test-harness modernization.
It adds a provider-neutral OpenID Connect administration and sign-in flow with
PKCE S256, staged configuration validation, a real test login before
activation, and local-authentication recovery. Product-owned names, logos,
icons, package metadata, and visible text use PastureStack branding. API
models and protocol fields remain compatible.

Release `1.6.111` fixes the post-save route boundary found by creating a real
service on a managed host. The API and node correctly created the service, but
the legacy component action target could lose its controller receiver before
navigation. All four container and virtual-machine create routes now pass
receiver-bound completion and cancellation callbacks to the shared form. The
resource and hardware payload is unchanged; focused regressions cover detached
callbacks, successful navigation, and both create and upgrade payloads.

Release `1.6.110` restores the classic `(action (mut ...))` contract used by
command and environment editors, and accepts the modern array-like browser
clipboard type list used by key/value inputs. This closes the two client-side
exceptions found while filling the complete hardware/runtime form on a real
host; it retains the INIT spacing and completion fixes from `1.6.109`.

Release `1.6.109` corrects the create and upgrade completion contract exposed by
real-host acceptance testing. Top-level create routes now pass classic named
actions to the shared form so Ember dispatch preserves the controller receiver;
the compatibility layer also refuses to forward a component prototype callback
as an action name. This prevents a successfully persisted service from leaving
the form open with `undefined.get` or a template-action error. A regression test
exercises the controller transition, and the init-process control has additional
desktop separation from the adjacent process-limit input without changing its
payload binding.

Release `1.6.108` attempted to close the first-create completion failure with a
closure callback. Real-host acceptance testing subsequently showed that the
legacy action compatibility path could still misroute the callback after the
service was already persisted. It is retained as a superseded diagnostic step,
not as the current compatibility target.

Release `1.6.107` removed saved-response dereferences from route selection, but
real-host acceptance testing showed that the deprecated callback dispatch still
failed after persistence. It is retained only as a superseded diagnostic step,
not as the current compatibility target.

Release `1.6.106` fixes the real first-service creation completion path. An
empty service-link set no longer sends a redundant action after the service is
already persisted, and a non-empty link update preserves the stack route
identity even if the API returns a partial resource. The route also keeps its
original stack ID independently of the mutable service response. A successful
first click therefore leaves the form instead of showing an error that could
invite a duplicate service submission.

Release `1.6.105` fixes the post-save transition for a newly created service:
the persisted service now remains in the completion chain instead of being
discarded by the service-link action. Stack-scoped create routes also fall back
to their stable stack query parameter, and advanced key/value inputs render
localized placeholders. The create and upgrade resource payloads remain
unchanged.

Release `1.6.104` keeps the authenticated browser-session and OIDC corrections
from `1.6.103`. It also keeps the init-process checkbox inside its own resource
grid column, with the launch-configuration binding unchanged, so the control no
longer touches the adjacent process-limit input on create or upgrade forms.

Release `1.6.103` keeps an authenticated browser session when a non-auth API
request fails during startup, displays the nested OIDC/API explanation instead
of an empty alert, and activates a newly verified provider in unrestricted mode
so every identity accepted by that provider can sign in. Administrators can
still narrow access afterward with the existing site-access controls.

The language picker includes English, German, Persian, Filipino, French,
Hungarian, Japanese, Korean, Brazilian Portuguese, Russian, Ukrainian,
Simplified Chinese, and Traditional Chinese for Taiwan. Every selectable locale
must satisfy the complete message contract and regional formatting gates
documented in [Localization](docs/localization.md).
New security-sensitive authentication text is maintained in English and
Traditional Chinese first; other locales inherit the complete English text
until a reviewed translation is available, rather than displaying missing
translation keys.

The manually dispatched validation workflow tests and builds the exact
selected commit on a GitHub-hosted runner and retains the reviewed candidate
for 30 days. Release publication remains a separate reviewed step.

## Build and test

```sh
npm ci --ignore-scripts
npm run build -- --environment=production
npm test
package_version=$(node -p 'require("./package.json").version')
bash scripts/package-static-candidate \
  "$package_version" dist "build/ui/${package_version}.tar.gz"
```

The packaging command uses the current Git commit timestamp by default, or an
explicit `SOURCE_DATE_EPOCH`, and emits a deterministic tarball plus a portable
SHA-256 file. It creates a candidate only; publishing remains a separate,
reviewed release step. The archive root and `VERSION.txt` must equal the
numeric package version; a preserved compatibility version must not be
silently substituted into a new release artifact.

Catalog cards and launch pages read optional
`io.pasturestack.catalog.name.<locale>` and
`io.pasturestack.catalog.description.<locale>` labels. Unknown locales and
third-party catalogs fall back to their canonical metadata instead of showing
an empty string or an untranslated key.

Container terminals, container logs, and virtual machine consoles use the
movable window system documented in
[Console workspace](docs/console-workspace.md). Terminal and log sessions can
be reopened after a tab refresh or browser restart, and active output is shared
across signed-in tabs without persisting upstream access tokens.

Host storage pages provide checkbox selection, state filtering, search,
pagination, and one operator-confirmed removal action. Selection rules,
preview behavior, and the concurrency limit are documented in
[operator-selected storage removal](docs/storage-bulk-remove.md).

Linux shared memory, runtimes, GPU/graphics devices and advanced container limits
use the shared [Resources and hardware](docs/resources-and-hardware.md) form.
The guide covers coordinated agent/API rollout and the distinction between
device visibility and exclusive GPU allocation.

OpenID Connect configuration, stable account-to-identity assignment, safe
provider switching, and local recovery are documented in
[OpenID Connect](docs/openid-connect.md). TOTP, passkeys, recovery codes,
email account recovery, and administrator controls are documented in
[Multi-factor authentication](docs/multi-factor-authentication.md).

The repository includes explicit modernization gates because its historical
frontend toolchain cannot be trusted without review. See
[COMPATIBILITY.md](COMPATIBILITY.md), [SECURITY.md](SECURITY.md), and
[ORIGIN.md](ORIGIN.md).

## License and attribution

The inherited project remains licensed under [Apache License 2.0](LICENSE), with additional attribution in [COPYRIGHT_DETAILS.md](COPYRIGHT_DETAILS.md). Bundled dependencies retain their own licenses and notices. PastureStack contributors claim authorship only for their own changes.
