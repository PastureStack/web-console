# Web Console 1.6.224 / Bridge 0.2.26

## Changes and boundaries

The existing twelve tools add the ordinary-Service ports/health-check
configuration-upgrade subset, builtin-local detached logical Volume creation
and bounded Container application logs. Matching **Engine 0.183.384** is required;
no tool or dependency is added.

Omitted configuration is retained; `ports: []` clears ports and
`healthCheck: null` clears the health check. Same-image configuration upgrades
still require normal human review, complete native snapshot CAS, terminal
readback and retention of primary/secondary, environment, volume, security,
link and hardware settings. Advanced/quorum health checks and unsupported
strategy/plugin settings remain outside this subset. Logical Volume creation
does not configure a Host, allocate/mount storage or imply other-driver support.

`container_logs` returns actual application text using a query-issued opaque
Container reference and native LOGS authority, with fresh role, Key and Cookie
session checks. Metadata-read access is not logs authority. The request-bound
one-use broker ticket stays server-side; output is untrusted, completeness is
unknown and application secrets may remain. Limits are 200 lines / 64 KiB and a
five-second broker dial/read deadline with cancellation, not an end-to-end
DAO/audit latency guarantee. Audit keeps metadata only, never log text, tokens
or tickets. Existing GUI Logs and Terminal remain unchanged.

The human inbox displays the existing localized warning for an ordinary-Service
link plan invalidated by an exact concurrent CAS change. Review is disabled;
authorized same-session cancellation stays available. Unrelated plans retain
their behavior, and Engine384 preserves fresh authorization, target identity and
apply/CAS rejection. The matching Engine also corrects native LB image/cache
dependency admission; this does not establish that the TCP native matrix passed.

## Component verification

[Full CI 42358130340](https://github.com/PastureStack/web-console/actions/runs/42358130340)
and [CodeQL 42358130998](https://github.com/PastureStack/web-console/actions/runs/42358130998)
passed for producer `5a378edd498449044320bf720262779f9b84866a`, tree
`120560e9452d1c5f20eb32d0e2e56ab76652ffcc`. The original report contains
**1,142 browser tests with zero failures and 269 distinct focused identities**:
126 carried identities, 35 new identities and 108 additional affected existing
identities. The affected existing cases are not counted as new.

Original archive SLSA provenance and runtime CycloneDX SBOM attestations passed
cryptographic verification. The Bridge source closure has **56 files / 57
manifest rows / 58 ZIP entries**, with the unchanged **92-component / 95-installed-
location** dependency graph. The installed Bridge **0.2.26** passed its new
loopback MCP SDK **1.32.2** handshake. Matching Engine384 source contracts and
fresh compiled schema/artifact evidence are qualified separately; source alone
does not establish the compiled wire contract. The pinned minimatch backport
and its nine apply/verify slots remain in place.

The immutable [**1.6.224 release**](https://github.com/PastureStack/web-console/releases/tag/1.6.224)
(`437471493`) passed anonymous verification of all **13 public assets** and
native GitHub release-attestation verification of **14 cryptographic subjects**.
These publication checks are separate from the original CI provenance.

## Native acceptance and installation

The affected normal UI layouts (13 locales, light/dark and wide/narrow),
Service/Volume/logs role and Key boundaries, broker framing/cancellation and Go
runtime behavior remain pending affected native acceptance. Existing source,
unit or component PASS results do not establish full native acceptance, full
243-group coverage, advanced configuration, physical storage or interactive
terminal tooling.

Deploy through the [current qualified Server installation](https://github.com/PastureStack/server#quick-start)
with matching Engine384, Web224 and Bridge.26. Component publication alone does
not establish a Server assembly, image digest or deployment result.
