# Web Console 1.6.161

Preparation only; publication and packaged browser acceptance are pending.

The existing Certificate editor applied the create-schema required-key check
even though the API does not return the private key. The native owner editor
on isolated Server `v1.6.494` failed with `KEY_REQUIRED` before any resource
write. This patch fixes that editor rather than bypassing its validation.

For a persisted matching Certificate with a masked key and unchanged
certificate/chain, validation explicitly permits omitting the key, and the PUT
body contains only `name` and `description`. The original PEM material is not
resent after the shared validator trims the clone. The decision is recomputed
when saving; no persistent bypass flag is used.

New certificates, changed or cleared certificate/chain values, and supplied
replacement keys keep the ordinary validation and five-field replacement body.
Encrypted private keys remain rejected. The shared validator's default remains
strict; this is not a blanket exception for write-only or required fields.

The existing hint now explains metadata preservation and the corresponding-key
requirement for replacements in all 13 locales. A masked edit key is no longer
marked unconditionally required; the create form retains its required marker.

Focused native Chrome 153 QUnit validation passed 25/25 tests including the final
hint and template changes. Coverage uses the real Certificate clone, schema and trim
chain, metadata-only and replacement payloads, required/format checks, encrypted
keys, sync/async save failures and the complete save/callback/lock lifecycle.
Rendered English, Traditional Chinese and Japanese controls preserve the create
required marker and remove it for masked edit keys. The existing hint is present
in all 13 locales; locale checks report zero missing, orphan or invalid ICU keys.
Full official CI, deterministic archive publication and owner/member packaged
browser acceptance remain pending.

No API, authorization, authentication, session, OIDC, MFA, proxy, firewall or
stored-data contract changes are introduced. Earlier failed browser receipts
remain failures; component tests do not complete the resource/role matrix.
