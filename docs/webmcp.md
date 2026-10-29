# Experimental WebMCP service upgrade

This optional integration is off by default. Build with `WEBMCP_MODE=read-only`
to expose service discovery, or `WEBMCP_MODE=enabled` for the preview and apply
flow. It requires a secure browser context and native `document.modelContext`.
Unsupported browsers continue to use the ordinary console.

The compatible Engine must separately enable `api.ai.service.upgrade.enabled`.
Do not enable the write tools against an Engine without the server-owned upgrade
plan resource. This is cookie-session collaboration with the signed-in user's
normal permissions, not an isolated or reduced-authority AI credential.

## Flow

1. `find_stacks` / `find_services` return names, display paths and opaque refs.
   Duplicate names remain separate candidates. The user selects the intended
   target; no IDs need to be typed.
2. `get_service` returns a limited configuration summary without secrets.
3. `preview_service_upgrade` accepts `serviceRef` and the requested `image`.
   It creates a short-lived, actor-bound plan without upgrading the service.
4. The user reviews the current image, new image and target in the console's
   confirmation dialog. Only the dialog requests approval. There is no tool for
   approving its own plan and no `confirmed` input.
5. `apply_service_upgrade` accepts only `planRef`. The Engine checks approval,
   current permissions and the target snapshot, and accepts the plan at most
   once. The Engine preserves the other launch settings and completes the
   normal upgrade lifecycle.
6. `get_operation` reads the same operation. `accepted`, `running` and `unknown`
   do not mean success. A verified terminal result is required.

Refs are kept in memory and become invalid when the session, route, selected
environment or relevant schema changes. A stale ref is a request to search
again, not permission to guess another resource. Disabling the integration
unregisters its tools without logging out the user or pretending to undo an
already accepted operation.

## Development checks

Run `node scripts/test-webmcp-commands.js` for deterministic production-core and
registration-lifecycle tests. Browser acceptance must additionally exercise the
real Engine, console confirmation dialog, duplicate targets, expired plans,
rejected parameters and actual upgrade result. Model evaluations must record
tool selection and arguments separately from backend rejection and verified
task completion.

This first slice does not expose arbitrary HTTP, JavaScript, shell commands,
resource deletion, policy editing, or the proposed description-edit tool.
