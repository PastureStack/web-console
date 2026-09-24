# Web Console 1.6.128

This release closes a permission-display gap on the environment edit page when
someone opens `/settings/env/<id>?editing=true` directly. It changes the browser
form, not the API authorization rules.

- The member list remains visible. Adding members, changing their roles, and
  removing them require the project's `setmembers` action link. The same link
  controls whether the form sends a member update.
- Project name and description continue to require the project's `update` link.
  Network-policy controls and writes require the network's own `update` link and
  a supported, visible policy editor.
- When no part of an existing environment can be changed, the page offers an
  exit action without a save button. New environment creation retains its
  initial-member flow.

Focused component and rendered-template tests cover read-only, individual
capabilities, their combination, and new environment creation. This release
does not assert a live network-policy PUT authorization matrix; the browser
uses the network capability returned by the API. Server `v1.6.466` packages
this Web Console artifact with Orchestration Engine `v0.183.321`. The browser
change does not alter backend authorization.
