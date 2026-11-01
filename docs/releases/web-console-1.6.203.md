# Web Console 1.6.203 / bridge 0.2.5

Source candidate; publication and designated workflow acceptance remain pending.

The shared API Key resource family now includes `apiKeyRestricted`. Both browser
WebMCP and the stdio bridge can find a restricted Key by its visible name, use
the returned opaque reference and query its authorized audit metadata. The Engine
already supports this native type; no credential manager or policy is widened.

The family remains partial. Omitting `resourceType` searches ordinary `apiKey`
resources; choose `apiKeyRestricted` for restricted Keys. The two collections are
not silently merged. A same-name match never authorizes an arbitrary target,
owner denials remain denials, and mismatched response types are rejected.

Four causal regression cases cover both transports, explicit type selection,
owner denial and incorrect response types. The two directly affected resource
and audit suites pass 39 cases. This does not establish runtime or all-frontend
acceptance. Token/MFA/session and human-confirmation protections are unchanged.

This patch requires the existing Engine 0.183.361 typed resource contract. The
matching Server also includes Engine 0.183.363, retaining ServiceIndex cleanup
and correcting External Service review before values.
Both opt-in defaults and ordinary Full/legacy API behavior remain unchanged.

## Clear confirmation errors and official dependency fix

Rejected human approvals now use the existing alert style with a clear account/Key
permission message in all thirteen locales. Conflict, changed-session and stale
references prompt a new preview. Unknown failures remain generic; arbitrary server
messages and private payloads are never displayed. Authorization and the saving
lock/finally lifecycle are unchanged. Six focused cases cover the public error
contract, safe text, cleanup and actual locale parsing.

The build dependency follow-redirects is pinned to official 1.16.2 for
[CVE-2026-116689](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p). Real loopback
cases retain same-origin behavior and stop cross-realm sensitive headers from
following cross-origin redirects. The npm12 audit parser separately recognizes
lock-proven aliases and exact duplicate causes while retaining distinct advisory
source/range, raw findings and all existing High/Critical/review-expiry gates.
This is not a new vulnerability exception or a claim of zero Moderate findings.
