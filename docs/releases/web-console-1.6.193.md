# Web Console 1.6.193

Service-upgrade correction candidate; not published.

The service upgrade form submits only the `upgrade` action after that action
becomes available. It no longer performs a generic save of the service clone,
whose `publicEndpoints` can retain a deleted container's `instanceId` and cause
an unrelated HTTP 422 before the upgrade starts.

The selected primary and secondary launch configurations and batch size,
interval and start-first strategy remain intact. Ports, environment, volumes,
hardware and security settings continue through the same launch configurations.
The common save lifecycle still validates first, retains the saving lock through
upgrade, link persistence and navigation, and completes each callback once.
Failed readiness checks or upgrade actions do not update service links or
navigate. Creation and non-upgrade editing keep the existing persistence path.

All eleven focused native Chrome 155 component tests passed, including six new
cases for stale endpoint clones, action ordering, selected secondary
configurations, full launch settings, failure paths, validation/preflight guards
and completion ownership. Before the fix, the same suite passed eight tests and
failed the three upgrade regressions because generic persistence ran first.
Run this scope with:

```sh
npm test -- --filter "Unit | Component | new container hardware payload"
```

Full CI, publication and Server runtime acceptance remain separate pending
checks; these focused results do not imply their completion.

A complete native Chrome run executed 1,104 tests: 1,101 passed and three Host
tests failed because their fixtures lacked the current capability method or
route context. Those three passed in focused runs after fixture-only repairs;
the 1,101 unaffected results are carried forward. This is not a single all-green
full-suite run, and the product permission and navigation paths were not changed.

The supported toolchain remains Node `24.20.0` / npm `12.0.2`. Two transitive
dependencies use official patch releases: `follow-redirects` `1.16.1` fixes
cross-origin credential stripping for array and custom headers, and
`markdown-it` `14.3.3` fixes pathological reference and inline HTML parsing.
Five focused dependency tests cover the affected inputs and ordinary redirect
and Markdown behavior. The existing seven build-only High findings retain
their prior review; no new advisory exception was added.

API-store compatibility revision 8 retains upstream version `2.8.5` and repacks
the canonical LF source bytes. All 24 package files are checked against source;
22 are byte-identical to the prior Git source and only revision/provenance
metadata changes. The earlier revision 7 archive is retained unchanged.

Active source gates now track the candidate version, the existing API Key
matrix stylesheet with its explicit theme inputs, and the verified template
action and select counts. The Stack warning color uses the equivalent
namespaced Sass function. These corrections retain strict source checks.

The release completes 229 missing API Key policy, access-matrix and audit-query
messages in each of 11 locales (2,519 translations). Existing translations are
preserved. The translations distinguish live account permissions from key-rule
permissions, allow/deny exceptions, additional expiration, allowed versus
completed requests, and clearing previously displayed audit records versus
deleting stored data. Placeholder, HTML and ICU structure remain intact. No
English fallback exceptions were added. Full CI and packaged UI acceptance
remain required before publication.
