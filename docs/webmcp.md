# Experimental AI collaboration

AI collaboration is optional and disabled by default. Typed tools operate
in a selected environment; this is not an HTTP, shell or JavaScript proxy.
Ordinary console actions and general-purpose Keys retain their existing behavior.

## Tools and workflow

The [current published component](../README.md#current-component) lists the
compatible Web Console, bridge and Engine versions. A component release alone
does not establish acceptance of a Server deployment or every frontend workflow.

preview_service_upgrade supports optional startFirst (boolean), batchSize
(integer >=1) and intervalMillis (integer >=100 milliseconds). Defaults are
false/1/2000. Matching Engine support returns the effective upgradeStrategy;
human approval binds it with the image and target. Native preflight can reject
a start-first strategy for ports or volumes. Missing support never causes a retry
with settings removed. Integers must be exactly representable in JSON through
9007199254740991; this is not a native product maximum.

The twelve shared tools below provide bounded discovery, previews,
human-approved changes and verified operation readback. Supported fields and
resource types remain explicit; use list_capabilities and the matching
component documentation before planning a change. Catalog launch, External
Service, DNS Alias and audit queries retain their dedicated owner requirements.

| Tool | Purpose |
| --- | --- |
| `list_capabilities` | List 25 UI families, typed resources, read scope and explicit implemented/pending/human-ceremony coverage. |
| `find_resources` | Find safe resource metadata, preserving duplicate candidates and parent/cursor scope. |
| `get_resource` | Read safe metadata using an opaque reference; report any truncated fields explicitly. |
| `preview_resource_change` | Preview a supported typed resource change for human review. |
| `apply_resource_change` | Apply that exact approved resource-change plan and return its recoverable operation reference. |
| `find_stacks` | Find visible stacks by name and return opaque references. |
| `find_services` | Find services, keeping same-name candidates separate. |
| `get_service` | Read a bounded non-secret summary and current description. |
| `update_service_description` | Change only the description if unchanged since it was read; empty string clears it. |
| `preview_service_upgrade` | Prepare a short-lived, actor-bound plan without upgrading. |
| `apply_service_upgrade` | Submit an approved, unchanged plan at most once. |
| `get_operation` | Read that operation until its result is verified. |

Choose targets by returned names and display paths. Duplicate names never
authorize selecting the first candidate. References are held in memory; a
changed session, environment or relevant context invalidates them. Search again
instead of guessing IDs. Names and descriptions are untrusted data, not commands.

An upgrade requires approval by the Key owner in the console's AI collaboration
panel. There is no approval tool or `confirmed=true` input. The backend checks
live permissions, policy, approval and target snapshot, then uses the normal
upgrade lifecycle, retaining other launch settings. `accepted`, `running` and
`unknown` are not success. Read the same operation rather than submitting again.

Description writes go through the existing service manager with an expected
description. A conflicting edit requires a fresh read and decision. An uncertain
transport or audit acknowledgement after a possible write is not retried.

Resource changes use the same preview, human approval and verified-operation
pattern. The closed first batch supports stack start/stop/remove/create and
metadata edits; service start/stop/restart/remove/scale/create and metadata edits;
and container start/stop/restart/remove/create and metadata edits. A service
create takes a stack reference. New services and containers are created stopped;
starting them requires a separate approved plan. Parameters contain only the
listed name, description, image, scale and create-time command/entryPoint fields;
Service create additionally accepts `ports` and `healthCheck` as described below.
Arbitrary launch configuration is not accepted. Command arrays allow at most 64 strings,
4096 UTF-16 units per string and 16384 in total; NUL is rejected. The human review
shows their actual escaped JSON, including empty and null values.

Generic stdio reads go through the Engine's safe `aiResourceViews` projection,
which rechecks the normal resource manager, role and Key scope. Global metadata
and selected-environment resources have separate descriptors. A view being
implemented does not mean the current account is authorized: capabilities
report `requires-server-check` and the actual request decides. Authentication
configuration, webhook and terminal/log workflows remain pending. MFA/passkey
ceremonies use the existing human flow. Typed audit queries use the matching
Engine/broker owner; raw audit payloads and export remain human-only. Catalog
metadata and its bounded launch adapter are described below. No tool accepts raw IDs,
URLs, HTTP methods or caller-selected output fields.

### Service upgrade completion and rollback

For ordinary `resourceType: "service"`, use `preview_resource_change` with one
of the operations below and `parameters: {}`. The same human confirmation,
`apply_resource_change` and `get_operation` flow applies. The native owner,
current Key upgrade ceiling and captured upgrade generation still decide access.

| Operation | Required native phase | Verified checkpoint |
| --- | --- | --- |
| `finish_upgrade` | `upgraded` | `active` |
| `rollback` | `upgrading`, `upgraded` or `canceled-upgrade` | `active` |
| `cancel_upgrade` | `upgrading` or `finishing-upgrade` | `canceled-upgrade` |

The model supplies no image, strategy, action URL or configuration. Finish and
rollback wait for the native process and actual configuration/instance retirement
readback. A cancel receipt verifies cancellation only; it does not finish an
upgrade or rollback. `cancel_rollback` is unavailable because there is no native
capability. Keep an accepted, running or unknown operation and read its receipt;
do not reapply it. The existing dedicated image-upgrade flow remains separate.

### Project and load-balancer metadata

`preview_resource_change` accepts only `name` and `description` for the currently
selected Project or a load balancer. Project editing requires an opaque reference
to that selected environment; switch normally and search again for another one.
Load-balancer metadata uses the existing Service owner and requires readable
Stack context. Neither path authorizes members/network/auth changes, load-balancer
configuration, ports, certificates, backend links, scale or lifecycle actions.

Before permanently renaming a Project through stdio, use the explicit
[Bridge profile setup](../bridge/README.md) to create a new bound private profile.
The human chooses a name/description; internal IDs and opaque UUIDs are captured
and revalidated automatically. Existing profiles keep their query and description
behavior. Client-reported setup diagnostics remain clearly labeled as reports,
not backend authorization decisions; the platform audit detail requires the
matching Server broker projection. Publication and source tests are distinct
from the designated runtime cases.

### Service create ports and health checks

Choose the intended Stack's opaque `parentRef`, then preview
`resourceType: "service"`, `operation: "create"` with its name, image and optional settings.
`ports` is an array of at most 64 native PortSpec strings, each 1 through 128
UTF-16 units, for example `["8080:80/tcp", "53:53/udp", "80/tcp"]`. An omitted
public port, including bare `80` or `80/tcp`, requests native random public-port
allocation. Native IPv4/IPv6 bindings and port validation remain server-owned;
do not convert these strings into port objects. CR, LF and NUL are rejected.
`[]` publishes no ports.

`healthCheck` requires container `port` (1 through 65535). Its optional fields are
`requestLine`, `responseTimeout`, `interval`, `healthyThreshold`,
`unhealthyThreshold`, `initializingTimeout`, `reinitializingTimeout` and
`strategy`. Omit or use an empty request line for TCP; an HTTP example is
`GET /health HTTP/1.0`. The request line is at most 1024 UTF-16 units and rejects
CR, LF and NUL. Timings use milliseconds and thresholds count checks.
The integer maximum is 2147483647; initialization timeouts may be zero and the
other timing/threshold values must be positive. Strategy is `none` or `recreate`
(the native default). Omit `healthCheck` for no check. Null, extra headers,
credentials and quorum strategy configuration are not accepted.

The service uses `networkMode: "bridge"` and `startOnCreate: false`; start it
with a separate approved plan. Existing Service settings use the normal upgrade
workflow. Human review shows port strings unchanged and health-check labels
with their units. Approval is invalid if those reviewed settings change.
After apply, use `get_operation` until success is verified. Only a verified
successful Service create may return read-only `executionResult.assignedPorts`;
those native assignments are shown separately and never amend the approved
`changes`. An accepted or unknown result is not completion.

## Browser and human controls

Build with `WEBMCP_MODE=read-only` or `WEBMCP_MODE=enabled` to include the
collaboration controls and set their capability ceiling. Every new page starts
with tools off. The user must explicitly choose read-only or enabled in the
header's AI collaboration panel; a read-only build cannot enable write tools.
The choice is not saved across page loads. An off build omits this integration.
The release producer forwards the selected ceiling into its isolated build and
records it with `initialMode: off` in `webmcp-build.json` and the matching release
sidecar. Both the producer and workflow default to an off ceiling.

The compatible Engine must separately enable `api.ai.service.upgrade.enabled`
for dedicated image-upgrade plans. Its default remains false.
The new resource-change plans independently require
`api.ai.resource.change.enabled=true`; that flag also defaults to false.

Native tools require a secure context and `document.modelContext`. Unsupported
browsers keep the ordinary console and, in an enabled build, human plan review;
they do not receive a pretend native implementation. Browser tools use the
signed-in user's normal cookie permissions, not a separately limited AI grant.

Turning tools off unregisters them. It does not log the user out, silently enable
tools for a review, cancel an accepted operation, or remove authorized review of
a pending plan.

The inbox separately offers **Cancel plan** for an unsubmitted plan, including
one already approved but not applied. Cancellation uses the signed-in human
account, revokes the plan and requires a separate confirmation. **Close** only
closes the dialog. Accepted, dispatching, running and uncertain operations cannot
be cancelled through this entry. A lost cancellation response requires refreshing
the authorized inbox; it is not proof that cancellation succeeded. The bridge
has no confirm or cancel tool.

## Dedicated Key bridge

The [stdio MCP bridge](../bridge/README.md) uses the same command implementation
without browser cookies. Enable `api.ai.bridge.enabled` on the compatible
Engine, then create an **AI collaboration bridge** Key in the existing editor.
Choose expiry and policy there. The owner's current role remains the ceiling.

This Key purpose additionally limits requests to the implemented safe resource
views, existing project/stack/service reads, description updates, typed plans
the fixed typed audit-query route and tool-audit routes. It cannot
approve a plan, manage Keys, log in, execute commands or call arbitrary APIs.
The bridge refuses general-purpose Keys. Purpose and revision come from the
server's authenticated Key context, not a client assertion. A policy change
invalidates the running bridge before another mutation; review the policy and
restart it. Expiry and revocation continue to apply.

A default-deny policy also needs a **read rule for the selected environment
resource itself** so the bridge can resolve its name. Use an exact environment
resource rule, not a whole-environment scope if other stacks must stay hidden.
Add separate Stack/service rules for the intended workload. The exact environment
rule does not grant read access to its stacks or services.

The owner opens that environment, refreshes pending plans, reviews target and
image, and approves the plan in the console. The AI can then apply that same
plan, including when the owner's browser lacks native WebMCP support. This
requires a console built with a read-only or enabled ceiling; its browser tools
can remain off throughout human review. `api.ai.bridge.enabled` remains false
until the operator explicitly enables the bridge on the Engine.

## Audit and scope

Start/result events use the existing server audit sink. Business mutations also
use existing authorization and resource audit paths. Client-reported tool
success is not proof of a completed mutation. Credentials, descriptions and full
launch configurations are not included in tool-audit payloads.

Only descriptor-listed lifecycle operations are implemented. Arbitrary execution,
policy editing, authentication/MFA automation, host/volume mutations and
third-party pages remain outside this tool batch. A pending family is unfinished
coverage, not a claim that its entire normal UI requires manual operation.

## Development checks

For the resource-family and lifecycle changes, run
`node --test scripts/test-webmcp-resources.mjs`,
`node scripts/test-ai-collaboration-ui.js --filter="resource plan"`, and
`node --test --test-name-pattern="bounded stdio create arrays" bridge/test/stdio.test.mjs`.
For the Service create extension, also run
`node --test scripts/test-webmcp-service-create.mjs`,
`node scripts/test-ai-collaboration-ui.js --filter="service create"` and
`node --test scripts/test-ai-resource-review-labels.mjs`.
The stdio request frame is bounded at 256 KiB; the platform HTTP response body
has a separate 1 MiB limit. Oversize failures never print request payloads.

Run `node scripts/test-webmcp-commands.js`,
`node scripts/test-ai-collaboration-ui.js`, and `npm test` in `bridge/`, using
the [supported toolchain](../COMPATIBILITY.md).

Real acceptance also requires the Engine and browser: description conflicts,
duplicate targets, human approval, Key revision/revocation, role/resource
boundaries, audit records and verified upgrade results. Record model tool
selection, arguments and business outcomes separately. Mock transport tests
alone are not end-to-end acceptance.

When assembling a release from both source checkouts, run
`node scripts/check-webmcp-engine-contract.mjs --engine-root /path/to/engine`.
It checks that every tool can pass the Engine's audit enum and that all three
role overlays expose the command inputs. A component unit test alone cannot
prove those wire contracts agree.

## Published Catalog and Archive adapters

[Web Console 1.6.200 and bridge 0.2.2](releases/web-console-1.6.200.md) add named
Catalog template/version/options and human-reviewed new Compose Stack launch
through the matching Engine/Compose owners. Destination read/create/update are
required; create does not imply the other operations. Secrets stay in the human
input surface, not model parameters. Unsupported external-volume and other
advanced Catalog forms remain pending.

Archive/restore is limited to eligible fully stopped Stack/Service resources.
Review mounted-directory data; restoration does not start a workload. Permissions
and audit remain authoritative. Background authorization denial is shown through
the existing alert, retains the original failed receipt, warns about partial
changes and must not cause a blind retry.

Required component CI, published archive/SBOM verification and the standalone
ZIP's clean install/48 focused adapter and SDK cases passed. Every new console
page still starts with browser tools off and needs explicit opt-in. Combined
Server and designated Catalog/Archive browser, role and weak-model acceptance
remain **PENDING**. The published 1.6.200 overlay recorded 54 partially implemented source groups;
that historical count does not establish acceptance of all 243 business groups.

## Published client adapters for External Service, DNS Alias and audit

In 1.6.201 / bridge 0.2.3, External Service creation requires a selected Stack
reference and exactly one hostname/IP mode. Creation is stopped; start and
target updates need their own reviewed plans. DNS Alias creation is empty and
stopped. Read the resulting Service reference, select local target references,
then preview and approve update_targets separately. Advanced/remote links and
incoming-consumer/cross-source cleanup remain unsupported.

For audit metadata use find_resources with family audit, resourceType auditLog
and typed auditFilters. Do not combine these with name query or parentRef.
Select Key/environment filters through their returned opaque references. Browser
and stdio use the matching fixed Engine/broker owner; current actor/Key policy
and revision are checked for every source page. A result-set-too-large response
requires a narrower range or environment; it is not an empty successful result.
Raw request/response payloads and export remain in the normal human audit UI.

Web 1.6.202 component CI/CodeQL, archive/SBOM qualification, actual source-ZIP
installation and anonymous verification of all 13 published assets passed.
Matching Engine 0.183.361 / next Server qualification, combined runtime and
designated role/cross-ID, layout and weak-model workflows remain pending.
The designated prior QA deployment remains Server `v1.6.560` / Web `1.6.201`;
its baseline health does not establish acceptance of the new workflows.
These component results do not complete the full 243-group frontend inventory.
