# Web Console 1.6.158

Server v1.6.491 API acceptance observed HTTP 403 for inaccessible Secret IDs,
HTTP 405 when a readonly user attempted Secret PUT or DELETE without the schema
method, and scoped Service direct-ID denials. Web Console 1.6.157 already hides
normal Secret Edit and Remove actions when their capabilities are absent, but a
Service direct URL or Secrets collection load could still show a raw API error.
A stale edit or delete attempt receiving HTTP 405 could also show the raw API
message instead of the selected language's explanation.

Service direct-ID and Secrets collection loads now use the existing Stack load
error pattern. HTTP 403 and 404 receive the same resource-safe unavailable
message; HTTP 5xx receives a server-failure message. HTTP 401 and network
errors remain available to their existing handlers. Save and action failures
with HTTP 405 use the existing localized unavailable messages. New load copy
is provided in English, Traditional Chinese, and Japanese; other locales use
the English base translation.

Focused Chrome 153 QUnit tests passed 7/7 for route failures, 405 save and
action messages, and three-language copy. The package version, lockfile,
reviewed lock baseline, and version-bound check scripts are pinned to 1.6.158.

The [official release](https://github.com/PastureStack/web-console/releases/tag/1.6.158)
is pinned to source commit `4c99e4803d594a6bc7c340aefc686d34e4ea0f87`.
The main validation workflow `36634695941` passed. The published
`web-console-1.6.158.tar.gz` archive and its checksum sidecar were read back
with SHA-256 `286833d3313c5bc04469a8fafd41bab7de1c4b60527f91aae9eef8a4016b17f6`;
`VERSION.txt` is `1.6.158`. This proves the archive identity, not packaged
Server or live browser acceptance; those are tracked separately.
