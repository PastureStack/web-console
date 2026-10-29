# PastureStack stdio bridge

This optional MCP server exposes the seven typed tools in the Web Console
command layer. It needs a compatible Engine with `api.ai.bridge.enabled=true`,
a dedicated **AI collaboration bridge** Key and the parent repository's supported
Node.js toolchain. It cannot approve its own upgrade plans.

Human approval needs a compatible Web Console built with a `read-only` or
`enabled` WebMCP capability ceiling. Every new console page starts with browser
tools off; the owner can review bridge plans without enabling them or having
native browser support. The operator must separately opt in to
`api.ai.bridge.enabled` and, for upgrade plans, `api.ai.service.upgrade.enabled`;
both Engine flags default to false.

The standalone source release is `pasturestack-webmcp-bridge-0.1.0.zip` with a
`.zip.sha256` checksum. Extract the whole archive, keeping both `bridge/` and
`app/utils/`; the bridge uses those exact shared command sources. With Node.js
24.22.1 available, install from the extracted directory:

```sh
cd pasturestack-webmcp-bridge-0.1.0/bridge
npm ci
```

Its MCP entry point is the extracted `bridge/server.mjs`. `source-manifest.json`
records the included source hashes; the root also includes LICENSE and the
bridge CycloneDX SBOM. To reproduce the source release from a checkout:

```sh
python scripts/package-webmcp-bridge.py --version 0.1.0 --sbom /path/to/webmcp-bridge.cdx.json --output /path/to/pasturestack-webmcp-bridge-0.1.0.zip
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

The bridge verifies authenticated server Key metadata, pins the policy revision
and sends that revision on later calls. The backend rejects an outdated revision
before writing. Restart only after reviewing a policy change; do not substitute
a general-purpose Key to bypass a denial.

Find the service and preview the image. The owner reviews and approves the plan
in the console's AI collaboration panel; the model applies that plan and reads
its operation until `verifiedResult=true`. On uncertain results, inspect that
operation instead of automatically submitting again.

Run `npm test` for transport, credential-boundary and SDK stdio tests. Live
client and server acceptance is recorded separately.
