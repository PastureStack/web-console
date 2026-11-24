# Web Console 1.6.240

Load-balancer image upgrades now submit the complete primary and secondary
launch configurations directly to the native upgrade action. The form no longer
saves the complete edited Service before that action, so the Engine can capture
the actual previous image and launch configuration for rollback.

Validation, upgrade strategy options and the existing save lifecycle remain in
place. Changes to names, descriptions, scale or load-balancer configuration use
an explicit metadata-only update; rules, certificates, stickiness and custom
configuration remain editable. An image-only upgrade does not issue that update.

This fix applies to upgrades started with this console. It cannot reconstruct a
previous launch configuration already overwritten by an earlier submission.
Native finish and rollback eligibility are unchanged: finish removes the retained
rollback point.
