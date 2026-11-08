# Web Console 1.6.233 / Bridge 0.2.35

## Candidate boundary

Prepared source only; this component is not published. Matching Engine remains
**0.183.391** and Compose **0.14.44**. The latest published baseline remains
[Web Console 1.6.232 / Bridge 0.2.34](web-console-1.6.232.md).

## Scoped Bridge environment startup

The private environment-identity view is returned through the normal native
GDAPI resource envelope. The Bridge now validates its `aiResourceView` type,
base type and bounded metadata maps, then uses only `id`, `resourceType`, `data`
and `nextMarker`. The existing bare DTO also remains accepted. Unknown fields
and malformed metadata fail closed; metadata URLs and actions are never followed
or used as authorization.

Each business row still contains exactly `id`, `uuid`, `name` and `state`.
Selected IDs, exact names, active state, first-server UUID pins and live Key
revision checks remain binding. Ordinary Project access, explicit parent denials
and unrelated business-read failures keep their original behavior. No permission,
public tool, request parameter, dependency or Engine change is introduced.

Registry removal, Service startup arguments, reviewed Stack actions and the
twelve-tool query/preview/human-confirmation flow remain unchanged.

## Qualification boundary

Two new Node methods cover native/bare envelope compatibility and malformed
metadata/DTO rejection. Four directly affected scoped identity, UUID and
authorization methods also passed locally. These source tests do not replace
normal full CI, packaged SDK qualification, publication or native acceptance;
all remain pending for this candidate. No complete frontend-group or runtime
acceptance is claimed. Installing a component does not update a running Server.
