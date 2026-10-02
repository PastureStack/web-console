# Web Console 1.6.165

Published immutable component; packaged Server acceptance is separate.

## Host container names

The existing `subpod-name clip` combination used nowrap and ellipsis. Several
real rollback containers therefore appeared as the same shortened name even
when their model and link text contained different complete Docker names.

Only the `.container-subpod` name and detail flex children change. Names wrap
at safe word or unbroken-character boundaries; IP and actions retain their
space. Global `.clip`, Host titles, transition messages, actual names, IDs,
stack-prefix stripping, API and authorization are unchanged. Container/VM rows
and rows with children use the same shared rule; add-container and dot modes
are unaffected.

## Focused validation

Four real compiled-CSS layout cases cover light/dark and LTR/RTL at 1440, 375
and 320px viewport widths with a 260px Host card. They check full distinguishing
suffixes, long unbroken and Traditional Chinese names, short names, glyph
containment, IP/action separation and child placement. These four focused
Chrome cases passed all 744 assertions against actual compiled CSS, with zero
page or asset-request errors. The initial fixture used a plain button instead
of the actual action-menu classes, causing 96 action-area assertions to fail;
the fixture was aligned with the real template without reducing the geometry
checks. The earlier failure remains recorded. The final test also rejects
empty text rectangles and proves real wrapped glyph lines rather than relying
on flex-container height. Packaged native-browser initial/reload acceptance
is now separately verified in packaged Server501.

## Immutable publication

Exact-source validation run 36979009940 passed all 767 tests, with zero failures,
skips or TODO cases. It includes the four layout cases, the adjacent empty-Host
case, and retained locale tests. Two production archives match byte for byte:
2,976,219 bytes, SHA-256
`5baaa4879fe5548cc8b66cd1c7a2005edf586d4b5f12b6dbb3796b6692e41959`.
Signed annotated tag `1.6.165` points to exact CI source
`00bcd9fdc92afead708dffb4a2b3b01f4ebaeaa0`. PR149 merged normally as
`c36d7969a6f368e687c24ee7ab1387fb0366ed92` with an identical tree.
The release is immutable, and both anonymously downloaded assets match the
reviewed candidate. The release reused that candidate without rebuilding it.
CodeQL run 36979008385 completed successfully; this is not a zero-findings claim.

The package bump changes only root package/lock versions and dependent version
gate literals; dependency graphs and security thresholds remain unchanged.
Earlier immutable versions, technical receipts and visual HOLDs are retained.
Packaged Server501 first start/restart preserved runtime settings and database
counts. Native Host-page initial and actual reload matched six exact full
Docker IDs/names, with nine removed records absent. All five distinguishing
rollback suffixes were visible in measured glyph rectangles and both actual
screenshots reviewed by Root. IP/action areas did not overlap; one native menu
open/close cycle used two trigger clicks and no action-item clicks. Fresh
Authentik and platform MFA succeeded. Resource writes, retries,
page/console/loading errors and unexpected document loads were zero.
WebSockets connected and one actual server message was observed after reload;
this is not a long-duration/reconnect assertion. The original raw visual flags
and earlier visual HOLDs remain unchanged. This narrow correction does not
establish complete permission, resource or language-matrix acceptance, which
remains INCOMPLETE.
