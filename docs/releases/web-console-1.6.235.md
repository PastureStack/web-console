# Web Console 1.6.235 / Bridge 0.2.37

## Scope

Host discovery now matches either the custom name or the native hostname in
both browser and standalone Bridge transports. A Host without a custom name
uses its hostname in the readable result path; its actual editable name remains
null. Duplicate candidates stay distinct opaque references. No Host rename,
scheduling change or authorization shortcut is performed by discovery.

The matching assembly requires the Engine 0.183.395 Host lookup fix so its
native authorized page does not first exclude Hosts with a null custom name.
Query-bound cursors remain incomplete until all bounded pages are consumed.
Other resource search behavior and Registry address lookup are retained.

## Validation boundary

Original full/enabled CI passed 383 specified methods (378 retained, five new)
and 1,149 browser cases with zero failures. The real packaged SDK handshake
passed. Thirteen published assets passed anonymous SHA256 readback; the
immutable release attestation covers fourteen subjects.

Producer `6dd59932fa60718225e5129454ddb5959e917fb9` and merge/tag
`a980b389c2038dfc73d54d14970e55573a59438c` share tested tree `5f7fa79cdc5bff1a96c276a9bfcaa5d4883005dd`.
The Engine 0.183.395 lookup fix is still pending publication because required
builds could not fetch Ubuntu snapshot APT indexes. Matching Server deployment
and native Host stop/start acceptance are not claimed by these component
checks. No production or runtime patch is included.
