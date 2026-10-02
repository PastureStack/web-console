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

## Unallocated local Volume lifecycle

Local Volume creation does not create a storage-pool map. The previous pool-only
list therefore offered no reliable independent Add entry or visible row for that
resource. The candidate keeps the existing storage-pool sections and adds a
separate native local-volume entry and list, without inventing a pool or binding
a host. Exact resource IDs, the current environment, explicit local/non-native
resource fields, the actual complete storage-pool relationship and the full
scoped mount cache establish that a volume is unallocated. Inactive and
unresolved workload mounts still exclude it. Missing or failed relationship
reads are not empty proof.

The current environment's schema controls Add; a genuine advertised deactivate
action and current schema ownership control stopping an unallocated active
volume. After the server transitions it to detached, the existing native remove
action remains responsible for deletion. Dispatch rechecks the relationships.
Late relationship reads, allocation changes and project/store generations may
not restore stale capability. Initial read failures use the existing route
error path; background failures use the existing localized growl API with the
original error and no automatic retry.

The new section uses existing table, state and action-menu components, with
translations for all thirteen existing locales. No global layout or other
resource lifecycle is redesigned. Packaged native create/cancel/refresh/
deactivate/remove, readonly same-ID denial and visual acceptance remain pending.

## Verification

Local Chrome 153 passed all nine directly affected QUnit tests, with zero
failures, skips or todo: four new Volume/current-schema cases and five existing
shared create/upgrade cases with actual fresh project context. The new cases
cover schema-generation revocation, missing/stale/switched environments, direct
route rejection before form-model creation, allowed local-volume form creation,
and the existing PUT/POST upgrade distinction. `git diff --check` passed.

Eleven additional focused cases cover actual Store/Collection relationship
reads, exact-ID classification, inactive/unresolved mounts, generation changes,
late responses, error propagation, live rows and advertised-action dispatch.
Their local Chrome runs passed in affected-case groups after directly observed
failures were corrected; this is not a complete final-source suite result.
The localized incomplete-relationship assertions were added afterward and
await the final immutable-source CI run. Earlier failed logs are retained.

The first expanded immutable-source CI run passed all fifteen new scoped cases,
but its complete suite was 786/787: an existing storagepools/pools test omitted
the Store and expected the old synchronous return. That adjacent test now awaits
the route using the actual Store fixture and checks the retained parent array
and both live collections. The failed run is not a publishable result; final CI
is pending after this test-contract correction. A second run also passed all
fifteen new cases, but exposed an incorrect identity assertion in the adjacent
test: `Store.all()` creates separate ArrayProxy wrappers over the same live
content. The test now verifies shared content and actual live cache additions,
not wrapper identity. Neither failed run is a publishable result.

The following run passed 787/787 browser tests but was correctly blocked by the
API-store compatibility source gate: the new all-mounts relationship imported
the old addon helper directly. The relationship now uses the common local
reference boundary and the Store's existing invalidation contract. An additional
actual-Store regression checks late inactive mounts, removal and watch deduplication.
The five shared-reference cases passed in local Chrome 153 with no failures,
skips or todo, using the newly compiled source rather than an older build.
Final immutable-source CI and packaging remain pending.

Production changes are confined to the shared guard, storage-pool section,
new-volume route and the local-volume list/relationship/action paths described
above. Package/lock/source-gate versions
advance together without dependency or security-threshold changes.

Local source tests are not native create/remove, cross-account API, mobile or
full thirteen-locale acceptance. The complete permission/resource/locale matrix
remains INCOMPLETE. Authentication, MFA, session synchronization and existing
API contracts are unchanged.
