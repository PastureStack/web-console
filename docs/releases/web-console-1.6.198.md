# Web Console 1.6.198

Required CI, immutable artifact verification and live resource-flow acceptance
are separate gates. Exact producer and deployment evidence are recorded with
the release assets and acceptance report. Earlier published artifacts remain
immutable.

The five added tools are `list_capabilities`, `find_resources`, `get_resource`,
`preview_resource_change` and `apply_resource_change`. They share the existing
session, role, scoped reference, audit and verified-operation boundaries with
the original seven tools. The family registry distinguishes implemented safe
metadata, partial coverage, pending adapters and human security ceremonies.
Generic stdio reads use server-safe views rather than direct secret-bearing APIs.

The first lifecycle batch supports Stack start/stop/remove/create and metadata;
Service start/stop/restart/remove/scale/create and metadata; and Container
start/stop/restart/remove/create and metadata. A human approves the exact typed
plan in the console before apply. Create-time command and entrypoint arrays are
bounded and shown as complete escaped JSON. Workloads are created stopped.
The review explains child effects, affected counts and the existing domain's
mounted-data rules without promising blanket data retention.

The inbox provides a separate human-only action to cancel unused, unsubmitted
plans. Closing a dialog does not cancel a plan. Submitted operations cannot be
cancelled here. Quota errors point to this action or expiry rather than creating
more plans; a busy target points to an existing active operation when known.

The existing off/read-only/enabled build ceiling and initial off mode remain.
The Engine's separate `api.ai.resource.change.enabled` flag defaults to false.
Ordinary UI actions, sign-in and general API Keys retain their current paths.
Bridge 0.2.0 is a new source-artifact identity; it does not replace the immutable
0.1.0 ZIP. The dependency graph is unchanged by these version metadata updates.

Focused source tests cover the new contracts, typed parameters, opaque handles,
permission boundaries, uncertainty/recovery, human inbox and thirteen-locale
review formatting. They do not stand in for the remaining live candidate,
role/cross-ID checks, full permission matrix or broader console coverage.
