# Web Console 1.6.213 / Bridge 0.2.15 candidate — not published

Service and load-balancer resource detail now includes the same opaque Stack
relationship reference and parent-resolution state as discovery. Follow
`get_resource(parentRef)` to read the current authorized Stack name before
selecting a same-name resource. The shared browser and stdio engine uses the
fresh typed resource-view response, not an earlier display path or cached label.

Unavailable parent names stay unavailable. A relationship reference never grants
parent access: each parent read retains native authorization, Key scope/revision
and session/context checks. Moving a resource yields its current parent reference;
old-session references remain stale. No raw parent IDs, hidden names or counts,
resource writes, tool names or native permissions are added.

Catalog parent handling and resources without a Stack parent remain unchanged.
The matching Engine remains v0.183.373. Published Web212/Bridge0.2.14 assets and
root installation instructions stay unchanged while this source is a candidate.

Focused source controls are separate from required CI and native acceptance.
Platform and weak-model workflow verification remain pending for this candidate;
this change does not establish whole-243-group completion.
