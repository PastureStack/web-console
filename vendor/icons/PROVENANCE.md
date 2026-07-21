# Provenance

## Legacy contribution boundary

The compatibility API was inherited from an earlier upstream icon-font repository. PastureStack does not claim original authorship of that API. The contributor acknowledgment and the audited-history boundary are recorded in `UPSTREAM_ATTRIBUTION.md`.

## Compatibility API

The 108 codepoints and 116 CSS aliases are retained as an interface contract so the management UI does not lose controls, status indicators, or resource symbols. The previous outline data is not used by the build and is not present in the current tree.

## Functional glyph outlines

- Source package: `lucide-static@1.25.0`
- Upstream: `https://github.com/lucide-icons/lucide`
- Source font: `node_modules/lucide-static/font/lucide.ttf`, locked by `package-lock.json`
- Mapping: `src/icon-map.json`
- Generated source hashes: `source-manifest.json`
- License notices: `LICENSES/LUCIDE.txt` (ISC and MIT terms)

Product-like legacy compatibility aliases map to neutral Lucide symbols. No Apple, Docker, GitHub, Kubernetes, Linux, or Windows logo outline is included.

## PastureStack project mark

- Source: `src/pasture-stack.svg`
- Design: layered pasture, infrastructure stack, and connected nodes
- Codepoint: `U+E946`
- Glyph name: `pasture-stack`
- License: Apache-2.0 as an original PastureStack contribution

The mark was independently drawn for this migration and does not reuse the removed project-brand outline.
