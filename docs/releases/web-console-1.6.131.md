# Web Console 1.6.131

The administrative account collection can include project accounts, including
the shared Default project. The account page displays only user and admin
accounts, but 1.6.130 queried the user-only identity-link resource for every
collection row. A project row's expected `AccountNotFound` 404 therefore
prevented the page from loading.

The route now queries identity links only for account kinds rendered by the
page. Its route and controller share the same kind predicate so they cannot
drift. Visible-account authorization failures still reach the existing
localized error page; no API permissions or error status are changed.

A focused unit regression includes a project account in the collection and
asserts that no identity-link request is made for it, while user/admin
identities still load. The existing masked 404 and 503 tests remain.
