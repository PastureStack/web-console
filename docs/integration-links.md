# Integration link contract

Every link exposed by the web console must resolve to a maintained
PastureStack repository or to a document that exists in that repository. A
link must not be added to the interface before its target is available.

## Component repositories

| Interface component | Repository |
|---|---|
| Compatibility server | `PastureStack/server` |
| Orchestration engine | `PastureStack/orchestration-engine` |
| Web console | `PastureStack/web-console` |
| Command-line client | `PastureStack/cli` |
| Compose command-line client | `PastureStack/compose-cli` |
| Host provisioner | `PastureStack/host-provisioner` |
| Catalog templates | `PastureStack/catalog-templates` |

The keys `modalAboutComponent.cattle` and related internal identifiers remain
compatibility contracts in source code. Their visible labels are
**Orchestration Engine** and **Host Provisioner** and must not expose obsolete
component branding.

## Server documentation

The console uses `PastureStack/server/tree/main/docs` as its documentation
root. The following paths are part of the interface contract:

| Console feature | Documentation path |
|---|---|
| Host and Docker compatibility | `docs/hosts/` |
| Service concepts | `docs/services/` |
| Frequently asked questions | `docs/faqs/` |
| High availability | `docs/high-availability/` |
| Network ports | `docs/network-ports/` |
| Telemetry | `docs/telemetry/` |

Links opened in a new tab must include `rel="noopener noreferrer"`. Help and
issue-reporting links are release-blocking: when a target is renamed or moved,
update the target repository and this console in the same migration wave.

## Issue reporting and community links

The footer and Help page report Web Console defects through
`https://github.com/PastureStack/web-console/issues/new`. The generated URL may
prefill product versions, authentication mode, orchestration mode, and the
current route, but it must never include credentials, tokens, email addresses,
account names, hostnames, private addresses, or local filesystem paths. The
repository keeps a public bug-report template with the same redaction warning.

PastureStack does not currently operate a forum or Slack workspace. Those links
and their former assets must remain absent from source and built output. A new
community destination may be exposed only after the organization operates it
and this contract is updated in the same change.
