# Web Console 1.6.178 — inactive environment details

Status: source candidate; formal publication and deployed native acceptance
are pending. No earlier HOLD is promoted to PASS.

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
stale-network write prevention. Formal exact-source tests, reproducible static
archives, immutable publication and isolated native view/edit/reload/removal
acceptance must be recorded separately. Full role/resource/locale acceptance
remains incomplete.
