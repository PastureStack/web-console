# Web Console 1.6.182 — Clipboard click event

[Web Console 1.6.182](https://github.com/PastureStack/web-console/releases/tag/1.6.182)
was published on 2026-10-11 with the retained production archive and portable
checksum. Publication did not rebuild or relabel the producer artifact.

## Changes

Pass the native click event to the shared copy-to-clipboard action so feedback
can use the clicked button's `currentTarget`, including clicks on its nested
icon. No API Key audit details action or authorization behavior is changed.

## Artifact and limited acceptance

The numeric tag binds original producer commit
`8c5e2d75cdd78f9e42a1b0a2caa0caa18c43d5df`, tree
`1b5a11ed172c40dcbac8a80d2ab4cca8382b99d4`. The reviewed main merge
`fe95eea0a03ac1196cce5cf050311a0bcc9619a9` has the same tree and does not
replace the archive's producer identity.
`web-console-1.6.182.tar.gz` is 3,016,100 bytes; SHA-256:
`8128462930ade3cb62bb3b2cf143c3a853962f9ec93336589ae99c133d364357`.

Two focused Chrome integration tests pass using the actual component templates:
button and nested-icon copying, and an audit row whose copy button remains
distinct from its last-column details button. The latter verifies the exact
Key-scoped details request and rendered result. The retained receipt records
two passes with zero failure, skip or todo; it was not rerun for publication.
Production build and package checks passed, including byte equality for all
123 packaged production files and verification of the portable checksum.

The earlier native same-viewer QA attempt selected the first row button (copy),
not details, and exposed the missing copy event. These focused regressions do
not complete AUD-07/AUD-10 permission-withdrawal acceptance or the whole platform
matrix; `wholeMatrixPass=false`.

The published [Server v1.6.521](https://github.com/PastureStack/server/releases/tag/v1.6.521)
still includes Web Console 1.6.181 and Engine 0.183.337. The independent
1.6.182 archive has not been deployed to QA. No new Server/Engine compatibility
or complete platform acceptance is claimed by this clipboard patch.
