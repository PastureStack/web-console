# PastureStack Web Console

Web Console provides the browser interface for compatible environments, hosts, stacks, services, containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve, audit, and modernize the Rancher 1.6 ecosystem. It is not affiliated with or endorsed by Rancher Labs or SUSE.

**Upstream:** [`rancher/ui`](https://github.com/rancher/ui), preserved from its `1.6-dev` line. This GitHub fork retains upstream history, authorship, dates, tags, licenses, and dependency notices. PastureStack maintenance is consolidated into one commit after the preserved upstream boundary.

## Project status

The current compatibility release retains the existing Node 24, Ember, Sass,
dependency, browser-smoke, terminal, console, and test-harness modernization.
It adds a provider-neutral OpenID Connect administration and sign-in flow with
PKCE S256, staged configuration validation, a real test login before
activation, and local-authentication recovery. Product-owned names, logos,
icons, package metadata, and visible text use PastureStack branding. API
models and protocol fields remain compatible.

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
bash scripts/package-static-candidate 1.6.56 dist build/ui/1.6.56.tar.gz
```

The packaging command uses the current Git commit timestamp by default, or an
explicit `SOURCE_DATE_EPOCH`, and emits a deterministic tarball plus a portable
SHA-256 file. It creates a candidate only; publishing remains a separate,
reviewed release step.

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
