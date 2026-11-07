# Web Console 1.6.223 / Bridge 0.2.25

This release adds two workflows to the existing twelve tools:

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

Original CI passed 1,142 browser tests and 126 focused methods with zero failures
or skips. The original static archive, runtime/build SBOMs and their attestations
passed qualification without rebuilding. Thirteen public assets passed anonymous
size/SHA256 readback; immutable-release verification covers fourteen subjects.
Bridge 0.2.25 passed one new real SDK stdio handshake, separately from the
unchanged dependency graph's original clean-install evidence.

The [published metadata](https://github.com/PastureStack/web-console/releases/download/1.6.223/web223-release-metadata.json)
records exact producer, tested tree, tag target and artifact digests. Matched
Server and real native role/Key/CAS/cleanup acceptance remain separate; component
publication does not establish complete frontend coverage.
Preserve the previous qualified Server assembly and operator settings for rollback.
