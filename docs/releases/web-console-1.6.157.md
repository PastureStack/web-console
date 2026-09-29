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
build. A newly packaged Server image and fresh direct-URL QA 8080 acceptance
remain pending.
