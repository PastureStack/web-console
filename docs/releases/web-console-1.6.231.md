# Web Console 1.6.231 / Bridge 0.2.33

[Web Console 1.6.231 / Bridge 0.2.33](https://github.com/PastureStack/web-console/releases/tag/1.6.231)
is published for matching Engine **0.183.390**. Compose stays **0.14.44**.
Server assembly, deployment and affected native acceptance are tracked separately.

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

Original full/enabled CI run **42506065586** passed **360** distinct methods:
336 Node and 24 QUnit, comprising 354 retained and six new identities. All
**1,149** browser cases passed, including the two new ordinary/valid-Catalog
QUnit methods. Bridge **0.2.33** passed its real packaged SDK handshake with
SDK **1.32.2**, twelve tools and the unchanged 92-component / 95-installation
dependency graph. The source allowlist remains 60 files / 62 ZIP entries;
no new dependency scan is claimed.

The immutable release **438433509** passed all thirteen anonymous asset
bytes/SHA256 checks and native cryptographic release verification covering
fourteen subjects. Original archive provenance/SBOM attestations and matching
published Engine390 contract verification passed.

[Published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.231/web231-release-metadata.json)
binds producer `33e7e1f0584c7f8723faad7f5d3b3d994880b06a`, tested tree
`c4429cff3b68e7058ff65dfe31115c8b23d4f4e9` and normal merge/tag target
`7958b29a1dd3cb12dfc4399aab25f23cc876e225`.

Component publication does not update a running Server. At component qualification,
Server588 deployment, affected native/UI workflows and the seven Stack composites remained pending;
complete 243-group frontend coverage is not claimed.
