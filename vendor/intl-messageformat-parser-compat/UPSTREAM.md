# intl-messageformat-parser compatibility package

This package keeps the legacy `intl-messageformat-parser` package name and
`messageFormatPattern` AST expected by `intl-messageformat@1.x` and
`ember-intl@2.x`.

Upstream `intl-messageformat-parser@1.8.1` is deprecated on npm in favor of
`@formatjs/icu-messageformat-parser`. The modern parser emits the current
FormatJS numeric AST shape, while this Rancher 1.6 UI build still compiles
messages with `intl-messageformat@1.x`, whose compiler rejects anything other
than the legacy `messageFormatPattern` root.

The compatibility package is intentionally conservative:

- Package name remains `intl-messageformat-parser`.
- Version is bumped to `1.8.2-rc16.0`.
- Runtime parser code is the BSD-3-Clause upstream `1.8.1` parser source.
- The npm deprecation metadata is removed from the active install graph.
- No Rancher API, UI route, translation key, or message formatting contract is
  changed.

Do not replace this with `@formatjs/icu-messageformat-parser` directly. That
requires either a complete `intl-messageformat`/`ember-intl` migration or a
well-tested AST adapter that preserves plural/select formatting, `#` handling,
location fields, and syntax errors.
