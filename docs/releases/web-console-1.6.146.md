# Web Console 1.6.146

The 8080 browser acceptance of 1.6.145 found that the Secret, Certificate,
and Registry forms localized their controls but interpolated untranslated
schema names such as `Name`, `Cert`, `Key`, and `Server Address` into required
field errors. The common resource validator now uses the same translated label
as each affected form when the schema has no model-specific label. Existing
model-specific translations take precedence; unrelated fields retain their
previous fallback. RegistryCredential uses the Registry form labels too.
The Certificate form's encrypted-private-key rejection also uses a translated
message instead of an English-only string.

Unit tests cover the affected resource fields, model-specific precedence, and
the fallback. The isolated 8080 zh-TW, en-US, and ja-JP browser matrix must
confirm the error text contains the translated visible labels before the
product acceptance can be marked complete. This release does not change
Server authorization, API contracts, or resource-writing behavior.
