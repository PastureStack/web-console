# Experimental AI collaboration

AI collaboration is optional and disabled by default. Seven typed tools operate
in a selected environment; this is not an HTTP, shell or JavaScript proxy.
Ordinary console actions and general-purpose Keys retain their existing behavior.

## Tools and workflow

| Tool | Purpose |
| --- | --- |
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

Native tools require a secure context and `document.modelContext`. Unsupported
browsers keep the ordinary console and, in an enabled build, human plan review;
they do not receive a pretend native implementation. Browser tools use the
signed-in user's normal cookie permissions, not a separately limited AI grant.

Turning tools off unregisters them. It does not log the user out, silently enable
tools for a review, cancel an accepted operation, or remove authorized review of
a pending plan.

## Dedicated Key bridge

The [stdio MCP bridge](../bridge/README.md) uses the same command implementation
without browser cookies. Enable `api.ai.bridge.enabled` on the compatible
Engine, then create an **AI collaboration bridge** Key in the existing editor.
Choose expiry and policy there. The owner's current role remains the ceiling.

This Key purpose additionally limits requests to implemented project/stack/
service reads, description updates, plans and tool-audit routes. It cannot
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

Resource deletion, arbitrary execution, policy editing, authentication/MFA
automation, host/container/volume management and third-party pages are not
offered as tools. They remain normal console/API features.

## Development checks

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
