# Web Console 1.6.152 source changes

The shared required-field validator used a generic `Name` fallback for
Stack, Service, and Container when a model-specific translation was absent.
On isolated Server v1.6.485 QA, the Stack form displayed a translated name
label while its empty-name error still contained English `Name` in Traditional
Chinese and Japanese. A previous browser harness verified the SHM field on
Service and Container but did not exercise their empty-name errors.

The validator now maps these three resource names to the labels already used
by their visible forms: `editStack.name.label` for Stack and
`formNameDescription.name.label` for Service and Container. Existing
model-specific labels still take priority. No validation, request payload,
authorization, or resource lifecycle semantics change.

Unit tests cover all three mappings, including Japanese Stack text and the
model-label priority rule. Packaging and browser QA must separately verify
the actual zh-TW, en-US, and ja-JP forms at desktop and narrow widths; until
then the source change is not a deployed-product acceptance claim.

The Node 24 package-lock review baseline changes only its two root version
fields from 1.6.151 to 1.6.152; dependency entries are unchanged.
