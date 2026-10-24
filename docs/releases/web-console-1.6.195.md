# Web Console 1.6.195

This release adds repeatable, archive-bound CycloneDX runtime and build SBOMs.
The production module inventory, static files, original archive checksum,
lockfile and source commit are cross-checked. SBOMs are sidecar release assets:
they do not expose source maps or insert build dependencies into the browser.

CI retains the actual runner OS/Ruby inventory separately from the browser BOM.
The actual producer is the digest-pinned Node container, not merely a host
process with a Docker image environment variable. Before/after inventories must
show no installed Ruby packages or Ruby executables in that container.
Preinstalled runner SDKs remain a separate host-vendor tracking item; Ubuntu
backports are not inferred from the Ruby upstream version number alone.

Fresh security validation also updates the build/serve dependencies to official
body-parser 2.4.0, fast-uri 3.1.9 and serialize-javascript 7.1.3 fixes. The legacy
live-reload consumer keeps its raw-body 2.5.3 compatibility pin under its own
parent, while modern body-parser uses its supported 3.x dependency. Its required
qs patch is pinned to 6.16.1.

Node.js 24.22.1 / npm 12.0.2, application sources,
API/authentication/permission behavior and all 13 locales are unchanged.
Validation covers the new generator's positive/negative cases, exact input and
archive binding, reproducible double build and SBOMs, existing dependency
security and required CodeQL. Real Server/browser acceptance is recorded
separately after consumption of this component; it is not whole-matrix testing.

For the format and known-unknown boundaries, see [SBOM documentation](../security/sbom.md).
