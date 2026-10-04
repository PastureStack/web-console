# Web Console 1.6.176

Candidate source only. Exact-source CI, signed immutable publication, Server
packaging and deployed UI acceptance are pending. Do not promote historical
Project HOLDs or infer full-matrix acceptance from this correction.

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
