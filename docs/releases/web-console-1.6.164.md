# Web Console 1.6.164

Published immutable numeric component release, not a final Server candidate.
The signed [numeric tag](https://github.com/PastureStack/web-console/releases/tag/1.6.164)
pins validated runtime source `c3c0779d930d4d0367ec0517166ca21f6b3dc6d4`.
The normal PR147 merge `ae17bbc955522d5c78be588315115c89dbf839d8` has the same
complete tree `62ed2f12a29899fb55c5ccc6de3dc144f8310834`. Later docs-only
commits do not replace that signed tag's runtime source.

Archive SHA-256:
`734898ac6ed2fe8774e5bb947988da9720a3a65aa0bb7ec09a89420adc0acc20`.
The [archive](https://github.com/PastureStack/web-console/releases/download/1.6.164/web-console-1.6.164.tar.gz)
is 2,976,044 bytes; its [portable SHA-256 file](https://github.com/PastureStack/web-console/releases/download/1.6.164/web-console-1.6.164.tar.gz.sha256)
uses the asset basename. Both anonymous downloads match the reviewed candidate's
hash and size. The existing candidate was published without rebuilding; the
previous immutable `1.6.163` tag and release remain unchanged. No Server
packaging, QA or production deployment or complete resource/role matrix PASS
is claimed.

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
unchanged.

[Official validation 36831735186](https://github.com/PastureStack/web-console/actions/runs/36831735186)
passed 763/763 actual Chrome cases with zero failures, skips or todos, from the
exact signed source above and a fresh locked dependency installation. Its
continuous case sequence includes the eight new Receiver cases, four adjacent
existing validation cases and twelve retained Web163 locale cases. All existing
CI gates and both required PR CodeQL checks passed without threshold changes;
this is not an all-findings-zero claim. Two production archives were
byte-identical and matched the published tar.gz checksum above.

Native packaged-browser acceptance and Server/QA deployment remain separate.
Component publication does not
promote the earlier native zero-write Receiver receipt to localized-error PASS,
complete all-language acceptance or resolve the broader incomplete matrix.
Historical HOLD evidence remains HOLD.
