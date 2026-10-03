# Provenance and compatibility revision

This package contains the runtime source published as `ember-api-store` 2.8.5.

- Registry archive: `https://registry.npmjs.org/ember-api-store/-/ember-api-store-2.8.5.tgz`
- Registry integrity: `sha512-YvnBZfdNGG7hB25hecEENHObXNN+186Bbkd1wAIL7qtRXqboQsQxTU05xxP7axgW6TPYfUYMxZ+GgbHgD14g2A==`
- Registry archive SHA-256: `9200ed2667f96acc3e5ed1c1357a27913b9122abf531cb0675d4798072c337a8`
- License: Apache-2.0; the published `LICENSE` file is retained unchanged.

PastureStack compatibility revision 1 does not change the add-on runtime source. It replaces obsolete build metadata with the reviewed Node.js 24 toolchain: Ember Auto Import 2.13.1, Ember CLI Babel 8.3.1, and `set-cookie-parser` 2.7.2. It also removes upstream lint-only packages and the unused, commented-out file-creator dependency from the install graph.

Compatibility revision 2 migrates the retained runtime from the removed `ember`
aggregate module to Ember 7 module imports. It preserves resource action dispatch,
relationship handling, and store behavior while removing obsolete global logger,
library-registration, and property-change batching calls.

Compatibility revision 3 fixes duplicate in-flight request coalescing. The
upstream local variable previously shadowed RSVP's `defer` import and crashed
before initialization whenever two callers requested the same resource together.

Compatibility revision 4 aligns schema-ID lookup with the normalization already
used by `_bulkAdd`. `getById` normalizes its ID argument only for the `schema`
cache, including mixed-case resource types such as `registryCredential`.
Inherited `Resource.schema`, `canCreate`, `canList` and schema-based update checks
therefore read the actual store's cached schema. Other resource IDs remain opaque
and case-sensitive. Missing schemas do not gain fallback permissions; project
stores remain separate. Resource names, server schemas, authorization and request
methods are unchanged.

This compatibility packaging preserves upstream authorship. PastureStack does not claim authorship of the imported runtime source.

Compatibility revision 5 prevents an initial HTTP 201 create snapshot from
overwriting a newer subscribe model for the same generated resource ID. Only
an ID-less `Type.save` POST opts into canonical model adoption, and only within
its captured store generation and API base URL. Opaque resource IDs and concrete
types must match; cached nested relationships are not re-imported from the older
body. Save completion, base-type aliases, HTTP metadata and errors retain their
existing contracts. GET, PUT, actions, non-201 responses and uncached creates
continue through the original import path. This does not order resource states
or event timestamps, grant permissions, change API responses, or add requests.
