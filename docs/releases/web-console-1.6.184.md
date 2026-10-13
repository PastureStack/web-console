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

Upgrade or roll back through the complete Server image. Never overlay a console
bundle into a running production container.
