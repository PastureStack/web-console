# Web Console 1.6.235 / Bridge 0.2.37 candidate

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

Five new Host search regressions and 24 adjacent Host/Registry cases pass
locally (29 tests). These cover both transports, null/custom names, duplicates,
foreign-project filtering, empty pages and cursor query binding. Original CI,
packaged SDK checks, immutable publication and matching Server native Host
scheduling acceptance remain pending. No production or runtime patch is used.
