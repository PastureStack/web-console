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

The page-size selector treats its invocation value as read-only. The table
keeps a separate internal effective page size, so choosing All stores the
semantic preference value `0` without attempting to write through the
caller's computed preference. This prevents an Ember property-setter failure
and preserves the same 10, 25, 50, and All behavior for every shared table.

After each successful remove response, the corresponding row is removed from
the current model, filtered result, and selected-item list immediately. A
revision-backed recomputation keeps the visible table and selected count in
sync while the remaining requests continue. Failed rows stay visible and
selected so the operator can inspect or retry them.
