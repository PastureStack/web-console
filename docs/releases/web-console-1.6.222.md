# Web Console 1.6.222 / Bridge 0.2.24 candidate

A legacy four-field Bridge profile could reject a private environment that a native administrator could read directly, because name-based discovery requested only the administrator's member environments. Shared discovery now requests the native `all=true` Project collection, matching the console and existing profile writer, and retains it across bounded pagination.

Account roles and Key policies remain authoritative. Nonadmin, no-access and restricted-Key visibility does not expand; absent and ambiguous targets still fail closed. Origin, dedicated Key purpose/revision and exact bound-profile UUID checks remain unchanged. The twelve tools and dependency graph are unchanged.

Four new direct Node methods and two directly affected existing methods passed locally. These are source/transport controls, not native Full access acceptance. Normal full/enabled CI, artifact qualification, publication and runtime verification are pending. Web Console 1.6.221 / Bridge 0.2.23 remains the published installation baseline; this candidate is compatible with the existing Engine380 command contract and requires a qualified compatible Server assembly.
