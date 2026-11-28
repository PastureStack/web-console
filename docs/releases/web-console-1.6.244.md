# Web Console 1.6.244

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

## Publication boundary

This immutable component artifact uses the default off build ceiling. It was
rejected by the Server consumer before deployment. Web Console 1.6.246 supplies
the matching Server build ceiling with every page still initially off. Deployed
nonempty-secondary evidence belongs to Server 1.6.609 with 1.6.246.
