# Web Console 1.6.234 / Bridge 0.2.36

## Scope

Registry removal could dispatch successfully, then lose its scoped navigation
witness and reject get_operation as CONTEXT_CHANGED. Keep observation of an
existing context-bound Registry removal receipt with the native receipt owner.
The Engine still checks the current actor, Key identity/revision, live role
ceiling and exact removed target. Other discovery and change commands do not
inherit this allowance. There is no extra apply or human-confirmation tool.

The shared engine supplies only a validated operation reference to the session
adapter. Browser session handling is retained. The standalone Bridge uses this
only for an already-issued Registry removal receipt.

## Validation boundary

Original full/enabled CI passed 378 specified methods (374 retained, four new)
and 1,149 browser tests with zero failures. The packaged Bridge passed its real
SDK handshake. All thirteen published assets passed anonymous SHA256 readback,
and the immutable release attestation covers fourteen subjects.

Producer `0f512502326499096f61dda7d21078a4f475a778` and merge/tag
`e75e227ced8dde7ad1c8ba4c8b89df2be81d9af8` share tested tree
`99f9e7611e7b5d4a129f870ba3d889f9174b7543`. Native actor/Key revocation,
policy denial, forged/stale receipt and unrelated-operation controls remain
binding. Matching Server and Registry business acceptance are separate and not
claimed by component checks. No production or runtime patch is included.
