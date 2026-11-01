# Web Console 1.6.205 / bridge 0.2.7 published

[Web Console 1.6.205 and bridge 0.2.7](https://github.com/PastureStack/web-console/releases/tag/1.6.205)
are published. Original CI artifacts and all 13 public assets passed actual
anonymous GET, byte-count and SHA-256 verification. Matching Server565 runtime
and designated workflow acceptance remain pending.

## Service creation

The existing twelve typed tools now accept Service create `ports` as up to 64
native PortSpec strings and a closed `healthCheck` object. Matching Engine
**0.183.366** support is required. Native validation handles port numbers,
bindings and IPv4/IPv6. Bare `80` or `80/tcp` requests random public-port
assignment; `[]` publishes no ports. Creation uses `networkMode: "bridge"` and
`startOnCreate: false`; starting requires a separate approved plan.

Health checks use a container port, documented request line, millisecond timings,
thresholds and `none`/`recreate` strategy. Human review keeps exact port strings
and localized health-check labels and units in all thirteen locales. See the
[field contract](../webmcp.md#service-create-ports-and-health-checks).

Approval binds the exact reviewed path and changes; changing them invalidates
confirmation. Verified successful operations may expose read-only
`executionResult.assignedPorts` in the tool result and human dialog. This receipt
does not amend approved changes or imply startup. Accepted, running or unknown
results require reading the existing operation. Service environment/private
human inputs are not implemented in this release.

Browser and stdio share command protocol `1.0`. Build ceilings, initial browser
off mode, actor/Key limits, durable audit acknowledgements and human confirmation
retain their existing behavior.

## Published identity and evidence

| Identity | Value |
| --- | --- |
| Original producer | `931562ac0302b0406c5c2b44ec7a0f94307e5b2e` |
| Numeric tag / merged source | `1.6.205` / `ac928a5db556315f87abd3ffc213630aa7049d1f` |
| Shared tested tree | `ea359bababf5ed9270e88149bbfa789ba2b54d85` |
| Web archive SHA-256 | `5e33c9e2c71965552fb1e7c66c2c3f3c19b85fc6e4a74bd64c20c8dd51f57620` |
| Bridge ZIP SHA-256 | `3b7124d239b3f2b8c2a62775aded1e819953dce7a19471b0f3ac5c00587e20ad` |

[Original full/enabled CI](https://github.com/PastureStack/web-console/actions/runs/41322212841)
and [CodeQL](https://github.com/PastureStack/web-console/actions/runs/41322213632)
passed. The archive, manifest, WebMCP sidecar and runtime/build SBOMs were
qualified from the original artifact; publication did not rebuild it. Later
documentation commits do not replace the producer, tag or asset bytes.

The CI reports 1,122 Ember tests with zero failures. Twelve distinct new source
cases comprise 9 Service create, 2 human UI chain and 1 review-label cases. The
human cases cover confirmation → apply → operation → pending plan → dialog
receipt with controlled transport. Five audit-admission cases are inherited
from 204; 37 collaboration and 6 review-label source cases were observed in total.
Thirteen locales are label coverage, not thirteen additional tests. The
inherited layout QUnit is one case with 96 parameter combinations, not 96 tests;
its four compiled modules and four theme CSS assets are archive-bound.

The [bridge proof](https://github.com/PastureStack/web-console/releases/download/1.6.205/bridge027-release-proof.json)
records fresh exact-Git source bytes and a fresh 92-component lock-only SBOM.
Unchanged dependency, clean-install and SDK evidence is carried from published
0.2.5; no new 0.2.7 install, dependency scan or SDK handshake is claimed.
The [release metadata](https://github.com/PastureStack/web-console/releases/download/1.6.205/web205-release-metadata.json)
records artifact checksums, provenance and validation scope.

The final CI npm audit retains 63 Moderate and zero High/Critical findings.
The official `follow-redirects@1.16.2` patch remains present; Moderate findings
are not waived and no runtime `not_affected` claim is made. The runtime SBOM
retains its explicitly incomplete coverage classification.

## Integration boundary

Engine 0.183.366 and Compose 0.14.41 are separately published matching components.
Server565 assembly/runtime, designated browser/role/Key/cross-ID/weak-model and
cleanup workflows still need their own evidence. Component publication does
not establish deployed native Service creation or full Catalog acceptance.
The full 243-group frontend inventory remains in progress; earlier results
retain only their original scope.
