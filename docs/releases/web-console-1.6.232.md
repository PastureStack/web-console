# Web Console 1.6.232 / Bridge 0.2.34

## Published component

Web Console **1.6.232** / Bridge **0.2.34** is published for matching Engine
**0.183.391**. Compose remains **0.14.44**. Original CI, packaged SDK qualification,
immutable publication and anonymous release verification passed. Matching Server
assembly/deployment and designated native acceptance remain separate and pending;
publication does not update a running Server.

## Reviewed Registry removal and scoped Bridge startup

The existing typed tools can preview removal of an inactive Registry, including
its non-sensitive linked-credential count. A person reviews the complete impact
and confirms the exact plan. An active Registry requires a separate approved
stop, a fresh lookup and a new removal preview; no automatic stop or retry occurs.
Fresh confirmation and apply preserve the reviewed count and retention boundary.

The existing native owner removes linked credentials with its Registry. The
request does not read or expose credential values, revoke an external registry
account, or remove images, containers or volumes. Native parent/child locking,
UUID/CAS, live role/Key ceilings and Full/legacy behavior remain authoritative.
Completion requires the exact native root and all captured child terminal facts;
a missing response, unrelated process or API denial does not prove removal.

Bridge startup can resolve only the selected environment's identity through an
already readable Stack or Service. Ordinary Project reads and updates keep their
original permissions; explicit parent/global denials, live Key revisions and
membership remain authoritative. Full/legacy Project access retains its existing
description/date selection. Indistinguishable scoped names fail without choosing
the first result, and both profile formats pin the server's first UUID. The
fallback does not retry an unrelated denied business read or grant permission.

Service startup-argument omission, null, empty arrays and ordering remain intact,
as do secondary launch configurations, ordinary/Catalog Stack behavior and the
existing human confirmation, cancellation and recovery paths.

## Qualification boundary

Original full/enabled workflow **42520396566** passed all 372 required methods
(348 Node / 24 QUnit, 360 retained plus twelve new) and 1,149 browser cases with
zero failures. The new methods cover Registry removal, the human Cookie Inbox
and scoped Bridge startup. Bridge **0.2.34** passed its one real packaged SDK
**1.32.2** handshake with zero failures. The twelve tools and dependency graph
remain unchanged.

Producer `2377a76d1e9db0d5ca31cdfbeb58e2ac6e8ee91f` and normal merge/tag
target `02ec2f6afd1fb03b222237ced875c4965966be1e` share tested tree
`684d83a3e45697574a441d0c4a9055e4babb7a35`. All thirteen public assets passed
anonymous byte/digest verification; release cryptographic verification covers
fourteen subjects. See the [published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.232/web232-release-metadata.json).

Earlier failed CI runs remain recorded and do not supply qualification evidence.
Designated native workflow acceptance remains pending; these component results
do not claim all 243 frontend groups are complete.
