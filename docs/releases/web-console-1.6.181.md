# Web Console 1.6.181 — API Key policy scopes and audit

[Web Console 1.6.181](https://github.com/PastureStack/web-console/releases/tag/1.6.181)
is published with the retained official production archive and portable checksum.
The release and assets are immutable; no rebuild or producer relabeling was used.

## Changes

Capability-gated API Key settings support full, closed and custom access,
expiration, reviewed changes with platform MFA, and per-key audit. Grants remain
bounded by live owner permissions; legacy Keys are not automatically narrowed,
and secrets are displayed only at creation.

Scope choices use readable, searchable Project, Stack and resource names with
their context. Fresh role-aware project queries allow administrators to select
readable environments without direct membership while ordinary users retain
their account boundary. Selecting a scope closes its menu before dependent
choices load; parent, owner and authority changes invalidate stale evidence.
The draft/review matrix explains allow/deny precedence without granting authority.

Per-key audit uses the existing row action menu, translated loading/error states,
readable wrapping reasons, and a close control below its results. Narrow editor
and selector layouts, keyboard focus ownership, range recovery and export locks
preserve usable controls. Late query/session responses cannot replace current
results; an HTTP response is not a successful background or stream outcome.

## Artifact and limited acceptance

The numeric tag binds original producer commit
`7f2bdad0c90a3241693c2ddd4475202ababba550`, tree
`2bf9c349e61a7ad1976819d80ddba10f4e92de50`; same-tree integration commits
do not replace the archive's producer identity.
`web-console-1.6.181.tar.gz` is 3,022,595 bytes; SHA-256:
`9199681f2c4311f3fbe8727fcf0f6fa136c9bafe9fbe9d13878c55df442a7a03`.

Official production build/package verification passed, including byte equality
for all 123 packaged production files. The focused Chrome receipt records
92 passing tests with zero failure, skip or todo. Separate native QA executed
five UI cases and zh-TW per-key audit checks at 390/1440 px for menu behavior,
exact-Key scope, count and layout, on matching runtime JS bytes.

This is not a whole platform matrix. The native gate did not rerun actual viewer
permission withdrawal, resource-action execution parity or English UI19
keyboard/narrow-screen cases; `wholeMatrixPass=false`.
The matching Server `v1.6.519` image is still an unpublished assembly candidate
pending release-artifact acceptance. Component publication is not formal Server
deployment acceptance; use the
[Server installation guide](https://github.com/PastureStack/server#quick-start)
for the currently published platform.
