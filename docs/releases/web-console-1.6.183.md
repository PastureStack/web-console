# Web Console 1.6.183 — Host onboarding (candidate)

This is an unpublished minimal candidate based on released Web Console 1.6.182.
It does not include the broader integration candidate's pending UI changes.

Add-host Close and Back closures explicitly dispatch to the active route instead
of returning a value that does not bubble. The existing route destinations and
machine-driver lifecycle is preserved. The shared clipboard native-event fix
already released in 1.6.182 remains unchanged.

The add-host route saves its external return target before the initial driver
query redirect. Driver changes and the first API-host settings refresh no longer
replace it with the add-host route itself. Close/Back fall back to Hosts when
the target is absent or belongs to the add-host route family; valid external
targets and the existing waiting destination are preserved.

Host onboarding follows each form's actual submission path: Custom creates a
RegistrationToken; built-in and Other driver forms save a Host resource. The
native owner schema's Host read/update/delete capability does not block Custom
when RegistrationToken POST is available, and Machine API POST alone does not
grant either UI submission path.
The shared capability remains bound to the current project's loaded schemas.
Custom registration requires RegistrationToken POST; Host POST-only access hides
Custom and rejects its direct URL with the existing translated 403. Readonly,
absent or stale project schemas grant no onboarding access. Backend roles and
host collection permissions are unchanged.

Four focused component tests passed using the real driver and clipboard templates:
Linux and Windows displayed-command copying and Close, Back route dispatch, and
HTTP clipboard fallback. The minimal controller, tests and direct dependencies
retain the tested clipboard and closure dispatch; these component cases use the
waiting destination and are not rerun for the separate return-history correction.

Eight new focused native-schema unit cases cover host-GET-only owners with
registration POST, readonly and stale schemas, Host POST-only driver selection,
direct Custom denial, registration-only loading and stale asynchronous completion.
They passed offline with the actual product methods and native API-store
capability function, with independent Host and Machine POST fixtures; they are
also included in the repository's normal unit-test
runner. This is not native browser or host-registration acceptance.

Three additional focused route/history cases cover initial Custom redirects,
API-host settings refresh, and direct-URL self/missing-target fallback. Copy
tests are unchanged; native Close acceptance remains a separate gate.

The production archive retains dependency licenses and provenance. Native host
registration, active-agent acceptance and protected-branch CI remain separate
pending gates; this component candidate is not whole-platform acceptance.
