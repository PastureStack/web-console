# Web Console 1.6.233 / Bridge 0.2.35

## Published component

The immutable [1.6.233 release](https://github.com/PastureStack/web-console/releases/tag/1.6.233)
is published with Bridge **0.2.35**, matching Engine **0.183.391** and Compose
**0.14.44**. Producer `ce0f6c05b272b77b21819bc08e418f1ad41ca691` and normal
merge/tag target `6c132677ba7ff609b0a533483b0143df6d325060` share tested tree
`870fdbff071ef61f15352768cf0c22c03140f810`.

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

Original full/enabled CI passed 374 specified methods (350 Node and 24 QUnit;
372 retained plus two new) and 1,149 browser tests with zero failures. The new
methods cover native/bare envelope compatibility and malformed metadata/DTO
rejection. Required CodeQL passed. Bridge 0.2.35 passed its own packaged SDK
1.32.2 handshake; no earlier Bridge result was substituted.

All thirteen published assets passed anonymous SHA256 readback. The immutable
release attestation covers fourteen subjects. The Web archive SHA256 is
`73146283c973c8c04bf3c444ac7e822993e584ab20d0f80460b3cd6a07d4f0f7`;
Bridge ZIP SHA256 is
`6709690e144ec06a097726a0373eea172f886bbbb83aa09329889f86a6839def`.
See the [release metadata](https://github.com/PastureStack/web-console/releases/download/1.6.233/web233-release-metadata.json).

Matching Server 1.6.590 assembly/deployment and affected native acceptance remain
pending. No complete frontend-group or runtime acceptance is claimed. Installing
a component does not update a running Server.
