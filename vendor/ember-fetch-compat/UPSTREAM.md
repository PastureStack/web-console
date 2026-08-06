# Upstream provenance

- Package: `ember-fetch`
- Upstream version: `5.1.3`
- Upstream repository: <https://github.com/ember-cli/ember-fetch>
- npm package integrity: `sha512-eQX54LpaQCS7IDuASNxArTVwkXIuwL9W4UZOLPyfEQJfmXd4IEx3mqoVlydBJJp2kjpuUZ1Wbd1XKC96ggY5gw==`
- License: MIT; the unmodified upstream license is retained in `LICENSE.md`.

PastureStack compatibility revision 1 renamed the AMD callback parameter from
`self` to `exports`. The upstream name shadowed the browser global `self` inside
the generated production bundle and could prevent the console from starting.

Compatibility revision 2 re-exported browser globals after the polyfill had
installed them and removed the legacy `Ember.Test` waiter heuristic.

Compatibility revision 3 keeps the same `fetch` AMD module contract but uses
the native Fetch, Headers, Request, Response, and AbortController APIs required
by the supported evergreen browser baseline. It removes the obsolete Babel 6,
Rollup 0, Broccoli Rollup, legacy polyfill, and Node Fetch dependency graph from
the release build. Unsupported browsers now fail with an explicit missing-API
message instead of silently running an unmaintained build-time polyfill chain.

Compatibility revision 4 declares Ember CLI Babel 8.3.1 as the JavaScript
preprocessor for the two retained add-on modules. This is required by Ember CLI
6.12 during a clean production or test build and does not restore any Babel 6
or legacy Rollup dependency.

The original MIT license is retained in `LICENSE.md`. No upstream source is
claimed as PastureStack-authored work.
