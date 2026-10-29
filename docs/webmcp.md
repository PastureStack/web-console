# Experimental AI collaboration

AI collaboration is optional and disabled by default. Typed tools operate
in a selected environment; this is not an HTTP, shell or JavaScript proxy.
Ordinary console actions and general-purpose Keys retain their existing behavior.

## Tools and workflow

The current source adds the five resource-family tools below to the seven
tools released in Web Console 1.6.197. These extensions require a matching
Engine; source and focused tests are not live acceptance or a published release.

| Tool | Purpose |
| --- | --- |
| `list_capabilities` | List 25 UI families, typed resources, read scope and explicit implemented/pending/human-ceremony coverage. |
| `find_resources` | Find safe resource metadata, preserving duplicate candidates and parent/cursor scope. |
| `get_resource` | Read safe metadata using an opaque reference; report any truncated fields explicitly. |
| `preview_resource_change` | Preview a supported stack, service or container lifecycle change for human review. |
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
listed name, description, image, scale and create-time command/entryPoint fields,
never arbitrary launch configuration. Command arrays allow at most 64 strings,
4096 UTF-16 units per string and 16384 in total; NUL is rejected. The human review
shows their actual escaped JSON, including empty and null values.

Generic stdio reads go through the Engine's safe `aiResourceViews` projection,
which rechecks the normal resource manager, role and Key scope. Global metadata
and selected-environment resources have separate descriptors. A view being
implemented does not mean the current account is authorized: capabilities
report `requires-server-check` and the actual request decides. Authentication
configuration, catalog, webhook and log adapters remain explicitly pending;
MFA/passkey ceremonies use the existing human flow. Engine audit metadata does
not claim to cover the UI's aggregated audit broker. No tool accepts raw IDs,
URLs, HTTP methods or caller-selected output fields.

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
for upgrade plans. Its default remains false.
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
and tool-audit routes. It cannot
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
remain **PENDING**. The current 54 partially implemented source groups do not
establish acceptance of all 243 business groups.
