# Web Console 1.6.164

SOURCE-CANDIDATE ONLY, not a published component or final Server candidate.
Based on the published `1.6.163` runtime source
`5db737a5e04c4cc15672f97296d5bf521ab9a8da` and its merged publication documents
at `7fbc755379e07e0230f1a5fb76873197924eb56a`. No archive, tag, release,
Server packaging, deployment or complete resource/role matrix PASS is claimed.

## Receiver validation labels

The shared validation-label fallback now uses `generic.name` for Receiver Name
and `newReceiver.service.label` for the scale-service target. It also reuses
the actual visible labels for required or numeric fields in the three supported
Receiver drivers. Service-upgrade batch size and interval use `formUpgrade.size`
and `formUpgrade.interval`, matching the template rather than a similarly named
unused label. The mappings are scoped to normalized Receiver/config types;
model-specific labels and direct model translations retain precedence. Unknown
fields and unrelated resources retain their original fallback.

Scale-service and scale-host retain the existing `min && max && min > max`
condition. Its hardcoded English message is replaced by the existing
`validation.number.max` translation and the visible minimum label. No new
translation keys, validation conditions, schema, API, authorization, driver
action, clone behavior or resource request changes are included. The published
`1.6.163` state-badge and relative-date fixes remain byte-for-byte unchanged.

## Focused evidence and pending acceptance

Focused local QUnit validation passed 12/12 tests and 61/61 assertions in native
Chrome `153.0.8010.53`, with zero failures, skipped tests or todos. Eight new
Receiver tests and four adjacent existing validation tests ran; this used the
existing dependency installation, not a fresh locked official CI run.
The new tests call the actual shared
`validationErrors` implementation and real scale models with the actual Intl
service and built English/Traditional Chinese translation JSON. They cover
language switching, nested driver scopes, required/numeric labels, model-label
precedence, unknown fallback and unchanged valid/boundary behavior. Adjacent
existing required-field/update-omission tests are included in the same filter.

The first local attempt had two assertion failures because its expected
scale-service amount label incorrectly bypassed the existing model-specific
translation. The fixture was corrected to retain that precedence; runtime
semantics were not changed to satisfy the test. The original failure evidence
is retained, separate from the corrected successful run.

The numeric package bump changes only package/lock root versions and directly
dependent gate version literals; dependency graphs and security thresholds are
unchanged. Full official CI, deterministic production archives and native
packaged-browser acceptance have not been run for this candidate. This does not
promote the earlier native zero-write Receiver receipt to localized-error PASS,
complete all-language acceptance or resolve the broader incomplete matrix.
Historical HOLD evidence remains HOLD.
