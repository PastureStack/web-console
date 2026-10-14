# Web Console 1.6.186

## Scope

Shared cards display each native machine driver's API name when its model has
no catalog display-name field. Catalog templates retain their localized,
formatted names, including intentionally empty display names. Equal generic
icons do not merge driver records; resource IDs and action targets are retained.
This change does not delete drivers, change initialization, or alter API contracts.
The independent personal API Key page and existing host onboarding remain available.

## Changed files

- `app/components/catalog-box/component.js`: fall back to the native name only
  when `catalogDisplayName` is undefined.
- `app/components/catalog-box/template.hbs`: render the shared computed name.
- `tests/integration/components/catalog-box-test.js`: render the actual machine
  page with native machine-driver and catalog models, production translations,
  the application's Intl compatibility initializer, and a 320px container.
- `package.json` and `package-lock.json`: root versions are `1.6.186`; dependencies
  are unchanged.
- `README.md` and this release note: describe the driver display and verification.

## Focused verification

Chrome 154.0, Node 24.20.0, and npm 12.0.2 passed all four cases in
`Integration | Component | catalog box driver names`:

| Case | Result |
| --- | --- |
| en-us: real machine drivers sharing a generic icon render distinct native names and IDs | PASS |
| zh-tw: real machine drivers sharing a generic icon render distinct native names and IDs | PASS |
| real catalog driver preserves localization and display-name formatting while locale changes | PASS |
| an intentionally empty catalog display name does not fall back to its raw branded name | PASS |

The first two cases verify `hyperv`, `libvirt`, `vmwarefusion`, and `virtualbox`,
their distinct native IDs, renaming, compiled page translations, and visible
names fitting within cards in a 320px container. The catalog cases verify locale
changes, branding formatting, and retained empty-name semantics.

## Published artifact and Server pairing

The immutable published source is `236973cb28dd7600a697902e3e3445b1a210a87a`.
The `web-console-1.6.186.tar.gz` archive has SHA-256
`95b319150d75b927b5474400129eee43eeec181a86c5b6d5065d44815df3da76`.
Official component publication and immutable readback are complete. Published
Server `v1.6.531` packages this archive with Engine `v0.183.348`; documentation
commits do not replace the published producer or archive.

## Native acceptance

Chrome 154.0.8037.98 loaded the published Server 531/Web 186 product through its
real UI and API. Eleven distinct driver IDs and names matched v1 and v2-beta;
zh-tw/en-us at 1440px and 390px displayed every native name. Four cards shared
generic icons while retaining distinct records. A Server restart preserved the
exact ID/name set. Page errors were zero, and all five screenshots were visually
reviewed; no driver was deleted or merged.

The paired Server passed repair of an existing unbound Default during upgrade
from 530, fresh first-host readiness, Server/Docker restart, guest reboot and
native workload recreation. Its deployment and subsequent restart also passed.
Narrow affected-path acceptance completed with the existing host defaults and
unchanged role logic; broader role/backend matrices are outside this verification.
