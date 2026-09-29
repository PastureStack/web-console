# Web Console 1.6.155

Server v1.6.488 packaged Web Console 1.6.154 and correctly denied direct
Stack/Service creation without permission. Browser screenshots at 375×812 and
1440×900 exposed a separate layout defect: the global error notice started at
10px while the 45px top navigation was still underneath it. The message was
technically inside the viewport but visually obscured the navigation.

The shared growl stylesheet now starts top-right notices below the existing
`$navbar-height` token, retaining the vendor notification margin as the gap.
The notification width is capped to the viewport minus its two 10px margins.
This applies to light/dark themes and LTR/RTL without changing route guards,
API permissions, or notification text.

The focused Chrome QUnit layout test covers both themes, both directions and
1440px, 375px, and 280px widths. It checks notice/nav separation, viewport
fit, dismiss-control placement and opacity. Local production/development
build and the focused test passed. Official release CI and packaged 8080
browser acceptance are separate gates and must be recorded after publication.

The subsequent isolated v1.6.489 / 1.6.155 packaged-browser run confirmed
navigation clearance but found that the fixed notice still obscured the
375px page title and 1440px right-side sort controls. Thus the layout was not
accepted despite the original focused runner reporting visibility PASS.
Web Console 1.6.156 moves authenticated notices into document flow and adds
content-overlap checks; this note retains the actual 1.6.155 outcome.
