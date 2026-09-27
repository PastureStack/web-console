# Web Console 1.6.143

Creating a private ProjectTemplate from Default now constructs a new record
containing only editable fields. Its initial stacks are deep-copied, so editing
the new template cannot mutate Default in the browser. The create request no
longer carries Default's server-owned creation time, lifecycle state, ID, UUID,
or external catalog identity.

This is a client-side create-flow correction. It changes no Server authorization,
authentication, API schema, database, or existing template. The isolated 8080
QA installation must still verify Add/Edit/Remove, cancellation, role denial,
readback, and cleanup before this behavior is considered accepted.

The shared new-resource clone helpers now remove server-owned identity and
lifecycle fields from Host, Service, Container, and VM create copies. Existing
edit and upgrade copies are unchanged. Receiver cloning now drops inactive
driver configurations, including `forwardPost`; a source driver without a
supported form fails clearly rather than opening an unsafe Save button.
