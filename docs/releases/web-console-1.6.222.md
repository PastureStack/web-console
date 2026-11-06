# Web Console 1.6.222 / Bridge 0.2.24 candidate

A legacy four-field Bridge profile could reject a private environment that a native administrator could read directly, because name-based discovery requested only the administrator's member environments. Shared discovery now requests the native `all=true` Project collection, matching the console and existing profile writer, and retains it across bounded pagination.

Account roles and Key policies remain authoritative. Nonadmin, no-access and restricted-Key visibility does not expand; absent and ambiguous targets still fail closed. Origin, dedicated Key purpose/revision and exact bound-profile UUID checks remain unchanged. The twelve tools and dependency graph are unchanged.

Generic resource detail and Stack graph guidance now distinguishes `resourceRef` from legacy `stackRef` and `serviceRef`. Passing a legacy reference to `get_resource` returns audited `INVALID_INPUT` on `resourceRef` with instructions to use `find_resources` for the Stack or Service family. Genuine expired generic references retain `STALE_REFERENCE`; references are never aliased or rewritten.

Four discovery methods, two directly affected existing methods and three resource-reference guidance methods have direct Node coverage. These are source/transport controls, not native Full access or weak-model acceptance. The discovery-only producer completed its own full/enabled CI and artifact qualification; this changed guidance producer requires new normal CI, artifact qualification, publication and runtime verification. Web Console 1.6.221 / Bridge 0.2.23 remains the published installation baseline; this candidate is compatible with the existing Engine380 command contract and requires a qualified compatible Server assembly.
