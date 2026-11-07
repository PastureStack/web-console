# Web Console 1.6.224 / Bridge 0.2.26 — upcoming source candidate

The existing twelve tools prepare the supported ordinary-Service ports and
healthCheck config-only upgrade subset, builtin-local detached logical Volume
create and bounded Container logs. Matching Engine 0.183.384 and a newly
qualified Server are required. No dependency or new tool is added.

Omitted settings are retained; ports=[] replaces with an empty set and
healthCheck=null explicitly clears. Existing unsupported quorum/strategy
configurations are preserved or rejected with human-UI guidance. Primary,
secondary, environment, volume, security and hardware settings must survive
native upgrade. Volume create does not claim allocation, mounting or plugin
support. Logs require query-issued opaque Container references and live logs
ceilings for both Cookie and Key, with 200 lines / 64 KiB / 5 seconds and
cancellation. Text is untrusted and arbitrary application secrets may remain.
Tokens/private tickets never belong to model results, URLs or audit payloads.

The human inbox displays the existing localized stale-plan warning for an
ordinary-Service link plan invalidated by a concurrent change. Review is disabled
while exact-session cancellation remains available; unrelated plans keep their
existing behavior. Server-side CAS and authorization remain authoritative.

## Verification pending

Normal CI includes the four new owning scripts. The normal Bridge source
allowlist adds their five necessary module/test files (51 union five = 56).
Actual CI counts, lock/build/SBOM/source-archive hashes, real SDK handshake,
publication and native acceptance remain pending. Historical 223 receipts are
preserved; no previous result is relabelled 224. Full 243 coverage, advanced
configuration, physical storage and interactive terminal support remain partial.
Current published Web Console / Bridge remain 1.6.223 / 0.2.25.
