# Web Console 1.6.199

This source prepares Web Console 1.6.199 and the immutable stdio bridge 0.2.1.
Release CI, artifact verification and Server/browser acceptance are separate
gates. The published 1.6.198 and bridge 0.2.0 artifacts remain unchanged.

An authoritative `422 ResourceChangeUnsupported` still returns
`UNAVAILABLE / rejected`. Its tool reply now explains that Global services
deploy according to eligible hosts and do not support a manual instance count.
It directs the caller to review deployment configuration or eligible hosts,
without retrying the same plan or guessing a different count.

The matching Engine enforces manual-scale eligibility before preview or apply.
A target changed after preview retains the existing stale-snapshot conflict.
Permission failures, feature-off replies and uncertain transport outcomes keep
their existing categories. Global start/stop/restart and ordinary UI/API paths
are unchanged by this reply correction.

Three focused cases cover unsupported preview, an unsupported legacy plan at
apply, and the unchanged conflict/permission/feature-off/unknown boundaries.
No dependency graph changes, Catalog adapter, archive/restore work or new
translation keys are included. Existing twelve-tool, human approval and initial
off behavior remain. This source evidence does not claim the full frontend
inventory, role matrix or pending live candidate acceptance has passed.
