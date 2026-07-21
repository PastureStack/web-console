# intl-relativeformat compatibility package

This package keeps the legacy `intl-relativeformat` API expected by `ember-intl@2.x` while removing the deprecated upstream npm package from the active install graph.

The implementation preserves:

- `new IntlRelativeFormat(locales, options)`.
- `format(date, { now })`.
- `resolvedOptions()`.
- Static `__addLocaleData(data)`, `defaultLocale`, and `thresholds`.
- Legacy `style` values: `best fit` and `numeric`.
- Legacy `units` values: `second`, `minute`, `hour`, `day`, `month`, and `year`.

Runtime formatting prefers native `Intl.RelativeTimeFormat` and falls back to a small English formatter only if native support is unavailable. This is intentionally not a drop-in migration to `@formatjs/intl-relativetimeformat` because current FormatJS packages are ESM-first and expose a different API boundary than the legacy `ember-intl@2.x` formatter path.
