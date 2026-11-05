# Web Console 1.6.213 / Bridge 0.2.15 published

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
The matching Engine remains v0.183.373. Original Web213/Bridge0.2.15 assets and
the GitHub release body remain immutable; Web214/Bridge0.2.16 supersedes the
bound-profile bootstrap without replacing this release.

Focused source controls are separate from required CI and native acceptance.
Platform and weak-model workflow verification remain separate and pending;
this change does not establish whole-243-group completion.

Publication used producer `a0db85adeef666842a5e2b142667bf68a30b5974`, normal
merge/tag target `8b7abfc3846cbbc822d0e4e97e1ec075532e94d8` and tested tree
`e5eaf04ab4819fb77311f08da616c980a755f3c3`. Original CI passed 1,140 browser
tests and 58 focused methods; thirteen anonymous assets, fourteen native release
subjects and one new SDK handshake passed. This repository note was aligned after
publication and does not change the original release assets.
