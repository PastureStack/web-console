# Web Console 1.6.156

Server v1.6.489 packaged Web Console 1.6.155. Its isolated QA 8080 browser
run confirmed that the permission notice was visible and no longer covered
the 45px navigation bar, but screenshots revealed a remaining defect: at
375px the fixed notice covered the page title; at 1440px it covered the
right-side sort controls. The earlier viewport-only test had incorrectly
reported those cases as passing. This release addresses that shared layout
cause, not the Stack or Service authorization rules.

On authenticated pages the existing jGrowl container is moved into a mount
between the navigation and `<main>`. It stays in the normal document flow and
is right-aligned, so visible notices push page titles and header actions down
at desktop and mobile widths. The same container and plugin instance move
back to the body when leaving the authenticated route; login and MFA notices
retain their existing behavior. A deferred mount operation checks that the
destination still belongs to the document before moving the container.

Focused Chrome QUnit tests cover the shared notification service and layout
at 1440px, 375px, and 280px, including both themes and text directions.
Local Playwright screenshots with compiled CSS verify that the notice clears
the navigation, title, and header actions at those widths. These are source
and local-browser checks; official CI, the immutable Server image, and a new
QA 8080 packaged-browser receipt must be verified separately. No API,
Engine, permission, or request-payload contract changes in this release.
