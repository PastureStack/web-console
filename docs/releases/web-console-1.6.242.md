# Web Console 1.6.242

Managed load-balancer updates now compare parsed image references rather than
substrings. The Stack row and service detail share an explicit update entry
showing the current and candidate tags. Ordinary editing retains its existing
behavior.

The candidate requires the resource's native upgrade action, the same normalized
repository, and a newer release tag. Custom repositories/tags, explicit digest
pins and digest-only references are preserved. A tag alone does not establish a
digest identity. A direct image-update URL rechecks the same candidate before
changing the form clone and reports an unavailable candidate in all 13 locales.

The native image-only upgrade path from 1.6.241 is retained: it does not persist
launchConfig or publicEndpoints with a preliminary service PUT. Existing primary
and secondary launch configurations remain the engine's native rollback source.

Regression coverage includes exact and prefix-like tags, Docker name
normalization, tag+digest/digest-only references, custom images, missing actions,
candidate changes, direct URLs, shared-entry rendering and translated notices.
Component tests are separate from deployment/browser lifecycle acceptance;
publishing this component does not claim an existing workload has been upgraded.
