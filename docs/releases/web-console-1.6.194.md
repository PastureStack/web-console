# Web Console 1.6.194 candidate

The static build toolchain moves to the official Node.js 24.22.1 security
release, with npm 12.0.2 and the existing browser package versions. The Node
archive SHA-256 and immutable builder digest are pinned. CI source verification
uses Python 3.14.9, pip 26.2.2, and certifi 2026.10.19.

The archive layout, API contracts, service-upgrade behavior, and 13 locales
retain the previous release contract. Publication requires successful
dependency checks, browser tests, deterministic double builds, and artifact
inspection. Server assembly and deployment are separate evidence.
