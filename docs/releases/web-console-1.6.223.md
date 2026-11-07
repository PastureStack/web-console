# Web Console 1.6.223 / Bridge 0.2.25 candidate

This source candidate adds two workflows to the existing twelve tools:

- Replace or clear an ordinary Service's dependency links using returned
  Service references. Preview shows the complete before/after set; duplicates,
  foreign targets and stale configuration cannot be silently accepted.
- Activate or deactivate a Registry through its native lifecycle action.
  Public results and review fields exclude credentials and private configuration.

Both use the existing query, preview, normal human confirmation, apply and
operation-observation flow. Native roles and current API Key scope remain the
maximum authority. Engine 0.183.383 or newer and a qualified matching Server
assembly are required. Registry removal and credential edits are not included.

Browser and stdio contracts share the same closed inputs and labels. Existing
translated labels are reused across thirteen locales; their source-key checks
do not establish native multilingual layout acceptance. No new dependency or
public tool is added. Feature ceilings and page-level opt-ins remain unchanged.

Focused source/overlap tests are retained separately from formal CI, immutable
publication and real native role/Key/CAS/cleanup acceptance, which remain pending.
The published installation baseline is Web Console 1.6.222 / Bridge 0.2.24.
Preserve the previous qualified Server assembly and operator settings for rollback.
