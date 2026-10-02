# Web Console 1.6.169

## Scope and root cause

The shared unallocated-local-volume classifier incorrectly required `externalId`
to be null. The engine's existing `VolumeExternalIdPreCreate` handler generates
that identifier from a volume name when no image is attached. Consequently a
successfully created, inactive local volume could disappear from the independent
local-volume list despite having no host, workload or storage-pool allocation.

The classifier no longer treats a string identifier as allocation. It retains
the identifier in the relation-proof identity so stale asynchronous reads cannot
restore capability after metadata changes. Explicit resource classification,
current environment, null host/image/instance references, complete pool reads
and full scoped mount-cache checks remain mandatory. Missing relationships never
mean unused. No backend permission, authentication, request method or lifecycle
transition changes; inactive volumes use their existing advertised remove action.

## Verification and publication

Focused real Store/Volume/Collection regression tests and formal build validation
are pending. Packaged browser create, cancel, refresh, readonly same-ID denial and
remove acceptance are also pending. Historical failed acceptance receipts remain
failed and are not retrospectively promoted. The full permission matrix remains
INCOMPLETE. No company deployment is part of this repair.

## Upgrade and rollback

Use a new immutable component tag and a new Server patch image after publication;
do not overwrite `1.6.168` or Server `v1.6.505`. The change requires no migration.
Existing persistent volumes, runtime configuration and the previous immutable
Server image remain the rollback boundary.
