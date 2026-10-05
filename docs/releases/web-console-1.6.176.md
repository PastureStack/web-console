# Web Console 1.6.176

Published and included in
[Server v1.6.514](https://github.com/PastureStack/server/releases/tag/v1.6.514).
Official Server packaging, startup and restart checks passed. Deployed UI
acceptance is scoped below; this publication is not full-matrix PASS.

## Formal publication and limits

Exact-source [CI37175725533](https://github.com/PastureStack/web-console/actions/runs/37175725533)
passed 824/824 tests with zero failures, skips or todo. Its 32 targeted cases
retain 29 earlier cases and add three native-mut regressions: plain Project
member roles, EmberObject Project member roles and a rendered nested schema enum.
The signed immutable numeric [release](https://github.com/PastureStack/web-console/releases/tag/1.6.176)
from [PR171](https://github.com/PastureStack/web-console/pull/171) pins source
`a1bbf172aad8443bfbb1859760d62669d6705189` and tree
`dfa280c29e241bb815eff852e8a188c101e338eb`. Both reproducible production builds
and anonymous public archive/checksum downloads match archive SHA256
`071ce0b7091b323e0d84fe91269684f59fcf2e29000bd8ff94428e8dd03ece52`
(2,982,158 bytes); publication reused the tested artifact without rebuilding.
The anonymous publication readback receipt SHA256 is
`582b2d570f0a28930d0e10fa718632659cc5d4c94a83158223b5d641fe1588db`.

The thirteen packaged locales and source gates passed. Static artifact inventory
contains no affected build-package modules; this is not a runtime not-affected
VEX or zero-CVE claim. The unchanged build audit reports 7 High / 3 Moderate.
The exact reviewed build-only `GHSA-vfj7-8cjw-p6xm` remains vendor-pending through
2026-10-10, with the existing High threshold and expiry checks retained.

Server514 packages this archive with published Catalog Service `0.20.12`.
Isolated deployed tests cover eight fresh/cache functional observations of the
Traditional Chinese and English container/VM forms and two INIT checks, with
zero resource writes or VM starts. The retained fresh-form screenshots and INIT
screenshots were also visually reviewed. This does not establish VM boot, GPU
runtime, independent cached-form screenshots or all thirteen locales. Resource
lifecycle and permission acceptance is scoped below. Prior incomplete results
remain unchanged; the complete matrix remains INCOMPLETE.

### Current native lifecycle progress on isolated Server514

| Scope | Observed result / pending authority |
| --- | --- |
| Existing Network service edit and cleanup | Scoped PASS: 4 writes/6 full guards, cleanup verified; result SHA256 `f6d0070c20795fdeab0c795fdf0d7b04404a4543b25c52d4b64492ce091d887e` |
| Container role-specific denials | Readonly child: 6 expected denials/9 guards observed; target-environment no-access: independent scoped PASS with 6 expected denials/9 guards and 0 allowed writes, fresh 4+2 authentication committed, page/console errors 0; result SHA256 `179e99a39a96adb22c66c88eccc3cb9f0c89a212e27c7de8cee7eb367001e733`. Original readonly parent HOLD unchanged |
| Owner container lifecycle | INCOMPLETE — original start/stop HOLD unchanged. Separate runs verified start/restart 202 and actual log output/termination (2 writes/4 guards), start 202 and actual terminal output/termination (1 write/3 guards), and native DELETE 200 with the confirmation modal closed/source finalizer completed (1 write/1 entry guard). Independent read-only cleanup found all seven owned rows terminal: six purged/one removed, count 7. Delete result SHA256 `41611ab1f2d62c36cb76150bac2a015db24fe642e3e5c32ff8ea4697e5e88e54`; cleanup-only result `690e3bcf1410009c8c3d03883e5850181dace29af21eedf6c14e71026edf5aa8`. Eight foreign raw-row differences, three historical FK gaps, unproved owned unknown fields and no fresh API14 readback prevent full-guard acceptance. No removed-phase guard/final browser receipt, replay or promotion of prior HOLDs |
| Existing Catalog B-upgrade remainder | Distinct non-original scoped PASS: upgrade 202, finish 202, reload and owned cleanup; 4 resource writes/5 transports/7 full guards; result SHA256 `e113ef1b6c1ce2941b9843a8014e55dee31b8a000ee48750c7d5dfdeecfed716` |
| Existing Project lifecycle and independent DB cleanup | Native deactivate/activate/remove finalizers and list reloads observed in separate stages; two original runs each remain HOLD with 2 validated writes/5 guards. Independent owned DB terminal cleanup confirmed with 0 auth/0 writes/0 current guards; result SHA256 `a5ff35f857ae2cdad7cd75bb77c26082ed61993978d17388b7432e280482a53c`. No full-guard or complete historical-preservation PASS: 8 missing historical foreign rows and 4 default-network protection gaps remain |

The two permission-role slices are different runs. A no-access denial check
does not establish access to protected resource contents. The hashes refer to
local QA workspace evidence, not public assets. They do not
promote the earlier create/A/activation or Project HOLDs, establish production
acceptance or change the release source, archive or dependency graph.

## Root cause and minimal repair

The native Project member-role select used `action (mut member.role)` with
`value="target.value"`. Ember 7.2 exposes the current value of an invokable `mut`
reference to a classic helper. The compatibility `action` helper therefore sees
the current role string, not the setter, and dispatches that name instead of
updating the member. The DOM selection can change while the model stays unchanged.

Wrap the existing reference in native `fn`: `action (fn (mut member.role))`.
The helper now receives a callable setter and retains its existing event value
mapping. Apply exactly the same composition to 21 selects in 11 templates:
Project roles, schema enum/secret fields, settings, balancer rules and the six
affected machine drivers. No shared helper rewrite or unrelated event migration
is introduced. The existing source gate now also detects this unsafe composition
in `{{action ...}}`, not only parenthesized subexpressions.

Real-component regressions cover plain cloned and EmberObject Project members,
sorted selected-row identity, input/change propagation, unchanged owner/metadata,
members-only native save payload/finalizer and no metadata/network writes. A
rendered native schema enum checks nested model updates without replacing unknown
metadata or schema choices. Existing capability tests retain the unavailable
member-role select when no `setmembers` link exists.

Dependencies and their graph are unchanged; only root version metadata and its
executable/reviewed-baseline pins become 1.6.176. The Web175 image validation fix,
session generation, save owner, backend schemas, authorization, OIDC, platform
MFA and compatibility contracts remain intact. The complete matrix remains
INCOMPLETE. Retain configuration, volumes and rollback artifacts; this source
change does not authorize company deployment.
