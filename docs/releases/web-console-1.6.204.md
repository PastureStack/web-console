# Web Console 1.6.204 / bridge 0.2.6 candidate

This candidate is not published. Original full/enabled CI, required CodeQL,
artifact/SBOM qualification and matching Server/native acceptance remain pending.
Published Web Console 1.6.203 / bridge 0.2.5 remains the current release.

## Clear audit-admission errors

A known authentication or Key-policy denial from audit admission previously
became a generic unavailable-integration error. The shared command engine now
preserves verified 401/403 or internal authentication/context failures so the
reply gives the correct sign-in, permission or Key-reconnection guidance.
Verified stdio revision drift retains CONTEXT_CHANGED and uses a fixed safe
ApiKeyPolicyChanged marker; it never adopts the new revision automatically.

Admission remains fail-closed. No business request runs without a verified start
ACK. Generic 409, infrastructure/network failures and invalid ACKs remain
unavailable. Context replacement takes precedence over a stale denial. A result
ACK failure after a possible write stays UNKNOWN_RESULT with its authorized
recovery reference; it does not claim rejection or submit another change.
Arbitrary error messages, detail, payloads, credentials and headers are not
projected into tool results. Browser and stdio use the same command sources.

Five new regression cases and twelve directly affected source-focused cases
passed in the isolated correction, with the original causal failures retained.
Those are source results, not new original-CI or native acceptance. The existing
CI entry point now includes the audit-focused command cases and actual bridge
core transport tests without removing any previous gate. Fresh CI totals and
artifact digests must come from that producer's actual reports.

The package/lock updates are version metadata only; dependencies and security
decisions are unchanged. Existing restricted-Key discovery, helper contracts,
pending-review layout, typed tools, Full/legacy behavior, role/Key ceilings,
current-context checks and human confirmation are retained. WebMCP remains
independently build-gated and starts off on every page.

This client correction does not complete Audit acceptance, native plan
read/apply or Member cleanup. Matching Engine/Server fixes, role/Key/cross-ID
checks and designated workflows still need their own fresh evidence. The
243-group inventory remains in progress. Consume a qualified published
component through its matching Server release; do not replace runtime files.
