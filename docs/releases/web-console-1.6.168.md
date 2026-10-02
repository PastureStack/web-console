# Web Console 1.6.168

Release candidate for the immutable numeric `1.6.168` component. Publication and
packaged browser acceptance will be recorded after their actual results are known.

## Current-environment Volume permissions

The storage-pool section previously always rendered its Volume Add link, and
the new-volume route did not use the shared create-permission guard. These two
entry points now use the current environment's `volume` schema POST capability.
Missing schemas do not grant permissions. The Add predicate updates when the
environment, schema owner or schema generation changes.

The shared guard now requires its cached schema owner to match the current
environment before either create or upgrade entry. It continues to use PUT for
an explicit upgrade and POST for creation. The seven project-scoped callers
retain the existing localized permission error and safe route replacement.
The API remains the authorization boundary: no role-name override, new backend
permission, alternate request method or fallback capability is introduced.

## Verification

Local Chrome 153 passed all nine directly affected QUnit tests, with zero
failures, skips or todo: four new Volume/current-schema cases and five existing
shared create/upgrade cases with actual fresh project context. The new cases
cover schema-generation revocation, missing/stale/switched environments, direct
route rejection before form-model creation, allowed local-volume form creation,
and the existing PUT/POST upgrade distinction. `git diff --check` passed.

Production changes are confined to the shared guard, storage-pool section
component/template and new-volume route. Package/lock/source-gate versions
advance together without dependency or security-threshold changes.

Local source tests are not native create/remove, cross-account API, mobile or
full thirteen-locale acceptance. The complete permission/resource/locale matrix
remains INCOMPLETE. Authentication, MFA, session synchronization and existing
API contracts are unchanged.
