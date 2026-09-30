# Web Console 1.6.161

Published numeric component release; packaged browser acceptance is pending.
Source: `2ad068d62b5afd3cd213cde8addc5ebbef738130`.
Archive SHA-256:
`fa3ec0bf5173fa75a53dd621b87e1f587b20d9ecc6e5cb42a703ac4f5f7e97e7`.

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
[Official CI 36738408143](https://github.com/PastureStack/web-console/actions/runs/36738408143)
passed 738/738 tests and produced two byte-identical archives. The numeric tag
and archive are published. Owner/member packaged browser acceptance remains
pending.

No API, authorization, authentication, session, OIDC, MFA, proxy, firewall or
stored-data contract changes are introduced. Earlier failed browser receipts
remain failures; component tests do not complete the resource/role matrix.
