# Web Console 1.6.150 source changes

Certificate Edit sends only `name`, `description`, `cert`, `key`, and
`certChain`. Existing RegistryCredential Edit sends only `publicValue` and
`secretValue`. Both continue through the shared NewOrEdit save lifecycle and
display existing form errors. Explicit empty edits remain explicit; neither
form resubmits the cloned resource's identity, lifecycle state, timestamps,
registry metadata, or other server-owned fields.

The missing-credential Registry Edit path still reads back the credential
collection before its first POST and keeps its uncertain-write retry guard.
Registry creation, Certificate Add, OIDC, session handling, and other forms
are unchanged.

Focused Chrome unit tests cover both narrowed bodies and the missing-credential
path. Isolated 8080 browser/API acceptance and Server packaging are separate
release gates; this source note does not claim they have passed.
