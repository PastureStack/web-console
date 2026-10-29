# Web Console 1.6.197

This maintenance release repairs actor restoration when a valid cookie opens
a fresh browser session. The current-token response can contain a verified
identity while omitting `accountId`; its policy headers identify a virtual
token account. After identity validation, the console reads the authenticated
API root's `X-Api-User-Id` to recover the real actor. It does not decode the JWT
or use a client-supplied identity as an account ID.

A legacy shared session with a null actor is repaired only while its cookie
and generation still match under the existing session mutex. Delayed replies
cannot replace a newer login. Login-options responses remain unauthenticated,
and permission failures keep their existing handling. Ordinary credential and
MFA login flows are unchanged.

The AI collaboration build ceiling remains an explicit producer option, and
each browser page still starts with tools paused. Human approval remains a
normal authenticated UI action. The standalone bridge 0.1.0 and its shared
command-engine sources are unchanged; this release does not republish it.

The [release assets](https://github.com/PastureStack/web-console/releases/tag/1.6.197)
include the static archive, source/profile manifest, checksums and separate
runtime/build SBOMs. Server assembly and deployed-runtime acceptance remain
separate from the browser component release.
