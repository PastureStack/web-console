# Web Console 1.6.174

Published immutable numeric release. Exact-source CI37152802665 passed 817/817
tests with zero failures, skips or todo, including the five direct VM-image
regressions. Signed source `d24b7f4e164f058e3ef9057347caa2080e2b5407` and both
reproducible CI archives match the anonymous public archive readback: SHA256
`6408775898f412e4b27092eeddd9cdc2028ad7b27835f489139c2d0cf62c6776`,
2,982,022 bytes. Publication reused the CI asset without rebuilding.
Server `v1.6.512` packages this component; immutable image digest
`sha256:805078de83c0320c751dff90304bd841b8e64bec720079198258d22fa41d0145`.
QA125/8080 image-form-only acceptance passed eight English/Traditional Chinese
VM/container cases, with fresh dual MFA, three Full17/14 guards and zero
resource writes. No successful VM boot or full-matrix PASS is claimed.

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
locale changes on the same form. All five passed in the verified 817-test CI run.
Offline method controls and syntax checks do not replace Chrome rendering,
exact-source CI or packaged native VM acceptance.

The published coordinates above do not establish VM runtime acceptance.
The packaged forms exposed a separate stale parent image-validation error after
the child input was corrected. That observation remains OPEN on Server512;
the unpublished Web175 source candidate has four new focused regression tests.
The existing vendor-pending advisory and audit policy remain unchanged; this
release is not a zero-CVE claim.

The [published Web173 record](web-console-1.6.173.md) and its scoped results
remain historical evidence, not proof of this candidate's VM lifecycle.
Original HOLD receipts remain HOLD. The complete permission/resource/locale
matrix remains INCOMPLETE. Preserve rollback artifacts, configuration and
volumes; no company deployment is authorized by this source change.
