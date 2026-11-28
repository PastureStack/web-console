# Web Console 1.6.244 candidate

## Existing LB labels during form initialization

The shared LB form previously merged label sections before all child editors
had read the original launch configuration. A partial initialization could clear
user labels, scheduling labels and `io.rancher.sidekicks` during an image upgrade.

The form now waits for all three label sections before replacing the label map.
An explicitly empty section remains valid, so intentional label removal keeps
its existing behavior. Create, ordinary edit and native image-upgrade actions
retain their existing lifecycle and authorization.

Four focused regression cases cover each section completing last and explicit
removal after initialization. The native nonempty-secondary QA transaction is
separate deployed evidence; source tests do not qualify its browser lifecycle.

## Boundaries

The LB resource's direct secondary field remains hidden by the existing policy.
The supported native upgrade strategy and read-only Compose export are used for
the isolated nonempty fixture. No field permission or backend API is broadened.
Publication, exact Server integration and deployed acceptance remain pending.
