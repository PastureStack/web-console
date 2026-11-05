# Web Console 1.6.215 / Bridge 0.2.17 candidate — not published

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

This source requires matching Engine v0.183.374 once published and a qualified
Server assembly. Published Web214/Bridge0.2.16 installation instructions and
immutable assets remain unchanged. Focused source controls, normal required CI,
artifact qualification and native/weak-model acceptance are separate; pending
platform acceptance is not a whole-family or whole-243-group result.
