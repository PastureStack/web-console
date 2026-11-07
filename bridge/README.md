# PastureStack stdio bridge

This optional MCP server exposes the typed tools in the Web Console
command layer. It needs a compatible Engine with `api.ai.bridge.enabled=true`,
a dedicated **AI collaboration bridge** Key and the parent repository's supported
Node.js toolchain. It cannot approve its own change plans.

## Release identity and support

[Bridge **0.2.25** / Web Console **1.6.223**](https://github.com/PastureStack/web-console/releases/tag/1.6.223)
is published and requires matching Engine **0.183.383** or newer in a qualified
Server assembly. The release includes the source archive and SBOM, immutable
asset verification and one new real SDK stdio handshake. The unchanged dependency
graph retains its original clean-install evidence. Component publication does
not establish complete platform-native workflow acceptance.

Project metadata plans support name/description only for the selected
environment. Editing another visible environment requires a normal context
switch and a fresh resource reference; membership, networking, authentication
and lifecycle changes remain in their normal human workflows.

The twelve shared typed tools support resource discovery, safe metadata reads
and human-reviewed lifecycle plans. Host plans support only name/description;
infrastructure, evacuation and deactivation stay in normal human workflows.
Host detail shows at most fifty freshly readable container references. Host and
Volume detail can include a separately authorized Stack name, including native
Service containers whose direct Stack field is absent. Ambiguous or unreadable
relations remain unknown; hidden identities and counts are not returned. Empty
references never prove an empty Host, unused storage or safe removal.

`find_services` accepts an opaque `stackRef` from `find_stacks`, never a name or
raw ID. Search by query without `stackRef` and compare returned Stack names, or
look up a fresh Stack reference first. Ref validity and native permissions remain
unchanged.

Optional image-upgrade settings remain bound to the exact human review.
The bridge cannot approve its own plans. Native owner, role, Key and revision
checks remain authoritative, and unsupported capabilities stay unavailable.

For an ordinary Service, `preview_resource_change` accepts `operation: "update_links"`
with `parameters: {serviceRefs: [...]}`. Select fresh generic `resourceRef` values
from `find_resources` or an authorized Stack graph, compare complete Stack/name
paths, and approve the exact before/after target set. An empty array explicitly
clears simple links. Named, port-qualified, remote or incomplete links remain
unsupported. Graph completeness stays unknown; the native server checks the
complete write snapshot and rejects concurrent changes.

For a Registry, only separately approved `start` and `stop` with empty parameters
are supported. Select its fresh same-session `resourceRef` by a known safe
`serverAddress`; unknown or unsafe addresses cannot authorize a preview. Registry
credentials, create/remove and arbitrary storage-pool edits remain human workflows.

For an ordinary Service, the existing resource-change flow also offers
`finish_upgrade`, `rollback` and `cancel_upgrade` with `parameters: {}` only.
Use the same opaque reference, human review and operation receipt. Native phase,
owner, Key upgrade ceiling and private generation checks remain in the Engine.
A successful cancel receipt proves its cancellation checkpoint, not a completed
upgrade or rollback. `cancel_rollback` remains unsupported.

For Service and load-balancer metadata, `get_resource` includes the same opaque
Stack relationship reference as discovery. Use `get_resource(parentRef)` to read
the current authorized Stack name before choosing a same-name resource. Parent
resolution stays unavailable when the name cannot be read; possessing a reference
does not grant parent access. No Stack name is inferred from a display path.

External Services require an authorized Stack reference and exactly one target
mode (hostname or IPs). DNS Aliases are created stopped and empty; target binding
uses selected Service references in a separate approved plan. Typed audit queries
use the matching Engine and broker owner, current Key scope and pinned revision.
Private audit payloads remain in the human UI. Certificate plans support only
name and description; PEM, private keys, chains, renewal and removal stay in the
normal human certificate UI. A matching version does not establish workflow acceptance; use the release's
recorded validation results and documented operation limits.

The Catalog source adapter also needs a matching Engine/Catalog typed metadata
endpoint. Use `find_resources` with `family: "catalog"` and
`resourceType: "catalogTemplate"` to find a named template. Keep all same-name
candidates until the user identifies the catalog scope and templateKey. Then list
`catalogTemplateVersion` with that template's opaque `resourceRef` as `parentRef`
and no `query`; use `get_resource` on the chosen version reference. No raw
template ID, URL, proxy, template files, answers or credentials enter this flow.
The configured default and version bounds are metadata, not a compatibility
decision. Supported typed templates can be previewed for launch; human-only
answers and approval use the normal console. Unsupported templates remain
unavailable to these tools.
Catalog access is checked by the server against the current actor and Key
policy; unsupported fine-grained selectors fail closed and must not trigger
automatic policy expansion.

Human approval needs a compatible Web Console built with a `read-only` or
`enabled` WebMCP capability ceiling. Every new console page starts with browser
tools off; the owner can review bridge plans without enabling them or having
native browser support. The operator must separately opt in to
`api.ai.bridge.enabled` and, for dedicated image-upgrade plans,
`api.ai.service.upgrade.enabled`. Resource-change plans independently require
`api.ai.resource.change.enabled=true`. These Engine flags default to false.

## Install the matching release

Use the immutable release matching the source versions below. Confirm its GitHub
release and qualification metadata before downloading. This source requires
Engine **0.183.383** or a later explicitly qualified compatible assembly. Earlier
Engines do not provide the complete ordinary-Service link replacement and Registry
lifecycle contracts used by these source adapters.
Download the matching numeric release and checksum, verify it, then extract.
Keep both `bridge/` and `app/utils/`: they contain the exact shared command
sources. Node.js 24.22.1 and a qualified compatible Server assembly are required.
The current repository README is authoritative for installation; an immutable
downloaded archive preserves its packaging-time README snapshot. Component
publication does not establish native workflow acceptance.

This checkout prepares Web Console 1.6.223 / Bridge 0.2.25. These candidate assets
are not published. The source-version block below is for packaging and use after
that matching release is published; continue using the published 1.6.222 / 0.2.24
baseline until then. Normal CI and native acceptance remain pending.

```sh
WEB_CONSOLE_VERSION=1.6.223
BRIDGE_VERSION=0.2.25
curl --fail --location --remote-name "https://github.com/PastureStack/web-console/releases/download/${WEB_CONSOLE_VERSION}/pasturestack-webmcp-bridge-${BRIDGE_VERSION}.zip"
curl --fail --location --remote-name "https://github.com/PastureStack/web-console/releases/download/${WEB_CONSOLE_VERSION}/pasturestack-webmcp-bridge-${BRIDGE_VERSION}.zip.sha256"
sha256sum --check "pasturestack-webmcp-bridge-${BRIDGE_VERSION}.zip.sha256"
unzip "pasturestack-webmcp-bridge-${BRIDGE_VERSION}.zip"
cd "pasturestack-webmcp-bridge-${BRIDGE_VERSION}/bridge"
npm ci --ignore-scripts --no-audit --no-fund
```

The MCP entry point is the extracted `bridge/server.mjs`.
`source-manifest.json` records included source hashes; the archive also includes
LICENSE and the bridge CycloneDX SBOM. The matching GitHub release's metadata
and source proof record the exact producer, tested tree, dependency evidence
and SDK handshake. Use those release records rather than a producer hash or
validation claim copied into this README. Dependency installation, source tests,
artifact authenticity and designated native workflow acceptance are separate
evidence; a version bump does not establish any of them.

For local packaging from a repository checkout, provide the matching SBOM:

```sh
python scripts/package-webmcp-bridge.py --sbom /path/to/webmcp-bridge.cdx.json --output /path/to/bridge.zip
```

Store the following configuration outside the extracted source tree in a private
local file readable only by the operating-system account running the client:

```json
{
  "endpoint": "https://platform.example.com",
  "environment": "My environment",
  "accessKey": "REPLACE_WITH_DEDICATED_KEY_ACCESS_VALUE",
  "secretKey": "REPLACE_WITH_DEDICATED_KEY_SECRET"
}
```

The exact environment name must identify one visible active environment. A
default-deny Key needs an exact read rule for that environment resource as well
as separate rules for allowed workloads. An environment-resource rule does not
grant access to all stacks. Do not put credentials in prompts, command-line
arguments, repository files or URLs. HTTPS is required except for loopback tests.

To allow this bridge to rename its selected environment permanently, first
create a stable-bound profile using the explicit local writer:

Use Node.js 24.22.1. Quote each path; the following examples work with spaces
in private profile paths. In a POSIX shell:

```sh
node "/absolute/path/to/bridge/bind-profile.mjs" --from "/private/path/Existing profile.json" --output "/private/path/New bound profile.json"
```

In Windows PowerShell, use the installed Node.js 24.22.1 executable:

```powershell
& "C:\path\to\node.exe" "C:\path\to\bridge\bind-profile.mjs" --from "C:\private\Existing profile.json" --output "C:\private\New bound profile.json"
```

The writer uses the human environment name already in the input profile. It
verifies the dedicated Key's current visibility and captures the exact server
identity. Choose by the displayed environment name and description, not by an
internal ID or UUID. If the name is shared, an interactive terminal can select
by friendly description and creation date; indistinguishable or noninteractive ambiguity
fails without choosing the first result. Enter or `q` cancels without writing.
There are no ID, UUID, credential or force arguments. The output must be a new
file; existing and read-only input profiles are never changed. The new private
file contains the existing credentials and only an additional closed
`environmentBinding` with the normalized endpoint, internal ID and opaque
server UUID. Do not construct that binding from model output.

Both legacy profile startup and the writer use the normal native `all=true`
Project listing, including private environments visible to a native administrator
who is not a member. This query does not grant access: the Key remains limited by
its current policy and the account's live permissions. Missing and same-name
ambiguous environments still fail without selecting a target.

Change your MCP client's `PASTURESTACK_BRIDGE_CONFIG` to the new private profile
and reconnect normally. The legacy four-field profile remains supported, but
stdio name changes require this explicit binding. Existing discovery, reads,
description-only changes and unchanged names can keep the legacy profile. A bound bridge verifies the same visible active server
identity after every restart and uses its current name. A hidden, replaced or
endpoint-mismatched target fails closed, without falling back to another
environment with the old name. No sidecar is created and no profile is updated
automatically. New processes need fresh opaque references; never reuse old
references or treat a same-process restore as proof of restart behavior.
After a verified Project metadata operation, one bounded native read updates
the in-memory environment label without changing the session generation or
invalidating current references. It never copies a name from tool arguments or
a plan label. A transient label-read failure preserves the verified operation
receipt; the next command gets one read-only recovery attempt before business
dispatch. If that read still fails, retry the read later, not the mutation.
Authorization, policy-revision and identity failures remain closed.

Start `node /absolute/path/to/bridge/server.mjs` with
`PASTURESTACK_BRIDGE_CONFIG` pointing to the private file. stdout is exclusively
MCP; bounded startup errors go to stderr without credentials.

For Claude Code, use this local `.mcp.json` entry with your actual paths:

```json
{
  "mcpServers": {
    "pasturestack": {
      "type": "stdio",
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/bridge/server.mjs"],
      "env": {"PASTURESTACK_BRIDGE_CONFIG": "/private/path/bridge.json"}
    }
  }
}
```

Codex uses the equivalent `[mcp_servers.pasturestack]` entry with `command`,
`args` and `env.PASTURESTACK_BRIDGE_CONFIG`. Keep the credential file local.
Client tool approvals do not replace PastureStack's human upgrade approval.

Create-time `command` and `entryPoint` are bounded string arrays and are shown
as exact JSON in human review. Stdio request framing is limited to 256 KiB;
platform HTTP responses have a separate 1 MiB bound. Oversize input is rejected
without printing its contents. Neither limit authorizes arbitrary HTTP or shell
execution.

The bridge verifies authenticated server Key metadata, pins the policy revision
and sends that revision on later calls. The backend rejects an outdated revision
before writing. Restart only after reviewing a policy change; do not substitute
a general-purpose Key to bypass a denial.

Find the service and preview the image. The owner reviews and approves the plan
in the console's AI collaboration panel; the model applies that plan and reads
its operation until `verifiedResult=true`. On uncertain results, inspect that
operation instead of automatically submitting again.

Catalog lookup uses the fixed metadata adapter: select a named template by its
scope, catalog and template key, then select an exact version with its returned
opaque reference. Reading that version also returns safe launch questions.
Question defaults, rendered files and secret answers are never returned to the
model. Use `preview_resource_change` with `resourceType: "stack"`,
`operation: "create_from_catalog"`, the selected `catalogVersionRef`, and typed
answers using `questionRef` or authorized `resourceRef` values. The owner fills
any human-only fields and approves the exact plan in the ordinary console.
The bridge cannot complete human inputs, confirm or cancel a plan; it can apply
the approved plan and observe the same durable operation. Catalog source and
input snapshots are checked by the server again before dispatch.
The safe options metadata lists the required target-scope `read`, `create` and
`update` permissions: launch reads the created resources, configures service
links and may activate services. This list
does not grant permission; the server checks the current actor and Key again.
Templates that reference existing external volumes (`external: true`) are not
supported by this launch adapter and are rejected during preview. Use the normal
console for those templates. Catalog administration and upgrades also remain
outside this adapter.

Run `npm test` for transport, credential-boundary and SDK stdio tests. Live
client and server acceptance is recorded separately.
