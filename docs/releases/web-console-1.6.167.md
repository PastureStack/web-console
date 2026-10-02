# Web Console 1.6.167

Unpublished source candidate. Official validation, publication and packaged
Server/browser acceptance remain separate, pending results.

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
source gate passed for revision 4. This note does not claim official validation
or publication, packaged native-browser success, or full permission/resource/
locale matrix PASS.
