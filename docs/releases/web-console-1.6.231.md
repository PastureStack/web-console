# Web Console 1.6.231 / Bridge 0.2.33 — source candidate

Unpublished source candidate for matching Engine **0.183.390** and planned
Server **1.6.588**. Compose stays **0.14.44**. The published component baseline
remains Web230/Bridge032 with Engine389. No candidate release asset, image,
deployment or native acceptance result is claimed.

## Reviewed workflows

The existing `preview_service_upgrade` accepts optional primary `command` and
`entryPoint` arrays through the same reviewed plan. Omission preserves the
existing value; null and an empty array remain distinct native inputs. Literal
array order, whitespace and empty strings are preserved within the existing
item/count bounds. Shell strings, environment edits and raw launch configuration
are not accepted. Human review, UUID/CAS, live native roles and Key ceilings,
readiness and retirement stay with the existing owners.

Ordinary Compose Stacks in `upgraded` retain the finish action immediately.
Stacks without a Catalog identity do not request nonexistent template versions.
Valid Catalog identities retain the original queue and version/template lookups;
finish still requires the resource's native action link.

## Qualification boundary

The tool count remains **12** and the SDK stays **1.32.2**. Existing gates,
translations, authorization and human confirmation remain unchanged. Two new
QUnit methods cover ordinary and valid Catalog states in the original owning
test file; source-level Node controls do not replace their required browser CI.

Original full CI, packaged SDK qualification, immutable publication, matched
Server deployment and affected native/UI workflows remain pending. Local focused
controls and retained baseline evidence are scoped separately. The seven Stack
native composites have no complete PASS claim from this source candidate.
