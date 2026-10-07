# Web Console 1.6.180 — audit all-time query contract

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
Publication uses the existing exact-source validation workflow, Chrome tests
and two byte-identical production archives. The release records the actual CI
and archive checksum after they succeed; this note is not test evidence.

Dependencies, authentication/session protections, permissions, HAProxy and
retention settings are unchanged. Component CI, isolated deployed browser
acceptance and company production deployment are separate results. Historical
HOLDs and the incomplete full permission matrix are not promoted by this fix.
