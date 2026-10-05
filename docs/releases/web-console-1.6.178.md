# Web Console 1.6.178 — inactive environment details

Status: immutable component published and anonymous artifact readback passed.
Server516 packaging, public artifact readback and separate isolated QA deployment
passed. Complete native acceptance remains pending; no earlier HOLD is promoted to PASS.

## Cause and correction

An inactive environment remains globally visible to an authorized owner, but
the engine rejects API requests scoped to that inactive environment. The
details route unconditionally requested networks and policy-manager stacks;
their 403 responses prevented its model from committing and obscured otherwise
authorized metadata and membership information.

The route now waits for globally authorized project and membership reads,
then skips only those two inapplicable scoped reads when the project state is
exactly `inactive`. It returns `null` for the unavailable data and a dedicated
reason flag. The existing details component displays a translated explanation
in all thirteen packaged locales and prevents a cached network from enabling network saves.
Metadata, member and removal action links are unchanged. Active and transitional
states, denied global data, expired sessions and other failures keep the
existing authorization and error behavior.

## Change boundary and verification

Changes are confined to the details route/template, shared details component,
thirteen translations and their three focused test modules. Release-version metadata
and the matching reviewed lock baseline move together; dependencies do not
change. No API, engine, provider, HAProxy, authentication or session contract is
modified. The existing ended log/terminal and cross-tab session tests are
retained.

Added regressions cover inactive view/edit, globally denied project/member
reads, non-inactive scoped denial, the actual details-template reason flag and
stale-network write prevention. [Formal exact-source CI 37273270200](https://github.com/PastureStack/web-console/actions/runs/37273270200)
passed 848/848 tests with zero failures, skips or todo, including seven new
inactive-project and seventeen retained ended-workspace cases. Both production
archives and the anonymous public download are byte-identical.

## Published identity

- [Numeric lightweight tag 1.6.178](https://github.com/PastureStack/web-console/releases/tag/1.6.178)
  binds signed source `60a494e943150ecd300d1aa653ee397f590b575b`; it is not a signed tag.
- Reviewed tree `26f727e39de73cc217494e3544d94a9881960195`; normal PR #177 squash
  merge `f8ac3e2bf5854ab854adc1062321bcc16e29d224` has the same tree and a verified signature.
- `web-console-1.6.178.tar.gz`: 2983001 bytes, SHA256
  `7d4476f3ae1ecd455d0de25008b62327d8c2fa02fafe2b5252ce79fb3309d981`.
- Server `v1.6.516` packages this exact component from source
  `e024e054be7371c60d719d0590ca3f5b86bdb6ee`, immutable manifest
  `sha256:3741b7d87273387f36b49e44d407c240658db0ab7fc7fb8d518ae08f55ac733c`.
  Official publisher and independent public artifact readback passed.

The first localization-gate failure remains recorded; missing keys were repaired,
not exempted. Build advisory GHSA-vfj7-8cjw-p6xm retains its 2026-10-10 review
deadline; static absence of affected build modules is not a global zero-CVE claim.

## Isolated QA and bounded native observations

The actual isolated Server516 deployment reached HTTP 200/pong after ten bounded
probe attempts at first start and ten after restart, not 200 on every probe.
Runtime settings and five core-table counts have zero differences. Existing
AppArmor, three named volumes, environment and `unless-stopped` remain.
Docker health is null, not healthy; no company-site deployment is claimed.

One existing inactive environment showed native detail/reload, write-free
edit/remove cancellation, one native DELETE 200 and three full guard
acknowledgements. Native delete finalization and list/reload absence completed
without browser errors. The parent still recorded HOLD after its cleanup wait
timed out. A separate read-only database observation confirmed the environment
and four networks were purged, with no remaining members or dependent resources.
Three foreign host-row hashes differed and were not excluded or classified as
harmless. Fresh API and complete foreign-data preservation verification remain
incomplete. These observations are not a complete native lifecycle PASS and do
not promote historical HOLDs. Full role/resource/locale acceptance remains INCOMPLETE.
