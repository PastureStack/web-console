# Web Console 1.6.241

This release retains the load-balancer rollback fix from 1.6.240 and publishes
the Server-compatible AI collaboration profile: capability ceiling `enabled`,
with every new page's browser tools initially `off`, matching the 1.6.239 profile.

The immutable 1.6.240 archive was built with an `off` ceiling and does not satisfy
the Server's existing `enabled/off` artifact contract. Version 1.6.241 selects
`webmcp_mode=enabled` explicitly in the release producer; workflow defaults remain
unchanged. Application, configuration, vendor and test source are unchanged.

The original archive and runtime SBOM are checked with the Server's unchanged
`verify-web-console-sbom.py --webmcp-ceiling enabled` contract before publication.
