# Web Console 1.6.174

Candidate only. Exact-source CI, reproducible production artifacts, signed
publication, anonymous public readback and Server packaging have not yet been
completed for this version. No VM lifecycle PASS is claimed.

## Root cause and bounded repair

The shared image form supplied `ubuntu:26.04` as a fresh VM default and offered
`ubuntu:26.04` and `alpine:3.22` as VM quick picks. These ordinary-container
choices do not establish a compatible VM boot image. The VM launch contract
passes `-m` and `-smp` and uses the `/image` boot-disk interface; merely choosing
an operating-system container image does not supply that VM runtime contract.

Remove the fresh VM default and both quick picks, without substituting another
unverified image or restricting custom image references. Preserve an existing
image and the last-used VM image. Ordinary Linux and Windows container defaults
remain unchanged. Blank image input still reaches the existing required
validation and cancels the native save lifecycle before resource persistence.

English and Traditional Chinese explain the boot-image contract and ask the
operator to verify the target host meets the image's virtualization needs,
for example KVM (`/dev/kvm`). This guidance does not add a new KVM gate or claim
that every custom VM image forbids software emulation. VM and ordinary-container
required errors are localized and react to locale changes. New messages use
the existing English fallback outside the two reviewed locales.

No VM engine, host configuration, hardware flags, API schema, payload,
authorization, MFA or resource lifecycle is changed. Dependency versions,
overrides and the installed dependency graph are unchanged; the two lock files
change only their root package version metadata to `1.6.174`.

## Verification and release boundaries

Five new real-component Ember regressions cover existing and last-used images,
blank-image save cancellation, custom VM input without misleading quick picks,
VM guidance/required-error locale changes and ordinary-container required-error
locale changes on the same form. They have not yet been executed. The expected
full test count is 817 (the previous 812 plus these five), not a verified result.
Offline method controls and syntax checks do not replace Chrome rendering,
exact-source CI or packaged native VM acceptance.

No source commit, formal run, archive checksum or publication coordinate is
asserted for this candidate. Reuse only the eventual reviewed exact-source CI
artifact for publication; do not rebuild or overwrite an older release.
The existing vendor-pending advisory and audit policy remain unchanged; this
candidate is not a zero-CVE claim.

The [published Web173 record](web-console-1.6.173.md) and its scoped results
remain historical evidence, not proof of this candidate's VM lifecycle.
Original HOLD receipts remain HOLD. The complete permission/resource/locale
matrix remains INCOMPLETE. Preserve rollback artifacts, configuration and
volumes; no company deployment is authorized by this source change.
