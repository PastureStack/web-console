# Web Console 1.6.163

Source preparation only. Official validation, deterministic candidate packaging,
public release and packaged browser acceptance are pending. No `1.6.163` release
asset or Server deployment is claimed.

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

These local tests used an existing dependency installation. They are not a fresh
locked CI run or packaged acceptance. The subsequent version/documentation-only
preparation does not change the tested locale semantics. The normal
`validate.yml` workflow dispatch remains the required formal source validation:
it runs `scripts/ci`, builds twice and compares the deterministic candidate
archives. The disabled historical `scripts/build-static` path is not used.

No full-language, responsive/mobile layout, backend-write, authentication, MFA,
database, runtime-host or VM acceptance is claimed. Earlier HOLD evidence remains
HOLD, and the broader resource/role matrix remains INCOMPLETE. No Server packaging,
production or deployment changes are included.
