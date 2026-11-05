# Web Console 1.6.211 / Bridge 0.2.13

Published from producer `57b5370d9c7bf9fdd7de5907da4dd3c29c963005`, normal merge/tag target `ecb68f91234da891dcf59cf60c4d47242ea6a058`, tested tree `91afcfc17d9cd85da786e68b1f3f03226b27c649`. Documentation commits do not replace this artifact identity.

Passive session validation now commits its cookie/generation checks and local adoption in one IndexedDB transaction when Web Locks are unavailable. It respects an existing asynchronous authentication lease and creates no persistent passive lease that a page reload could abandon.

Validation-only token and API-root reads use the captured bearer with `credentials: 'omit'`. Their responses cannot replace a newer browser cookie; the existing cookie, generation, authenticated identity and API-root actor checks still apply. Ordinary API requests keep their existing credentials behavior.

Login acceptance, MFA challenge acceptance and explicit logout retain their existing asynchronous mutex and ownership checks. A pending logout DELETE still excludes passive adoption until its guarded completion. This change does not reclaim an unexpired asynchronous lease left by older JavaScript.

Original full/enabled CI 42077118132 passed 1140 browser tests with no failures or skips. All 50 focused methods were observed: 39 Node and11 QUnit, including 6 new real-Service cases; three barriers each execute 100 deterministic iterations. Required CodeQL, original archive/runtime-SBOM attestations, all 13 anonymous asset readbacks and immutable 14-subject release crypto passed. No artifact was rebuilt.

Bridge 0.2.13 has 45 Git source files/46 manifest rows/47 ZIP entries and a new actual SDK1.32.2 handshake. Its 92-component/95-location dependency graph carries published 0.2.5 clean-install evidence without a new install. Engine 0.183.372 is unchanged. Runtime SBOM coverage remains incomplete, and no Engine workflow SLSA is inferred.

Designated Server session acceptance, Project/LB native cases, new weak-model subcases and the 52 new audit layouts remain pending; whole 243-group completion is not claimed.
