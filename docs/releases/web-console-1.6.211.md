# Web Console 1.6.211 candidate

This source candidate is not published. Current installation instructions continue to use the published 1.6.210 release.

Passive session validation now commits its cookie/generation checks and local adoption in one IndexedDB transaction when Web Locks are unavailable. It respects an existing asynchronous authentication lease and creates no persistent passive lease that a page reload could abandon.

Validation-only token and API-root reads use the captured bearer with `credentials: 'omit'`. Their responses cannot replace a newer browser cookie; the existing cookie, generation, authenticated identity and API-root actor checks still apply. Ordinary API requests keep their existing credentials behavior.

Login acceptance, MFA challenge acceptance and explicit logout retain their existing asynchronous mutex and ownership checks. A pending logout DELETE still excludes passive adoption until its guarded completion. This change does not reclaim an unexpired asynchronous lease left by older JavaScript.

Focused source and local loopback Chromium transport evidence are separate from full CI and platform acceptance.
