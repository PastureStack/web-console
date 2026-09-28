# Web Console 1.6.151 source changes

Secret's Edit button previously depended on a per-resource `update` action
link. The Server's active Secret may have no such link even though its
resource schema permits `PUT` to its self URL. On the isolated 8080 QA
deployment of Server v1.6.484, an owned Secret was successfully updated via
both `/v1` and `/v2-beta`, while the UI did not expose Edit. The resulting
form/action mismatch prevented the Secret browser lifecycle from completing.

Secret Edit now requires all three conditions: active state, `PUT` in the
current Secret schema's resource methods, and a self link. Secret Remove
continues to require the explicit remove action. The form payload, readback,
and server authorization remain unchanged; this is not a client-side bypass
for read-only or cross-project users.

Focused Chrome unit coverage checks owner, read-only, inactive, and missing
self-link combinations, plus the post-create action-link refresh. The
Certificate and RegistryCredential action-link rules retain their existing
behavior. Browser/API acceptance of the packaged Server image, including
localized error display and exact-ID cleanup, is a separate release gate and
must not be inferred from these source tests alone.

The Node 24 package-lock review baseline changes only its two root version
fields from 1.6.150 to 1.6.151; dependency entries are unchanged.
