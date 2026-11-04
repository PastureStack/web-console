# Web Console 1.6.206 / bridge 0.2.8 published

This published component extends the existing image-upgrade
preview/apply/operation tools with `startFirst`, `batchSize` and `intervalMillis`.
Matching Engine 0.183.367 is published. At component publication QA125/8080
still runs Server565; matching Server566 and designated runtime acceptance
remain pending.

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

## Publication and validation

The [1.6.206 release](https://github.com/PastureStack/web-console/releases/tag/1.6.206)
publishes the original qualified CI bytes, without rebuilding. Producer
`d890c430f5c6e72578b1585d1ccc11103bc47bfe` and tag source
`dff010676392cb77a7bcc3a1ca72b3a915407ce8` share tested tree
`f9fb88c00c5846115ad8dfd7cc7964bcc40ce50b`.

Full/enabled Validate run `41884626353` and CodeQL run `41884627666` passed.
The original browser suite passed 1,122 tests with zero failures. Nine distinct
new source cases cover 4 command, 2 human UI, 1 bridge, 1 label and 1 contract
case. Thirteen-locale label checks are parameter coverage, not thirteen unique
tests. Original archive, manifest and runtime/build SBOM qualification and both
cryptographic attestations passed. All 13 public assets passed actual anonymous
GET, byte-count and SHA256 verification.

Bridge 0.2.8 has 35 exact-Git source files and 37 ZIP entries including its
manifest and SBOM. Its 92-component dependency graph matches published 0.2.5
except root version. Clean-install, dependency and real SDK-handshake evidence
is carried from 0.2.5; no new install, dependency scan or SDK handshake is claimed.

## Runtime boundary

The scope is one bounded extension of existing `service.typed.image_upgrade`
and the ordinary Service upgrade context, not three new business functions or
whole-group acceptance. The 243-group inventory and Excel are not modified.
The new upgrade-dialog runtime/layout, role/Key, cross-ID, weak-model and cleanup
checks on the matching assembled Server remain pending.

Package roots, active test lock, strict producer version guard, bridge handshake
and packager are synchronized to 206/0.2.8. Dependency graphs and command
protocol `1.0` are unchanged. Component publication does not establish Server566
deployment or a new runtime PASS, and full 243-group acceptance is not claimed.
