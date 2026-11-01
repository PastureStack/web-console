# Web Console 1.6.205 / bridge 0.2.7 source candidate

This source candidate extends the existing twelve typed tools with Service
create ports and health checks. It is not published or deployed. Matching
Engine **0.183.366** support is required; compatible Server assembly and runtime
acceptance remain pending. Published Web Console 1.6.204 / bridge 0.2.6 does not
include this extension.

## Service creation

`preview_resource_change` accepts Service create `ports` as up to 64 native
PortSpec strings and a closed `healthCheck` object. Native validation handles
port numbers, bindings and IPv4/IPv6. Bare `80` or `80/tcp` requests random
public-port assignment; `[]` publishes no ports. The service uses
`networkMode: "bridge"` and `startOnCreate: false`. Starting it requires a
separate approved plan.

Health checks require a container port and support the documented request line,
timings, thresholds and `none`/`recreate` strategy. Timings use milliseconds;
thresholds count checks. The review retains exact JSON port strings and shows
localized health-check labels and units in all thirteen locales. Full bounds
and examples are in the [field contract](../webmcp.md#service-create-ports-and-health-checks).
Existing service configuration changes retain the normal upgrade workflow.

Human approval binds the exact displayed path and changes. A changed review
invalidates confirmation. After apply, a verified successful operation may
expose read-only `executionResult.assignedPorts` in the tool result and human
dialog. This receipt is separate from the immutable approved `changes`; it
does not approve new settings or imply startup. Accepted, running and unknown
results still require reading the existing operation.

Browser and stdio use the same command sources with protocol version `1.0`.
Build ceilings, page startup in off mode, current actor/Key limits, durable
audit acknowledgements and human confirmation retain their existing behavior.

## Source validation

Focused checks already passed on the implementation before version/document
synchronization:

- Service create and resource lifecycle scripts: 36 cases, including 9 Service
  create cases. These use controlled transport fixtures.
- Human dialog/service integration: 2 Service create cases, including the
  confirmation, apply, operation, pending-plan and dialog result chain.
- Review labels: 6 cases, including field and unit labels in all 13 locales.

These counts are component evidence, not native platform or browser acceptance.
The new Service create script is included in the existing full CI entry point
and bridge source archive allowlist. It must run again against the immutable
release producer commit in CI.

## Qualification and publication still required

Package versions, bridge handshake, packager and the active release/test lock
baseline are synchronized. Dependency graphs are unchanged; this does not
constitute a fresh dependency scan, bridge installation or SDK handshake.
No candidate artifact, digest, SBOM qualification or producer SHA is claimed.

Use the existing full/enabled CI and required security checks on one immutable
source commit. Retain the original producer artifacts, archive/manifest/SBOM
verification and WebMCP sidecar; the reviewed merge and numeric tag must retain
the tested source tree. Package the matching bridge exact sources and SBOM,
then verify the published assets' actual bytes. Publication must not rebuild
the qualified Web Console component. Compatible Engine/Server assembly and
designated native/browser, role/Key, cross-ID, weak-model and cleanup acceptance
require their own evidence.
