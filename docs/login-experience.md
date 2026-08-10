# Authentication Experience

This document defines the public authentication layout contract for the PastureStack Web Console.

## Authentication layout contract

The login shell separates the brand header, locale selector, authentication content, and recovery actions. The content region must accommodate local credentials, OpenID Connect, SAML-compatible providers, multi-factor verification, recovery codes, and local-administrator recovery without changing the outer card geometry or duplicating brand elements.

Provider-specific components use the same full-width action area. A configured external provider may replace the local credentials form, while the explicit local recovery action remains visually separate. Future providers must reuse this region instead of adding a second product-specific login screen.

## Visual and accessibility requirements

- Keep the primary action away from the card edge and preserve a clear bottom safe area.
- Keep labels associated with their inputs and retain browser username and current-password autocomplete semantics.
- Support narrow screens, short viewports, right-to-left text, keyboard focus, forced colors, and user-requested reduced motion.
- Animation is decorative only. Authentication status, errors, and progress must remain understandable when all animation is disabled.
- The transparent login mark and the browser icons are PastureStack-owned assets. The root `favicon.ico` and the SVG favicon must both ship in the static artifact so browsers never fall back to an unhandled icon request.

## Release verification

Every release must run `scripts/check-ui-login-experience`, the complete browser test suite, all production-locale checks, two reproducible production builds, and an isolated server browser smoke. The browser acceptance must cover local credential success, localized credential failure, the configured external-provider layout when available, mobile and desktop viewport geometry, reduced motion, horizontal overflow, and console or resource errors.
