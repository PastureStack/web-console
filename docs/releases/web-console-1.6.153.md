# Web Console 1.6.153

This patch addresses gaps found while exercising the isolated six-role
permission matrix on Server v1.6.486. The UI now checks the selected project,
loaded schema and resource action link at the point of a Stack, Service,
Container, Catalog, or related write. The Server remains the authority for
authorization; a hidden or disabled control is not an API permission grant.

Delayed actions are bound to their originating project. A queued project
upgrade cannot be sent to a newly selected project; a debounced Service scale
cannot write after the user switches projects; and a completed Catalog Stack
save cannot navigate a stale Stack ID into that newer project. Denied or
missing resources show a neutral localized error without exposing a private
ID. Registry edit recovery and Japanese labels were checked against their
actual forms. Host/container charts stop their loading spinner when their
stats link is unavailable; 401/403/404 are not retried, while transient 5xx
can retry using a fresh socket. No backend API contract or stored data changed.

Focused Chrome QUnit tests cover role/capability changes, the three project
switch races, Registry recovery, translated messages and stats-link failures.
The separate Server v1.6.486 QA evidence includes six-role read-only feature
discovery and selected real write flows, but does not prove every button
submission or every direct resource-ID operation. VM, Secret, Certificate and
Receiver have no valid QA IDs in the current three-project inventory, so
their direct-ID authorization remains untested rather than marked passing.
Packaged Server browser acceptance must be recorded after this Web Console
asset is incorporated into a new immutable Server image.

The Node 24 package lock changes only the two root version fields from
1.6.152 to 1.6.153; dependency entries are unchanged.
