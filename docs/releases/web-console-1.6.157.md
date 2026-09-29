# Web Console 1.6.157

Server v1.6.490 packaged Web Console 1.6.156. In isolated 8080 browser QA, a
readonly user opening `/apps/stacks/add` directly on a fresh page received
the intended permission denial, but the notice remained fixed under `BODY`.
The authenticated template contained an empty `#growl-mount`, and the notice
overlapped the right-side header actions at 1440px (notice y55–136; actions
y65–97). A client-side transition on the same page moved the notice into the
mount and cleared the actions.
Thus `1.6.156` did not pass packaged browser acceptance for this path.

The route's deferred render callback could miss the mount on a fresh load.
The authenticated template now renders a `growl-mount` component that moves
the existing jGrowl container when its element enters the DOM. On teardown it
returns the container to `BODY` only if that component still owns it. This
preserves the running plugin instance and keeps login/MFA notices on their
existing body host. The change does not alter route permission checks, API
authorization, notice copy, or request payloads.

`npm test -- --filter='growl'` passed 7/7 Chrome 153 QUnit tests, covering
notice placement, component insertion and teardown, delete notices, and layout.
The layout test covers light and dark themes, LTR and RTL, English, Traditional
Chinese, and Japanese, at 1440px, 375px, and 280px. These checks use the source
build.

The official [Web Console 1.6.157 release](https://github.com/PastureStack/web-console/releases/tag/1.6.157)
publishes `web-console-1.6.157.tar.gz` with
SHA-256 `ba1724c8a2e3d204c6f1527c7880cd361f3e307863133a1d1ba45120fce53a3f`.
[Server v1.6.491](https://github.com/PastureStack/server/releases/tag/v1.6.491)
packages this version in the published image
`ghcr.io/pasturestack/server:v1.6.491@sha256:c484d298e5bde93b51b44acd476a725bbaa471959d1079d19331c01bc55f8705`.

Post-release isolated 8080 QA passed 14 scoped cases: 12 readonly Stack and
Service direct-create denials across Traditional Chinese, English, and Japanese
at 1440x900 and 375x812, plus two owner checks that the create forms open at
1440x900. Two additional fresh
direct-URL checks for the readonly role passed at 1440x900. The record reports
zero resource writes; the owner checks did not submit a resource. This QA does
not establish 280px packaged layout, both themes and directions, login/MFA
notice behavior, the broader six-role resource matrix, or formal company-site
deployment.
