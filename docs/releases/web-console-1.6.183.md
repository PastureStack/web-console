# Web Console 1.6.183 — Add-host closure dispatch (candidate)

This is an unpublished minimal candidate based on released Web Console 1.6.182.
It does not include the broader integration candidate's pending UI changes.

Add-host Close and Back closures explicitly dispatch to the active route instead
of returning a value that does not bubble. The existing route destinations and
machine-driver contract are preserved. The shared clipboard native-event fix
already released in 1.6.182 remains unchanged.

Four focused component tests passed using the real driver and clipboard templates:
Linux and Windows displayed-command copying and Close, Back route dispatch, and
HTTP clipboard fallback. The minimal controller, tests and direct dependencies
match that tested source; the numeric version bump does not rerun those tests.

The production archive retains dependency licenses and provenance. Native host
registration, active-agent acceptance and protected-branch CI remain separate
pending gates; this component candidate is not whole-platform acceptance.
