# Upstream provenance

- Package: `ember-fetch`
- Upstream version: `5.1.3`
- Upstream repository: <https://github.com/ember-cli/ember-fetch>
- npm package integrity: `sha512-eQX54LpaQCS7IDuASNxArTVwkXIuwL9W4UZOLPyfEQJfmXd4IEx3mqoVlydBJJp2kjpuUZ1Wbd1XKC96ggY5gw==`
- License: MIT; the unmodified upstream license is retained in `LICENSE.md`.

PastureStack compatibility revision 1 renames the AMD callback parameter from
`self` to `exports`. The upstream name shadows the browser global `self` inside
the generated production bundle. Current `abortcontroller-polyfill` releases
then inspect the AMD exports object instead of the browser global object and can
attempt to subclass an undefined native `AbortSignal`, preventing the web
console from starting.

Compatibility revision 2 re-exports the browser globals after the polyfill has
installed them and removes the legacy `Ember.Test` waiter heuristic. Ember 6
can expose `Ember.Test` in a production compatibility build, so presence of
that namespace does not identify a test environment. The legacy branch then
attempted to invoke an uninitialised AMD `fetch` export and trapped production
startup in the error route. Application and acceptance code continues to await
the Fetch promise directly.

No public API or dependency version is changed by these compatibility patches.
