# Web Console 1.6.169

Published immutable component; Server packaging and native QA acceptance are separate.

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

Three real Store/Volume/Collection regression cases passed in official Chrome
154 validation. They cover generated, hashed and custom identifiers on inactive
unallocated local volumes; typed input, pool allocation and inactive mounts;
and completed or late relationship-proof invalidation after identifier changes.
[Official exact-source run 37078265265](https://github.com/PastureStack/web-console/actions/runs/37078265265)
passed 791/791 tests, with zero failures, skips or todo. Two production archives
are byte-identical: 2,981,057 bytes, SHA-256
`e2bcb97b0da810f2ff216f9738739235e3c6f29ef46f1d99b623cf9c9f7258e2`.

The signed immutable numeric
[release 1.6.169](https://github.com/PastureStack/web-console/releases/tag/1.6.169)
pins signed source `5962f57fccb4062a65b5921646c06b4663713b9b`,
tree `cc5ababfff8c6a108f39687e5758f00c2b46970f`.
[PR157](https://github.com/PastureStack/web-console/pull/157) merged normally as
`9b886cdde091364f5865bbb8a257a6bdc826751c` with the same tested tree.
Anonymous public downloads of the archive and checksum asset match the formal
artifact's hashes and sizes. This is component publication/readback, not Server
deployment or native lifecycle acceptance.

Server `v1.6.506` is a source candidate in
[PR231](https://github.com/PastureStack/server/pull/231); its formal publisher
has not completed. Packaged native existing-volume terminal and fresh browser
create, cancel, refresh, readonly same-ID denial and remove acceptance remain
pending. Historical failed acceptance receipts remain failed and are not
retrospectively promoted. The complete permission/resource/locale matrix remains
INCOMPLETE. No company deployment is part of this repair.

## Upgrade and rollback

Use the published immutable `1.6.169` component with a separately published
Server patch image; the Server506 source candidate is not yet that artifact.
Do not overwrite `1.6.168` or Server `v1.6.505`. The change requires no migration.
Existing persistent volumes, runtime configuration and the previous immutable
Server image remain the rollback boundary.
