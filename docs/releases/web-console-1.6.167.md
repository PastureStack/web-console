# Web Console 1.6.167

Published as the signed immutable numeric
[release `1.6.167`](https://github.com/PastureStack/web-console/releases/tag/1.6.167).
Component publication and the separately verified Server503 QA deployment
do not establish complete matrix PASS. Scoped native permission checks are
reported separately below.

## Shared schema-ID lookup

The API store caches schema IDs in normalized lowercase form, but `getById`
previously normalized only the resource group, not the schema ID argument.
Consequently the inherited `Resource.schema` getter could miss a valid
`registryCredential` schema even though the backend advertised `GET` correctly.
Other mixed-case callers of `canCreate`, `canList` and schema-based update checks
use that same lookup.

The lookup now normalizes the ID only when the resource group is `schema`, using
the existing `normalizeType(id, store)` function. Ordinary resource IDs remain
opaque and case-sensitive. The actual project's cached schema remains the only
capability source; missing schemas do not gain fallback permissions. Backend
schemas, role filters, API resource/action names, authentication, request methods
and lifecycle writes are unchanged.

## Packaging and validation boundary

The reviewed API-store compatibility archive advances from revision 3 to 4.
Earlier archives remain byte-unchanged. Its upstream version, license and
dependency graph are retained; only the schema lookup and local provenance
metadata change. Root package/lock versions and matching source-gate literals
advance to `1.6.167` without changing security thresholds.

Focused regressions exercise the actual Store bulk schema cache, inherited
Resource getter and capability consumers for mixed/lowercase names, missing
schemas, isolated project stores and case-sensitive ordinary resource IDs.
The local Chrome run passed all four focused tests and 43 assertions, with
zero failed assertions, page errors or local network errors. The install-archive
source gate passed for revision 4. Exact-source official validation
[37012345421](https://github.com/PastureStack/web-console/actions/runs/37012345421)
passed 772/772 tests with zero failures, skips or todo, including four new
actual Store/schema cases. Its two production archives were byte-identical.

The tested and tagged source is `dff35fc4bce340e21cac7204146a7bcb20a7b60b`;
normal squash merge `a782376a3986895a2be1b8e9911bdc19e5d32216` has the same
tree `a9437d60fae29ac638cf8749ae151fa8cfde338d`. The verified signed tag object
is `d375219cb06412b7966fbdcec1589bf3eb8a8e01`. Anonymous public asset
downloads match the formal archive SHA-256
`e8e714fc06282de75a3570aac1d4d4d04a3c9478d982d0d5aaeae14efa8ebbaf`
and size 2,976,297 bytes.

Server503 packages this immutable artifact. Its QA first start and one restart
returned HTTP 200/pong after nine attempts each. Runtime settings, environment
overrides, named mounts and five-table count baselines were preserved; the
previous immutable Server502 rollback and database backup were retained.
Docker health is `null`, and no Docker `healthy` result is claimed. These are
deployment-preservation results, not complete native-browser acceptance.

Separate packaged QA confirmed the actual registry and credential models both
resolve their GET-only schemas for the tested readonly account. Create controls
are hidden, edit/remove controls are disabled, and direct denied entry points
use the existing human-readable permission messages. All 24 normal-CSRF
v1/v2-beta write-denial checks passed for readonly/no-access roles. This is
exact-fixture coverage; it does not establish all API authorization, remaining
native lifecycle, thirteen-locale badge or mobile layout acceptance. Historical
HOLD receipts are not promoted and the complete matrix remains INCOMPLETE.
No zero-findings claim is made.
