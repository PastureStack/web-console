# PastureStack stdio bridge

This optional MCP server exposes the typed tools in the Web Console
command layer. It needs a compatible Engine with `api.ai.bridge.enabled=true`,
a dedicated **AI collaboration bridge** Key and the parent repository's supported
Node.js toolchain. It cannot approve its own change plans.

The [0.2.4 release archive](https://github.com/PastureStack/web-console/releases/tag/1.6.202)
contains twelve typed tools for resource-family
discovery, safe metadata reads and stack/service/container lifecycle plans.
Unsupported-operation replies explain that Global services follow eligible
hosts rather than a manual instance count; they do not advise retrying the plan.
It requires a matching Engine with
`api.ai.resource.change.enabled=true` for those changes (default false). The generic
stdio read adapter uses server-side safe views, never direct credential-bearing
domain resources. Pending adapters are reported by `list_capabilities`.

External Services require an authorized Stack reference and exactly one target
mode (hostname or IPs). DNS Aliases are created stopped and empty; target binding
uses selected Service references in a separate approved plan. Typed audit queries
use the matching Engine and broker owner, current Key scope and pinned revision.
Private audit payloads remain in the human UI. Certificate plans support only
name and description; PEM, private keys, chains, renewal and removal stay in the
normal human certificate UI. These metadata changes and the typed-domain audit
integration require Engine `0.183.361` or its matching Server release. A matching
version does not establish workflow acceptance; use the release's recorded
validation results and documented operation limits.

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
`api.ai.bridge.enabled` and, for upgrade plans, `api.ai.service.upgrade.enabled`;
both Engine flags default to false.

Download the numeric release's `pasturestack-webmcp-bridge-0.2.4.zip` and its
`.zip.sha256` checksum, then verify before extraction:

```sh
curl --fail --location --remote-name https://github.com/PastureStack/web-console/releases/download/1.6.202/pasturestack-webmcp-bridge-0.2.4.zip
curl --fail --location --remote-name https://github.com/PastureStack/web-console/releases/download/1.6.202/pasturestack-webmcp-bridge-0.2.4.zip.sha256
sha256sum --check pasturestack-webmcp-bridge-0.2.4.zip.sha256
unzip pasturestack-webmcp-bridge-0.2.4.zip
```

Extract the whole archive, keeping both `bridge/` and
`app/utils/`; the bridge uses those exact shared command sources. With Node.js
24.22.1 available, install from the extracted directory:

```sh
cd pasturestack-webmcp-bridge-0.2.4/bridge
npm ci --ignore-scripts --no-audit --no-fund
```

Its MCP entry point is the extracted `bridge/server.mjs`. `source-manifest.json`
records the included source hashes; the root also includes LICENSE and the
bridge CycloneDX SBOM. To reproduce the source release from a checkout:

```sh
python scripts/package-webmcp-bridge.py --version 0.2.4 --sbom /path/to/webmcp-bridge.cdx.json --output /path/to/pasturestack-webmcp-bridge-0.2.4.zip
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
