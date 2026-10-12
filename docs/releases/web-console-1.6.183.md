# Web Console 1.6.183 — Host onboarding (candidate)

This is an unpublished minimal candidate based on released Web Console 1.6.182.
It does not include the broader integration candidate's pending UI changes.

Add-host Close and Back closures explicitly dispatch to the active route instead
of returning a value that does not bubble. The existing route destinations and
machine-driver lifecycle is preserved. The shared clipboard native-event fix
already released in 1.6.182 remains unchanged.

Host onboarding uses native RegistrationToken or Machine collection POST
capabilities rather than Host POST: the native owner schema grants host
read/update/delete but creates hosts through registration or provisioning.
The shared capability remains bound to the current project's loaded schemas.
Custom registration requires RegistrationToken POST; machine-only access hides
Custom and rejects its direct URL with the existing translated 403. Readonly,
absent or stale project schemas grant no onboarding access. Backend roles and
host collection permissions are unchanged.

Four focused component tests passed using the real driver and clipboard templates:
Linux and Windows displayed-command copying and Close, Back route dispatch, and
HTTP clipboard fallback. The minimal controller, tests and direct dependencies
match that tested source; the numeric version bump does not rerun those tests.

Eight new focused native-schema unit cases cover host-GET-only owners with
registration POST, readonly and stale schemas, machine-only driver selection,
direct Custom denial, registration-only loading and stale asynchronous completion.
They passed offline with the actual product methods and native API-store
capability function; they are also included in the repository's normal unit-test
runner. This is not native browser or host-registration acceptance.

The production archive retains dependency licenses and provenance. Native host
registration, active-agent acceptance and protected-branch CI remain separate
pending gates; this component candidate is not whole-platform acceptance.
