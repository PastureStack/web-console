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
- `README.md` and this source note: describe the driver display and verification.

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

These tests ran against the uncommitted source based on
`ad5a68dd30a6e136745123e26c97c4925c2ed263`. Version metadata and documentation
were prepared afterward; the tested component and regression source are unchanged.
Production packaging, publication, Server pairing, and actual driver initialization
and restart identity checks remain separate pending gates. Server E2E08 is PLANNED.
