# Web Console 1.6.206 / bridge 0.2.8 source candidate

This candidate extends the existing image-upgrade preview/apply/operation tools
with `startFirst`, `batchSize` and `intervalMillis`. Matching Engine367 support
is required. Original CI, artifact/SBOM qualification, publication and designated
runtime acceptance are pending. Published Web205 / bridge0.2.7 remains available.

## Closed strategy and human review

Each field is optional. Effective defaults remain `startFirst: false`,
`batchSize: 1`, `intervalMillis: 2000`. Batch size must be an integer ≥1 and
interval an integer ≥100 milliseconds. The JSON safe-integer upper bound
9007199254740991 protects exact transport; native Long fields have no such
product maximum. No request is clamped in the client.

The server returns a closed `upgradeStrategy` containing all three effective
values. The tool verifies them against the request/defaults, then the human
dialog shows exact values using existing translated labels and millisecond
units. Image, target path and strategy bind one immutable review through human
confirmation, apply and operation reads, including the human inbox with browser
tools off. Changed values invalidate confirmation. Unsupported servers must
not receive a weaker retry with requested settings removed.

Apply accepts only the existing planRef. A response that drifts after a possible
write retains `unknown` with the same operationRef; it does not become proof of
rejection or completion. Native port/volume preflight, original actor/Key
authority, primary/secondary configuration preservation and verified readiness/
cleanup continue through their existing owners. Ordinary upgrade forms are not
changed. Full launch-config editing, sidekick selection and independent rollback
or finish/cancel actions are outside this batch.

## Source and release boundary

The scope is one bounded extension of existing `service.typed.image_upgrade`
and the ordinary Service upgrade context, not three new business functions or
whole-group acceptance. The 243-group inventory and Excel are not modified.
Thirteen-locale label checks are parameter coverage, not thirteen unique tests.

Package roots, active test lock, strict producer version guard, bridge handshake
and packager are synchronized to 206/0.2.8. Dependency graphs and command
protocol `1.0` are unchanged. The existing CI entry points include the new local
cases; no full build, install, deployment or new runtime PASS is claimed here.
