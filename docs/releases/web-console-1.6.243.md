# Web Console 1.6.243 candidate

An untouched load-balancer image upgrade with cookie stickiness could first
submit a metadata PUT because the form materialized an absent policy name as
null. Compare these two equivalent representations without modifying either
object. Actual cookie, policy-name, certificate and custom-config edits still
use the existing bounded metadata update before the native upgrade.

The native launch configuration and previous primary/secondary rollback
snapshots remain unchanged. This does not alter API authorization, sessions,
Catalog history or LB binary behavior.

Two regressions cover the absent-name case and actual policy changes. The
lb-upgrade validation scope exercises the affected component and adjacent route,
retaining security checks and deterministic release builds. Unrelated Web242
passing evidence remains limited to its original source and scope. Publication
and real deployed-browser lifecycle acceptance are separate results.
