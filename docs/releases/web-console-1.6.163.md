# Web Console 1.6.163

Published immutable numeric component release. Packaged browser acceptance
remains separate; publication does not declare Server packaging or deployment.
The signed [numeric tag](https://github.com/PastureStack/web-console/releases/tag/1.6.163)
pins validated source `5db737a5e04c4cc15672f97296d5bf521ab9a8da`.
Archive SHA-256:
`54ef4e0726c6564abfb0b16727e991ef8a2258d9655cd1e603f43d6a557f8d27`.
The [archive](https://github.com/PastureStack/web-console/releases/download/1.6.163/web-console-1.6.163.tar.gz)
is 2,975,898 bytes; its [portable SHA-256 file](https://github.com/PastureStack/web-console/releases/download/1.6.163/web-console-1.6.163.tar.gz.sha256)
uses the asset basename. Public downloads match the reviewed candidate's bytes,
hash and size; the existing candidate was published without rebuilding.

## Narrow shared display-locale fixes

`date-from-now` recomputes when the selected Intl locale changes, even if the
timestamp is unchanged. Each Moment instance uses the existing user-language
locale mapping; formatting does not mutate the global Moment locale. The named
helper function retains its previous global-locale behavior when no locale is
supplied.

`badge-state` translates the seven recognized display labels Active, Running,
Stopped, Stopping, Created, Exited and Error through existing
`formPorts.preflight.state` translations. It uses `model.displayState`, not the
machine state: an active resource displaying Disconnected must remain
Disconnected. Unknown display labels retain their original text. No translation
keys, model state, icon/color bindings, sorting, filtering or API contracts change.

## Focused source evidence and pending acceptance

Native Chrome 153 local source validation passed 12/12 tests, with zero failures,
skips or todos:

- Seven real DOM rendering tests use the actual Intl service and built
  translation JSON. They cover unchanged-timestamp `en-us` to `zh-tw` to `en-us`
  switching, instance-only Moment locale, the existing Simplified Chinese locale
  mapping, all seven known display labels, unknown fallback, label changes,
  retained icons/colors and health/connection override semantics.
- Three helper tests preserve the existing locale mapping, explicit instance
  formatting, unknown-language English fallback and the named helper contract.
- Two existing user-language tests retain document language/direction and
  English fallback loading behavior.

Those earlier local tests used an existing dependency installation and remain
separate from fresh locked CI and packaged acceptance.
[Official validation 36827428183](https://github.com/PastureStack/web-console/actions/runs/36827428183)
then passed 755/755 actual Chrome 154 tests, including all 12 locale cases, with
zero failures, skips or todos. The normal `validate.yml` dispatch used the pinned
source and toolchain, ran `scripts/ci`, and produced two byte-identical production
archives with the hash above. The signed source tag and published asset preserve
that source/artifact binding, not a later documentation commit. The disabled
historical `scripts/build-static` path was not used. PR CodeQL source checks
completed successfully; no all-findings-zero claim is made.

No full-language, responsive/mobile layout, backend-write, authentication, MFA,
database, runtime-host or VM acceptance is claimed. Earlier HOLD evidence remains
HOLD, and the broader resource/role matrix remains INCOMPLETE. No Server packaging,
production or deployment changes are included.
