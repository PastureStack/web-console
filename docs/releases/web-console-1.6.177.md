# Web Console 1.6.177

Status: source repair; formal exact-source CI, immutable publication, Server
packaging and isolated browser acceptance are pending. No production deployment
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

Dependency versions and graph, workspace service/persistence format, API
contracts, permission checks, generation/mutex and MFA are unchanged. Root
version metadata and existing executable/reviewed-baseline pins become 1.6.177.
Release commit, archive SHA256 and the Server image digest will be reported only
after publication and public readback. Retain existing configuration, named
volumes and immutable rollback images.
