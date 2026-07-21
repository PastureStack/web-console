# PastureStack Web Console

Web Console provides the browser interface for compatible environments, hosts, stacks, services, containers, catalogs, storage, networking, access control, and administration.

PastureStack is an independent community effort to preserve, audit, and modernize the Rancher 1.6 ecosystem. It is not affiliated with or endorsed by Rancher Labs or SUSE.

**Upstream:** [`rancher/ui`](https://github.com/rancher/ui), preserved from its `1.6-dev` line. This GitHub fork retains upstream history, authorship, dates, tags, licenses, and dependency notices. PastureStack maintenance is consolidated into one commit after the preserved upstream boundary.

## Project status

This is a migration proof of concept. Existing Node 24, Ember, Sass, dependency, browser-smoke, terminal, console, and test-harness modernization is retained. Product-owned names, logos, icons, package metadata, and visible text use PastureStack branding. API models and protocol fields remain compatible.

The language picker includes English, German, Persian, Filipino, French,
Hungarian, Japanese, Korean, Brazilian Portuguese, Russian, Ukrainian,
Simplified Chinese, and Traditional Chinese for Taiwan. Every selectable locale
must satisfy the complete message contract and regional formatting gates
documented in [Localization](docs/localization.md).

No CI/CD, static artifact publication, release, deployment, or
production-readiness claim is enabled.

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

The repository includes explicit modernization gates because its historical frontend toolchain cannot be trusted without review. See [COMPATIBILITY.md](COMPATIBILITY.md), [SECURITY.md](SECURITY.md), and [ORIGIN.md](ORIGIN.md).

## License and attribution

The inherited project remains licensed under [Apache License 2.0](LICENSE), with additional attribution in [COPYRIGHT_DETAILS.md](COPYRIGHT_DETAILS.md). Bundled dependencies retain their own licenses and notices. PastureStack contributors claim authorship only for their own changes.
