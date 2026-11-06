# Web Console 1.6.222 / Bridge 0.2.24

A legacy four-field Bridge profile could reject a private environment that a native administrator could read directly, because name-based discovery requested only the administrator's member environments. Shared discovery now requests the native `all=true` Project collection, matching the console and existing profile writer, and retains it across bounded pagination.

Account roles and Key policies remain authoritative. Nonadmin, no-access and restricted-Key visibility does not expand; absent and ambiguous targets still fail closed. Origin, dedicated Key purpose/revision and exact bound-profile UUID checks remain unchanged. The twelve tools and dependency graph are unchanged.

Generic resource detail and Stack graph guidance distinguishes `resourceRef` from legacy `stackRef` and `serviceRef`. Passing a legacy reference to `get_resource` returns audited `INVALID_INPUT` on `resourceRef` with instructions to use `find_resources` for the Stack or Service family. Genuine expired generic references retain `STALE_REFERENCE`; references are never aliased or rewritten.

Original full/enabled CI [42296748752](https://github.com/PastureStack/web-console/actions/runs/42296748752) passed 1,142 browser tests and 102 distinct focused cases (89 Node and 13 QUnit), including four new legacy-discovery cases and three new reference-guidance cases. Original artifact and archive/SBOM qualification passed. All thirteen public asset bytes passed anonymous SHA-256 readback, and GitHub's immutable-release attestation verified fourteen subjects. The [published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.222/web222-release-metadata.json) records the producer and component evidence; its preparation-time status is superseded by the published immutable release.

The published component is qualified against Engine 0.183.380 and requires a qualified compatible Server assembly. Native Full-access and weak-model acceptance remain pending. Component CI and publication do not establish the fourteen native TCP criteria, eight native Stack graph criteria or completion of all 243 frontend groups.

For rollback, restore the prior qualified Server assembly and its matching Web Console/Bridge components through the [Server installation guide](https://github.com/PastureStack/server#quick-start). Retain the original Bridge profile; this change does not migrate or rewrite it.
