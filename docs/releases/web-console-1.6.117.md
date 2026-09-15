# Web Console 1.6.117

- Separate explicit user logout from passive authentication failures. Only the
  explicit path sends `DELETE /token/current`; 401, storage, WebSocket, timer,
  and route events never revoke a server token, while 403 remains a permission
  error rather than a global logout.
- Add a high-entropy, non-sensitive browser session generation. Web Storage
  contains only the generation, account ID, and commit time; JWT values remain
  in the secure cookie and per-tab memory.
- Serialize login acceptance, cookie readback, generation commit, adoption, and
  explicit logout with Web Locks or a verified IndexedDB lease fallback. The
  fallback fails closed if mutual exclusion cannot be established.
- Capture the generation before an OIDC redirect and carry it in the tab-scoped
  transaction. A delayed callback, request, timer, or socket event cannot clear
  or replace a newer committed session.
- Let waiting tabs validate `GET /v2-beta/token`, adopt the newer session, and
  safely replace login/MFA/callback routes or reload their existing protected
  route without loops. Manual refresh rebuilds the same session from the cookie
  and committed metadata.
- Validate non-empty JWT responses and cookie readback before committing login;
  failed writes never create `token=undefined` or a half-session.
- Deterministic browser-unit coverage includes 100 alternating TOTP/Passkey
  delayed-response races, three-tab adoption, same- and different-account
  replacement, duplicate passive failures, refresh, storage/socket/timer/route
  events, stale OIDC callbacks, cookie repair, and coalesced explicit logout.
- Pair with Orchestration Engine `0.183.302` or newer. New tokens carry the
  client session generation so older JavaScript cannot revoke a newer bound
  token.
