# Web Console 1.6.175

Candidate only. Formal exact-source CI, signed numeric release, reproducible
archive and Server packaging are pending. Local tests do not establish packaged
UI acceptance or full permission/resource/locale acceptance.

## Root cause and minimal repair

The child image form refreshed its own `imageErrors` when an operator corrected
the image, but `new-container` retained the previous required message in its
parent error aggregate. The same stale copy could remain after a locale change.

Keep a private snapshot of non-image validation errors and observe the existing
image-error array. Refresh the parent only while it still owns the exact aggregate
it created. A later backend error replaces that array and is not overwritten.
The non-image snapshot preserves model and command errors, even when their text
matches the image error. No shared NewOrEdit change, new save hook, wire-format
change, authorization change or backend patch is introduced.

Four new real-component QUnit tests cover VM/container correction, preservation
of non-image errors, locale replacement and a real save failure/errorSaving hook
followed by image correction. Local Chrome 153 passed 17/17 related tests with
zero failures, skips or todo. The full CI count is not yet a verified result.

Dependency versions and the dependency graph are unchanged. Package metadata
changes only the root version. Existing session generation, mutex, session-bound
logout, OIDC, TOTP, Passkey, permissions, hardware payload and save ownership
remain intact. The full matrix is INCOMPLETE; historical HOLDs are preserved.
Executable version gates and the reviewed lockfile baseline carry the same
1.6.175 root metadata; no previous-release version pin is reused for this build.
Keep configuration, volumes and rollback artifacts. No company deployment is
authorized by this source change.
