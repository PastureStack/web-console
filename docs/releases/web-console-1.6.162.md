# Web Console 1.6.162

Published numeric component release. Packaged browser acceptance remains
pending; publication does not declare a Server deployment ready.
Source: `46501e31071b3d74595aea91908876eec32b7fd6`.
Archive SHA-256:
`9c5b34d2cdf7ad354e1dab199795b12e5de119e47dc342547d5cdc84c7911581`.
The [numeric release](https://github.com/PastureStack/web-console/releases/tag/1.6.162)
publishes the [archive](https://github.com/PastureStack/web-console/releases/download/1.6.162/web-console-1.6.162.tar.gz)
and its [SHA-256 file](https://github.com/PastureStack/web-console/releases/download/1.6.162/web-console-1.6.162.tar.gz.sha256).

## Narrow desktop fixes

The Secrets table's State, Name, Description and Created desktop headers use
the existing generic translation keys. Their fallback display names, column
names, sorting, search fields, widths and existing QA mappings are unchanged.
No new translations or shared table-component changes are introduced.

The Host-detail Add Container link now follows the current environment's
loaded container-create capability. Missing or stale schema readiness and a
schema reload that removes POST permission hide the link. Roles whose current
container schema permits POST retain the same link and selected Host query.
The existing Container-list, Host-card and direct Add-route capability checks
are unchanged. This is not a role-name rule or a backend authorization change.

## Source validation and remaining acceptance

Focused native Chrome 153 source validation passed Secrets 2/2 tests and Host
8/8 tests. The Host filter executed four new cases plus four adjacent existing
cases, not only the four new cases. Tests cover schema readiness, create
capability, environment switching, same-environment schema generations and
preservation of the Secrets table's legacy fields.

Two additional narrow rendering checks passed 2/2 using the actual Host template
and the actual desktop table-header translation chain, separately from the
preceding controller tests and from packaged acceptance.
[Official CI 36810596087](https://github.com/PastureStack/web-console/actions/runs/36810596087)
passed 746/746 tests and produced two byte-identical archives from the pinned
source. The published archive's hash and size match that reviewed candidate.

Responsive/mobile Secrets data-title labels still use the shared component's
legacy displayName mechanism and are outside this fix. No mobile or
all-language layout acceptance is claimed. The Host template rendering test
checks link visibility and query binding, not server write authorization.

No API, authentication, session, OIDC, MFA, database, stored-data, runtime-host
or VM contract changes are included. The earlier HOLD receipts remain HOLD;
the broader resource/role matrix remains INCOMPLETE. Current Server packaging
remains `v1.6.495` / Web Console `1.6.161`; packaged desktop acceptance of this
release and backend-write acceptance remain separate and are not claimed.
No company-site deployment is authorized.
