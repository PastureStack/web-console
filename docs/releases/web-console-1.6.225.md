# Web Console 1.6.225 / Bridge 0.2.27 candidate

The existing twelve tools add ordinary Stack Group editing using
`preview_resource_change` with `resourceType: stack`, `operation: update_metadata`
and a query-issued opaque reference. The `group` field preserves the native text,
including case, whitespace and comma-separated tags; null and empty string remain
distinct. Review uses the existing localized Group label in all thirteen locales.
System/catalog Stacks and other workflows do not accept this new field.

Logical Volume creation previews now use the native `inactive` terminal state,
matching Engine 0.183.385. This corrects 1.6.224's detached-state assumption;
identity, driver, no-Host/no-mount boundaries and human confirmation are retained.
Other lifecycle states are rejected rather than presented as completed creation.

The actual preview tool description now starts with the required request envelope,
an ordinary Service-link example, replacement/clear semantics and typed-error
repair guidance. It still requires human confirmation of the exact server plan.
No tool, dependency, role grant or automatic execution path is added.

Matching Engine 0.183.385 and a qualified Server assembly are required. This is
source-candidate documentation: normal CI, immutable publication, weak-model
behavior and native acceptance remain pending. Prior unaffected acceptance is
retained separately; this candidate does not establish complete WebMCP coverage.
