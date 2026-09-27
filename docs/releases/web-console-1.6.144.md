# Web Console 1.6.144

Previously, the Secret, Certificate, and Registry index pages showed Add even
when the current environment schema offered no POST capability. Opening their
Add URLs directly still displayed a form. Now those buttons follow the current
project's create capability, and the routes reject unauthorized entry before
creating form records with a localized, human-readable 403. Registry creation
requires both registry and registryCredential POST capabilities.

Previously, Secret Edit remained enabled without an update action link because
its condition included an unconditional `true`. It now follows that link.
Secret Remove and the Certificate and Registry Edit/Remove actions already
followed their respective resource action links; those behaviors are unchanged.

This release changes browser controls and route feedback, not Server
authorization or API contracts. Targeted create-permission, action-menu,
English/Traditional Chinese/Japanese error-page, other-locale fallback, and
translation-quality tests pass. Browser acceptance of `1.6.144` on the
isolated 8080 QA environment is still pending; prior 8080 observations do
not establish that this source release has been deployed or accepted.
