# Web Console 1.6.214 / Bridge 0.2.16 candidate — not published

Bound Bridge profiles now perform one project collection discovery to obtain the
current server-verified dedicated-Key purpose and policy revision before reading
the exact bound Project. The discovery response never selects a project, chooses
a name, follows another page or replaces the saved endpoint, ID or opaque UUID.
An empty discovery result is valid; the subsequent exact Project GET decides
visibility and verifies the active, nonremoved server identity and current name.

The same handshake applies when explicitly writing a new profile from an already
bound one. Initializing from a legacy unbound profile retains its existing name
selection and ambiguity checks. No profile is automatically rewritten, and no
native permission, HTTP proxy or public tool is added. Missing purpose/revision,
revocation, a policy revision change, a hidden Project or an identity mismatch
fails closed without a name fallback or target mutation.

The matching Engine remains v0.183.373. The published Web213/Bridge0.2.15 assets
remain immutable. Local focused controls and required CI are distinct from native
and weak-model acceptance; no whole frontend-group completion is inferred.
