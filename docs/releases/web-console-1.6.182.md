# Web Console 1.6.182 — Clipboard click event (candidate)

This is an unpublished candidate. The currently published Web Console remains
1.6.181 until a separate release decision.

## Changes

Pass the native click event to the shared copy-to-clipboard action so feedback
can use the clicked button's `currentTarget`, including clicks on its nested
icon. No API Key audit details action or authorization behavior is changed.

## Limited validation

Two focused Chrome integration tests pass using the actual component templates:
button and nested-icon copying, and an audit row whose copy button remains
distinct from its last-column details button. The latter verifies the exact
Key-scoped details request and rendered result.

The earlier native same-viewer QA attempt selected the first row button (copy),
not details, and exposed the missing copy event. These focused regressions do
not complete AUD-07/AUD-10 permission-withdrawal acceptance or the whole platform
matrix. No release, deployment, or Server/Engine compatibility claim is made.
