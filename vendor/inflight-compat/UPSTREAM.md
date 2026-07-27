# inflight compatibility wrapper

This package preserves the `inflight(key, callback)` API used by legacy `glob` 5.x/7.x consumers while removing the deprecated upstream package from the Node 24 lockfile warning surface.

The implementation intentionally keeps the original request coalescing semantics, including callbacks appended while a resolver is running being executed on a later tick with the same arguments.
