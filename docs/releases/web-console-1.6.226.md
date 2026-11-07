# Web Console 1.6.226 / Bridge 0.2.28 source candidate

The existing twelve tools add named ordinary-Service dependency links and an
External Service create HTTP request line. Engine 0.183.386 or newer and a newly
qualified matching Server assembly are required. This is candidate documentation;
normal CI, immutable publication and native acceptance are pending.

`service/update_links` accepts exactly one complete replacement:
`parameters.serviceRefs` (legacy plain links) or
`parameters.links: [{serviceRef, name}]`. Each permits at most sixteen entries;
`[]` clears the set. References remain query-issued and opaque. Alias text uses
the native name grammar, preserving case without trimming. Null/empty names are
plain links; uniqueness is the exact target/name pair. The same alias on different
targets and different aliases on one target retain their native meaning. Review
uses authoritative Stack/service paths and aliases, with canonical pair order;
input order is not an authorization or identity signal.

External Service create adds only `healthCheck.requestLine`, following the
ordinary-Service string bound of 0..1024 characters with NUL/CR/LF rejected.
Omission or an empty string selects TCP. Existing port, timing and threshold
rules remain; whole-healthCheck null, URLs, headers, credentials, arbitrary
strategy and health-check updates are not added. Creation stays stopped and
configuration verification does not establish live HTTP health behavior.

Confirmation and apply re-read the complete Service-link review before dispatch,
including aliases; changed or omitted aliases fail closed. Human approval,
source/target UUID and full-edge CAS, current native role/Key authority, audit and
normal completion remain mandatory. No new tool, native grant, locale key or
runtime dependency is added. Unsupported or hidden targets do not trigger raw-ID
fallback, policy expansion or an alternate mutation route.

The source delta declares six new focused methods and affects seven existing
methods in the two already registered owning scripts. Earlier local selected
source results remain scoped evidence; the assembled candidate must run its own
selected checks. Full CI browser/focused counts, original artifact/provenance,
SBOM/source closure, real Bridge0.2.28 SDK handshake and matching Engine386 proof
remain pending and cannot borrow published225 qualification. The source ZIP
allowlist remains 59 sources (including the existing two test scripts); its normal
manifest/SBOM/ZIP checks are retained. SDK1.32.2 and the 92-component dependency
graph are unchanged, without a new install or scan claim.

Native named add/rename/remove/plain/clear, complete configuration preservation,
role/Key/cross-ID/CAS, weak-model behavior and HTTP unhealthy/recovery acceptance
remain pending. Coverage remains partial; this is not all 243 frontend groups.
