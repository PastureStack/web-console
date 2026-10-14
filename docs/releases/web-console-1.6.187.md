# Web Console 1.6.187

## Scope

The shared copy control initializes its translated hint before rendering.
Keyboard activation and copying without a prior hover no longer translate an
undefined key or restore an undefined message after feedback expires. Custom
translated hints remain literals rather than becoming translation keys.

Clipboard rejection and synchronous errors display a localized failure message
instead of an unhandled rejection. HTTP fallback textareas are removed even on
failure. Feedback timers and late clipboard completions do not update destroyed
controls. Each active hint belongs to its actual trigger, so another button's
timer or locale update cannot overwrite it.

Copy hints use their own text width, bounded to the viewport, with wrapping and
fixed-position viewport coordinates. Reused non-copy tooltips have copy-only
styles cleared. The three Custom host command blocks explicitly remain LTR in
RTL interfaces. Commands, registration credentials, API permissions and native
Close/Back navigation are unchanged.

## Localization

Clipboard default, success and failure messages are native in all supported
locales: de-de, en-us, fa-ir, fil-ph, fr-fr, hu-hu, ja-jp, ko-kr, pt-br, ru-ru,
uk-ua, zh-hans and zh-tw. The Russian default now says copy to clipboard rather
than copy a link. The targeted add-host and shared-caller resource audit checks
32 keys across 13 locales for nonempty values and compatible ICU arguments.
Existing declared English fallbacks in neighboring MFA labels are separately
reported; this release does not claim native translation of every console page.

## Verification and publication

Focused integration tests cover initial/no-hover rendering, all locale messages,
exact clipboard payloads, success/failure/reset, custom literal hints, HTTP
fallback cleanup, active trigger ownership, late completion after destruction,
and native Linux/Windows registration copy and Close/Back behavior.
Production packaging, immutable component publication, paired Server image
publication, and real-browser viewport/theme acceptance are separate gates.
Results and immutable artifact identities will be recorded after completion.

No Authentication Service, Engine, OIDC, MFA, HAProxy, networking backend or
registration API change is included. Existing broader acceptance and deferred
KVM cases are not promoted by this scoped repair.
