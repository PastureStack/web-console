# Web Console 1.6.190

The Archive switch on the Stack list includes archived Stacks and Services. Its
default is off, and each user's choice is stored separately for each environment.
Archived badges, confirmation dialogs and Restore actions retain direct detail
access and distinguish hidden counts from actual resource totals. Archive text
is supplied in all thirteen production locales.

Archive updates send only the `archived` flag and require a compatible server
with the existing update capability. The server enforces stopped-workload,
system-resource, parent and association restrictions. Restore the resource and
its parent Stack before starting it or adding children. Restoring a Stack keeps
independently archived Services archived. Archiving does not stop, delete or
recreate workloads; mounted-directory and volume contents need operator backups.

## Verification and publication

The focused Archive component set passed 37 logical cases: 36 unaffected results
are carried from the original invocation, and the affected RTL style case has
its focused rerun. A later warning-style correction has separate rendered
layout/contrast evidence. The receipt's implementation, test and translation
source hashes match this release source; those tests were not replayed merely
for the version bump. A fresh production build and the existing static package
contract verify the versioned artifact. These component results do not establish
a complete role/lifecycle matrix or packaged Server acceptance.

Server `v1.6.537` is planned to package this component with Engine `v0.183.350`.
Its publication, packaged acceptance and deployment remain separate gates.
Exact producer and archive identities will be recorded from the immutable
release build. Prior component identities remain in
[the compatibility contract](../../COMPATIBILITY.md).
