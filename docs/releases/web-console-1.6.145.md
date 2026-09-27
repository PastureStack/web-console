# Web Console 1.6.145

Registry Add in 1.6.144 was hidden from authorized users despite the current
project's Registry and RegistryCredential schemas both permitting POST. The
API store caches schema IDs in lowercase but its `canCreate` lookup does not
normalize the supplied ID. The shared project capability helper now converts
resource type names to lowercase before looking up the schema, so the list
button and direct Add route use the same actual capability. Existing
project/schema identity checks and the requirement for both POST capabilities
remain in place; no Server authorization or API contract changes.

The regression test covers mixed-case RegistryCredential, a missing POST,
an unloaded schema, and an invalid type. Isolated 8080 browser and valid
Add/Edit/Remove acceptance must be reported from the released build, not
inferred from unit tests.
