# Web Console 1.6.177

Status: published component and Server 515 packaging, with independent public
readback. Separate isolated Server 515 / Web 177 deployment/readback passed;
native browser lifecycle acceptance remains pending. No production deployment
is authorized by this change. The complete permission/resource matrix remains
INCOMPLETE; historical HOLD results are not rewritten.

## Root cause and repair

An ended log entry could reopen a WebSocket on a non-creating reconnect.
A terminal entry could probe the missing broker and create another session.
An access ticket or broker response arriving after end could also restore a
connecting/error state. Already queued socket and timer callbacks did not retain
their original entry identity.

Both components now use `workspace-connection-lifecycle` to stop inactive work,
cancel reconnects, close the owned socket and disable terminal input after end.
Ticket/broker continuations, socket callbacks and timers retain their original
entry. Socket/timer identity checks keep obsolete callbacks from touching a
replacement. End is not a permanent component shutdown: explicitly opening a
new entry and reconnecting a live session still work.

Changed product files:

- `app/mixins/workspace-connection-lifecycle.js`: shared ended/identity boundary.
- `app/components/workspace-logs/component.js`: adopt the boundary and retain
  entry/socket/timer ownership; reject an already-ended create response.
- `app/components/workspace-terminal/component.js`: the same lifecycle boundary
  across probe/create/connect and queued callbacks.
- `tests/unit/components/workspace-ended-lifecycle-test.js`: 17 targeted
  real-component regressions using deferred responses and the native run loop.

## Verification boundary

Local Chrome 153 ran 17/17 targeted tests with zero failures, skips or todo.
The tests cover ended remount/reconnect, deferred ticket/broker success and
failure, ended broker response, queued frames/timers, old-entry replacement,
late terminal probes and the live/new-entry controls. Babel parsing and
`git diff --check` passed. No test JWT or broker secret is written to evidence.

## Published coordinates

- Signed source commit: `b9b841e65afe1d89a5b03ac767e9168bccd3c3ea`.
- Reviewed tree: `109a60fc005d9dc18e38864089dd0055980485c3`.
- Normal PR #175 squash merge: `5d150806be20226657e5caa8a0150d068006c772`,
  with the same tree and a verified signature.
- Numeric lightweight [tag 1.6.177](https://github.com/PastureStack/web-console/releases/tag/1.6.177)
  binds that signed source commit; it is not a signed tag.
- [Formal CI 37255121243](https://github.com/PastureStack/web-console/actions/runs/37255121243):
  841 tests passed with zero failures/todo, including 17 new lifecycle regressions;
  both CodeQL checks passed. Two production archives were byte-identical.
- Public `web-console-1.6.177.tar.gz`: 2,982,494 bytes, SHA256
  `4e34eb2b3165f078134cddcf1721239b3da7baf11dd683991b2d6aa5bae944e0`.
  Anonymous HTTP 200 readback matched the formal CI archive.
- Published [Server 515](https://github.com/PastureStack/server/releases/tag/v1.6.515)
  packages this exact component, from source
  `f0267ff3a347ea526088db1749b1d3c8dfd9bd37` and immutable manifest
  `sha256:fcc79f616927040ef2b3a5c58662fa948823220dbc57ffe275dee2ad88764d47`.
  Official publisher 37256753740 and independent artifact/runtime/security readback passed.

These are source, publication and artifact checks, not deployed browser lifecycle
or complete permission/resource acceptance.

## Isolated deployment boundary

The exact published Server 515 / Web 177 image was deployed and independently read
back on the isolated QA site. Initial-start and restart polling reached HTTP 200/pong
after 10 and 11 attempts, respectively.
Runtime configuration, environment overrides, three named persistent volumes and
five core-table counts were preserved. `docker-default`, bridge networking,
`unless-stopped`, database backup and the 514 rollback image/container remain.
There is no Docker Healthcheck (`health` is null): running/pong is not Docker healthy.

This scope is deployment preservation, not native workspace or container lifecycle
acceptance. Those browser checks remain pending. Earlier incomplete attempts and
historical HOLDs are unchanged; the full matrix remains INCOMPLETE.

A separate fresh Project v2 native run remains HOLD. Native creation returned
HTTP 201; edit cancellation issued no additional resource write. Save PUT and
set-members POST returned HTTP 200, with the saved description preserved after
reload and save ownership released. Deactivate, the fourth resource write,
returned HTTP 200, but the following UI wait timed out. Five guard captures were
retained. Native removal and database cleanup were not completed; these partial
observations do not establish complete Project lifecycle or full-matrix PASS.

Dependency versions and graph, workspace service/persistence format, API
contracts, permission checks, generation/mutex and MFA are unchanged. Root
version metadata and existing executable/reviewed-baseline pins become 1.6.177.
The published source, archive and Server identities above were independently
read back. Retain existing configuration, named volumes and immutable rollback images.
