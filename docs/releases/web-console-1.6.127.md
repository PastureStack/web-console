# Web Console 1.6.127

This release closes the environment-permission error-display gap exposed by
the OpenID Connect role matrix. It does not change authentication, token
ownership, or the underlying API authorization rules.

- Environment view/edit now reports inaccessible or missing project, member,
  and related data through the existing route error view, without disclosing
  whether an inaccessible resource exists. Server-side loading failures show
  a distinct, understandable temporary-failure message instead of raw API text.
- Project, member, and network-policy save failures use the existing form error
  block. Dependent-save failures explicitly warn that earlier steps may have
  succeeded; the form remains open and the save lock is released.
- Identity search distinguishes an empty successful search from HTTP 401, 403,
  and service failures. It does not falsely label a rejected request as an
  unknown identity.
- All shipped locales carry the corresponding messages. Route-level 401 session
  recovery remains unchanged. Identity search displays an explicit expired
  session message but does not itself initiate a route transition.

Unit coverage exercises the project route, save lifecycle, and identity-search
status mapping. The matching browser matrix and Server packaging are tracked
in the Server release, not inferred from unit tests alone. Pair with Engine
`0.183.320` and Server `v1.6.464`.
