# Web Console 1.6.226 / Bridge 0.2.28

The existing twelve tools add named ordinary-Service dependency links and an
External Service create HTTP request line. Engine 0.183.386 or newer and a newly
qualified matching Server assembly are required. Component CI and immutable
publication passed. Matching Server deployment and native acceptance are pending.

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

The final producer is `2442f5a9b88f296e9305a125b52347c4c8cb097f`, with tested
tree `48ab6e4579a8d2dfb9dc6e4c54b11e93962ec114` and signed merge/tag target
`83468cb32d05e14dbf233852a46a878e8489884e`. Original CI
[42410285361](https://github.com/PastureStack/web-console/actions/runs/42410285361)
passed 1,142 browser tests and 310 focused methods, including seven new methods.
The HTTP health-check review displays the selected HTTP mode correctly.

Original archive/provenance, runtime/build SBOMs, source closure, matching
Engine386 ABI and the real Bridge0.2.28 SDK handshake passed. The source ZIP
contains 59 sources. SDK1.32.2 and the 92-component dependency graph are unchanged,
without a new install or scan claim. All thirteen
[public assets](https://github.com/PastureStack/web-console/releases/tag/1.6.226)
passed anonymous SHA256 readback; native immutable release verification covered
fourteen cryptographic subjects. The Web archive SHA256 is
`7c61ad9996701f8830eab0635e84b21dac3c2690bb01778b92058638ceadfa94`.

Native named add/rename/remove/plain/clear, complete configuration preservation,
role/Key/cross-ID/CAS, weak-model behavior and HTTP unhealthy/recovery acceptance
remain pending. Coverage remains partial; this is not all 243 frontend groups.
