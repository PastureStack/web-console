# Web Console 1.6.218 / Bridge 0.2.20 candidate

Existing typed tools can show a Key's configured policy without exposing credentials or treating owner-capability previews as effective authorization. Complete native deny/rule semantics and conservative unknown results are retained; resource lists do not expand each Key's policy.

Load-balancer creation accepts the closed TCP subset: an authorized Stack reference, backend Service references, listener access and source/target ports, plus explicit startOnCreate. The review shows readable Stack/backend paths for same-name targets. HTTPS/TLS/HTTP, certificates, selectors, arbitrary configuration and scheduling are rejected. Existing load balancers gain separately reviewed start/stop with empty parameters through the shared Service lifecycle; remove, scale and upgrade are not added.

This source candidate requires matching Engine v0.183.378. It uses the existing 12 tools, opaque references, human confirmation, canonical audit and native authority paths. Bridge 0.2.20 retains the 48-path allowlist and existing dependency graph; the new source archive must be qualified from this candidate's actual producer rather than reusing immutable 0.2.19 bytes.

Normal CI and actual browser/focused totals, original artifacts, SDK qualification, immutable publication, assembled runtime and native traffic/role/weak-model acceptance remain pending. Source controls do not establish native acceptance or completion of the 243-group inventory.
