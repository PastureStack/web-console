# Web Console 1.6.173

Published immutable component; official validation and anonymous public archive
readback verified. One packaged fresh-key run is independently derived scoped
verified with its original parent HOLD retained; remaining native acceptance is pending.

## Root cause and minimal repair

The environment-create form maps native `ProjectTemplate` resources to choice
cards. It incorrectly read `localizedName`, a Catalog Template property which
the native model does not implement, leaving labels empty. Read the native
resource's `name` instead. Preserve the existing name-dependent sorting and
selection by exact template ID; do not translate user-defined names or add a
fallback which conceals a missing model contract.

The bounded consumer review found this incorrect native-model lookup only in
`app/components/view-edit-project/component.js`. Catalog templates legitimately
use `localizedName` and are unchanged. No API, permission, membership, save-hook,
OIDC, MFA, session-generation or WebSocket contract changes.

## Verification and release boundaries

Four regressions use the real native model without an invented `localizedName`
and verify rendered labels/sorting, rename reactivity and exact-ID card selection.
[Official CI37115288389](https://github.com/PastureStack/web-console/actions/runs/37115288389)
passed 812/812 tests with zero failures, skips or todo; two production archives
are byte-identical. Existing environment permission tests remain applicable.

The signed immutable numeric
[release `1.6.173`](https://github.com/PastureStack/web-console/releases/tag/1.6.173)
pins source `c8b8bb2659fdad3539cf6a72866c94a77ec516b6`, tree
`f590310e157edea79de81fcf333e8b39dbc5677e`. Anonymous public archive and checksum
downloads match the same CI artifact without a rebuild:

- Archive: `web-console-1.6.173.tar.gz`, 2,982,104 bytes.
- SHA256: `a566684e6e0831630a15cb7212989c0e9fe707ed07965156c2b664b9cdb5ba27`.
- Independent publication/readback receipt SHA256:
  `e106fff8243adfc024525d25366adc0970fff38fd90ceb5c03115ea5d3ba0432`.

[Server511 publisher37116124788](https://github.com/PastureStack/server/actions/runs/37116124788)
packages this exact component with Engine333. Its official artifact checks and
anonymous readback verified source `e995f8f35bc6335effaceb6c973f7915c68df2ab` and image
`ghcr.io/pasturestack/server:v1.6.511@sha256:bce474ce4403398044a7c24aafe6c8314bac38b44731540c5ffaa2dfc40699cd`.
That evidence does not establish QA deployment, Docker healthy or native creation.
Separate QA125/8080 upgrade and independent read-only checks passed: first-start11/
restart10 probes returned HTTP200/pong and runtime/DB counts were unchanged.
The image has no Healthcheck, so Docker healthy is not claimed.
The version-bound native read-only proof for existing Template117 passed with
three Full17/14 guards, zero resource writes and a source-bound same-ID empty
stacks/services proof; it is not a native-create finalizer.
Process native list/link/detail and same-ID direct GET passed for one current ID:
two API roots × six roles, 12/12 cells and zero resource writes. Other IDs and
write methods remain untested.
Fresh Project API Key `1c6998`, run `qa511freshProjectef9ce0d4273c`, is independently
verified as `DERIVED_SCOPED_KEY511_VERIFIED_NOT_ORIGINAL_PASS`. Its actual child
completed four native create/edit/deactivate/delete writes, 13 Full16/14 plus generic guards,
four native barriers and 18 first-delivery boolean checks, including the visible
modal/private clone and copy-component parameters with a redacted canonical Store.
Copy clicks and the OS clipboard were not tested. Six cookie-free issued-key
Basic GETs before deactivate/delete covered both API roots: owned read200,
wrong-secret401 and foreign
project2515 read404. These are not post-revocation Basic-denial tests.
The read-only verifier closed all 36 source-snapshot files, immutable component
blobs and terminal predicates using only `resourceId := exact generatedKeyId`
in memory, without network/auth/SQL calls, new resource writes or repeated live
runtime checks. The original
parent remains HOLD because the child recorded `generatedKeyId=1c6998` but
`resourceId=null`; original receipts were not rewritten and writes were not replayed.
Local QA workspace evidence, not public assets, under
`.qa-evidence/v511-apikey-native-closure/qa511freshProjectef9ce0d4273c/`:

- `derived-root-verification.json` SHA256:
  `25107f33f9dddb8e3532dff59d3d3eef40d6c7a85963bb0ed7e1c14a7fa5149b`.
- `result.json` (original parent HOLD) SHA256:
  `7519e0708770efab189daf4c18f2d03d9919bef1a20d27be409da1e57247ce2d`.
- `browser/browser.json` (original child receipt) SHA256:
  `b919ae9969bcd2ad9819a422b0fd8ec3c02b4e68ffbdd4b9abfd184fbdef8687`.

Native Project and owner/member Host acceptance remain separate pending gates.
Historical HOLD receipts remain HOLD and the complete permission/resource/locale
matrix remains INCOMPLETE.

Keep prior Web172/Server510 release records and the exact Server510 image for
rollback. Preserve existing Compose options, named volumes, HTTPS origin and
runtime policy. Immutable release attachments are not rewritten by this source
documentation update. The company instance is not deployed or modified.
