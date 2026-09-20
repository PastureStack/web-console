# Web Console 1.6.122

Web Console 1.6.122 centralizes the asynchronous lifecycle used by routes,
settings loading, and the 27 create/edit consumers. It replaces page-specific
workarounds with two shared contracts.

## Promise-to-callback boundary

- One RSVP-based adapter defers each task factory, adopts Promises, thenables,
  and plain values, and converts a synchronous throw into a rejection.
- The adapter uses `then(onFulfilled, onRejected)`. An exception raised by the
  callback is therefore preserved and cannot call the same callback a second
  time through a trailing `catch`.
- `PromiseToCb`, authenticated-route `cbFind`, and `settings.load` now share
  that implementation.
- Environment loading uses the supported `followLink('projectMembers')`
  contract. The removed `importLink` call was the first real exception hidden
  by `Callback was already called.`

## Create/edit save lifecycle

- `NewOrEdit.save` returns one awaitable Promise spanning `willSave`, `doSave`,
  `didSave`, `doneSaving`, error display, `errorSaving`, and cleanup.
- Synchronous throws and Promise rejections take the same error path. Callback
  and cleanup exceptions remain observable instead of being swallowed.
- A submission reserves an owner before its first asynchronous turn. A second
  submission, including one that can observe only `saving=true`, cannot start
  persistence or clear the active owner's lock.
- Validation cancellation, save success, handled failure, and duplicate-submit
  outcomes each invoke the optional completion callback exactly once.

## Verification boundary

The clean Node 24 release job runs all 518 browser tests. New deterministic
coverage includes fulfilled, rejected, synchronously thrown, plain-value and
thenable adapter inputs; callback exceptions; concurrent and dependent
`async.auto` tasks; every synchronous and asynchronous save-hook failure;
lock ownership; environment edit/save/cancel; load-balancer edit/save; settings
loading; and authenticated initialization. The asynchronous-source audit must
report zero High and zero Medium findings. The production artifact is built
twice and accepted only when both archives are byte-identical and contain no
source maps.

Use this release with PastureStack Server v1.6.450. No HAProxy, OIDC,
Authentication Service, backend API, database, Cookie, MFA, Passkey, session
generation, mutex, or session-bound logout contract changes are required.
