# Operator-Selected Storage Removal

The host storage page supports explicit checkbox selection and one bulk
removal action. It does not guess whether a detached item is unused from its
name.

The table provides:

- state filters for all, active, and detached rows;
- search across the state and host path;
- natural sorting;
- 10, 25, 50, and All page sizes;
- a select-all checkbox scoped to the current filtered page;
- a selected-item count and a single Remove Selected action.

A row can be selected only when it is detached, is not already being removed,
is not attached directly to an instance, has no active non-removed mount, and
the API advertises a `remove` action. Active rows remain visible but cannot be
selected. The enabled or disabled checkbox communicates this eligibility
directly, so there is no second state filter that duplicates the detached
view. Names such as `backup`, `restore`, or `test` do not silently select or
exclude a row; the operator makes the final decision.

The confirmation dialog previews the selected names before any request is
sent. Removal uses the public resource action with at most four concurrent
requests and never mutates a database directly. Progress and per-item failures
remain visible until the operator closes the result.
