# Web Console 1.6.180 — audit all-time query contract

[Web Console 1.6.180](https://github.com/PastureStack/web-console/releases/tag/1.6.180)
is published with the exact retained CI archive, without rebuilding.

The audit list, automatic refresh and JSON/XLSX exports now forward
`timeScope=all` to the permission-bound console broker. Previously the URL and
visible controls said all time, but the missing API parameter caused the broker
to apply its normal 24-hour default. Retained older records therefore appeared
absent; this was not database deletion.

Explicit date bounds remain effective even if a bookmarked URL also contains
the all-time marker, and the editable date controls display those same bounds.
Unset scope retains the existing default. The backend remains authoritative for
scope/date validation, authorization, pagination and the 20,000-row scan limit.
All time means all records still retained, not recovery of expired records.
This component requires the matching broker contract in Server v1.6.518.

Focused unit regressions cover scope forwarding, default behavior, explicit
dates, invalid-scope forwarding, JSON/XLSX export and draft/query agreement.
[Exact-source CI](https://github.com/PastureStack/web-console/actions/runs/37564108185)
passed all 854 Chrome tests with zero failure, skip or todo; its two production
archives are byte-identical.

The numeric lightweight tag binds signed, GitHub-verified source
`637604b38401b19d2c9ef73d5729d356bb80c8e6`; the tag itself is not signed.
[PR #185](https://github.com/PastureStack/web-console/pull/185) merged normally
as `1c4576c2ed5fe7b5fd259f7c2ab8e6543cab13ae`, with the identical tested tree.
The published `web-console-1.6.180.tar.gz` is 2,987,644 bytes; SHA-256:
`a367bd6907281298a8e2bf0f3ad0444083db06062f3a1521db573cc5606d274e`.

Dependencies, authentication/session protections, permissions, HAProxy and
retention settings are unchanged. Component CI, isolated deployed browser
acceptance and company production deployment are separate results.
Paired Server v1.6.518 deployment QA remains pending; this release does not
claim a completed deployment.
