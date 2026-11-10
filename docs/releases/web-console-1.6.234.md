# Web Console 1.6.234 / Bridge 0.2.36 candidate

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

Four new regression tests and 54 adjacent tests pass locally, including native
revocation/owner/policy/foreign-receipt errors, forged/stale references and no
second dispatch. The existing thirteen localized Registry review-label checks
also pass. Original CI, packaged SDK verification, immutable publication and
matching Server/native acceptance remain pending. No production or runtime
patch is included.
