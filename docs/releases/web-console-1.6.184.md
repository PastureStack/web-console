# Web Console 1.6.184 — Subscription audit labels

API Key audit recognizes `subscribe` as an audit-only target. Read-completion
records retain their actual cancellation, failure or denial outcome, even when
the native record has no resource ID. All thirteen production locale assets
provide a human-readable label.

No permission category, resource picker, API, stylesheet or session behavior is
changed. Unknown reasons and private backend fields retain the existing safe
fallback and allowlisted projection.

Three focused Chrome tests passed: completion display, exact-known-value safe
fallback, and actual compiled translation assets in all thirteen locales.
Existing unaffected tests were not replayed. Component tests are not assembled
Server native acceptance; use the Server component manifest for the published
pairing and its release evidence.

## Immutable publication

[Web Console 1.6.184](https://github.com/PastureStack/web-console/releases/tag/1.6.184)
is published from normally merged, signature-verified source
`c41fcf05b42f648d6a7e3859285b95c07b4dd40d` (PR #201), tree
`3de167ae07904d720606b47643ed50282b42c86d`; required checks were not bypassed.
The numeric release is immutable. Anonymous reads verified the actual archive
and portable checksum asset. `web-console-1.6.184.tar.gz` is 3,016,500 bytes,
SHA-256 `a374e6eed0ad8daec785cc3ba833e6219d46ffd23ead77d2fd720aed5d5d52f9`.

Published Server `v1.6.529` pairs this exact component with Engine `0.183.347`.
Official Server assembly, immutable readback and thirty-six focused subscription
native cases passed; isolated deployment is separately verified. Historical Web183 and
Server528 results retain their original scope, not acceptance of this pairing.

Upgrade or roll back through the complete Server image. Never overlay a console
bundle into a running production container.
