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

The Node 24 package-lock review baseline changes only its two root version
fields from 1.6.149 to 1.6.150; dependency entries are unchanged.
The QUnit source gate keeps the prior 170-import floor without rejecting an
additional test solely because the import count increased.

Focused Chrome unit tests cover both narrowed bodies and the missing-credential
path. Isolated 8080 browser/API acceptance and Server packaging are separate
release gates; this source note does not claim they have passed.
