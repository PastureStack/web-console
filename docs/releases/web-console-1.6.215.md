# Web Console 1.6.215 / Bridge 0.2.17

The existing twelve typed tools now expose three ordinary-Service upgrade
lifecycle operations through preview_resource_change, normal human review,
apply_resource_change and get_operation. Each operation accepts empty parameters
only; it never supplies an image, strategy, raw action or configuration.

- finish_upgrade requires the native upgraded state and completes toward active.
- rollback accepts upgrading, upgraded or canceled-upgrade and restores the
  approved upgrade generation toward active.
- cancel_upgrade accepts upgrading or finishing-upgrade and verifies only the
  native canceled-upgrade checkpoint. It does not finish an upgrade or rollback.

cancel_rollback remains unsupported because the native capability is absent.
The existing image-upgrade tool remains separate. Exact opaque references,
current native role and Key upgrade authority, phase/generation comparison and
human approval remain required. The server owns configuration and instance
readback; accepted, running or unknown results never prove completion.

Human review displays only the operation and native state transition. The
existing action and field labels are reused in all thirteen locales. Private
configuration, generation fingerprints and credentials are not model outputs.

This [immutable release](https://github.com/PastureStack/web-console/releases/tag/1.6.215)
pairs with published Engine v0.183.375 and requires a qualified compatible Server
assembly. Its original full/enabled CI passed 1,140 browser tests and 69 focused
methods: 61 carried identities and eight new lifecycle/review-label Node methods.
All thirteen public assets passed anonymous byte-count/SHA256 readback and native
verification of fourteen cryptographic subjects. Bridge qualification covers
48 source files, 49 manifest rows, 50 ZIP entries and one real SDK handshake.

The producer is `c66adfaff3bc1aeef13502b36ff613b203dd7364`; normal merge/tag target
`8fe0730ac4193845e8306cd615218e8053a2517a` shares tested tree
`b1ed18051d1bd7fc30cbd6c5385b98299cfbb6dd`. These artifact identities and immutable
assets remain unchanged by this later documentation update. Designated native
and weak-model acceptance remain pending; component publication is not a
whole-family or whole-243-group result.
