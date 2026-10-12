# Web Console 1.6.183 — Host onboarding

[Web Console 1.6.183](https://github.com/PastureStack/web-console/releases/tag/1.6.183)
is published. This minimal hotfix is based on 1.6.182 and does not include the
broader pending integration UI changes.

## Published identity

- Source: merged main commit
  [`e056a0111d20816742eff17a65dfabb5d003dae2`](https://github.com/PastureStack/web-console/commit/e056a0111d20816742eff17a65dfabb5d003dae2),
  tree `d9e63fe771de4ade94631c1ef1eb813f6147dc41`.
- [Complete production archive](https://github.com/PastureStack/web-console/releases/download/1.6.183/web-console-1.6.183.tar.gz):
  SHA-256 `8540758ad4521f901f53fc79473570cf98862add2addcb49271d8dbf125b4217`.
- [Portable checksum](https://github.com/PastureStack/web-console/releases/download/1.6.183/web-console-1.6.183.tar.gz.sha256):
  checksum-file SHA-256 `d0b9818a4c5f4bbe9b4c495ae7f1861fb061a488fa4197106be442b17f06e48a`.

The published source tree equals the tested hotfix tree. Its tested production
dist was carried into the original packager using the actual merged-main epoch
`1791802117`; no second compile or test run is claimed. All 123 archive file
contents equal the tested archive byte-for-byte; only tar-entry timestamps differ.
Dependency licenses and provenance are retained.

## Changes and focused validation

Add-host Close and Back closures explicitly dispatch to the active route instead
of returning a value that does not bubble. The existing route destinations and
machine-driver lifecycle are preserved. The shared clipboard native-event fix
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
runner. These unit results alone are not native browser or host-registration
acceptance.

Three additional focused route/history cases passed for initial Custom redirects,
API-host settings refresh, and direct-URL self/missing-target fallback. Together,
the eleven new unit cases passed 51 assertions. Existing copy tests were not rerun.

Native browser validation passed first-time API-host settings save, the normal
Add Host entry, actual copy-icon clipboard equality, and Close returning to Hosts.
There were no page or console errors or loading error, and runtime cleanup passed.
Required protected-branch CodeQL checks passed before merge.

At component publication, Server 1.6.522 assembly and active-agent acceptance
were still pending. Native UI
validation did not claim that a registration command was run or an agent became
active, and this component release is not whole-platform acceptance. See the
[Server current-release guide](https://github.com/PastureStack/server#current-release)
and [installation guide](https://github.com/PastureStack/server#quick-start)
for the published Server pairing and deployment workflow.
