# Guarded Storage Cleanup

The host storage page provides a bulk cleanup action for explicit test debris.
It is intentionally narrower than a general "remove every detached volume"
operation because a detached item may still contain a backup, recovery point,
or temporarily unused application data.

An item is eligible only when all of the following are true:

- its API state is `detached`;
- it has not already been removed;
- it is not attached directly to an instance;
- it has no active, non-removed mount;
- the API advertises a `remove` action;
- its name contains a delimited test-purpose marker such as `test`, `smoke`,
  `e2e`, `poc`, `validation`, `candidate`, `preview`, `demo`, `ci`, or `fail`;
- its name does not contain a protected marker such as `backup`, `restore`,
  `rollback`, `production`, `prod`, or `current`.

All other detached items remain protected. The confirmation dialog shows the
candidate count, a preview of names, and the number of excluded detached items
before any request is sent. Removal uses the public resource action with at
most four concurrent requests; it never mutates a database directly. Progress
and per-item failures remain visible until the operator closes the result.

The workflow is safe by default, not an assertion that every excluded item is
still needed. Ambiguous items require separate operator review.
