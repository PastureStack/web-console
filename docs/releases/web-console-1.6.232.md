# Web Console 1.6.232 / Bridge 0.2.34

## Candidate boundary

Prepared source only; this Web Console and Bridge release has not been published
or qualified. It requires matching Engine **0.183.391**. The latest published
baseline is [Web Console 1.6.231 / Bridge 0.2.33](https://github.com/PastureStack/web-console/releases/tag/1.6.231).
Compose remains **0.14.44**. Server assembly, deployment and native acceptance are
separate and are not claimed by this candidate.

## Registry removal workflow

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

Service startup-argument omission, null, empty arrays and ordering remain intact,
as do secondary launch configurations, ordinary/Catalog Stack behavior and the
existing human confirmation, cancellation and recovery paths.

## Qualification boundary

The tool count remains **12**, SDK **1.32.2** and the dependency graph is unchanged.
Six new Node method identities cover Registry removal and the human Cookie Inbox;
their owning scripts remain in normal CI. Source method registration is not a
CI or browser result. Full/enabled CI, packaged SDK qualification, immutable
publication and anonymous asset/attestation verification remain pending for this
candidate. Native workflow acceptance and complete 243-group coverage are not claimed.
