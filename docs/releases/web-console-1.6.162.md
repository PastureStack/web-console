# Web Console 1.6.162

Preparation only. Official CI, publication and packaged browser acceptance are
pending; this note does not declare an artifact or deployment ready.

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

Two additional narrow rendering checks use the actual Host template and the
actual desktop table-header translation chain. Their results are recorded
separately from the preceding controller tests and from packaged acceptance.

Responsive/mobile Secrets data-title labels still use the shared component's
legacy displayName mechanism and are outside this fix. No mobile or
all-language layout acceptance is claimed. The Host template rendering test
checks link visibility and query binding, not server write authorization.

No API, authentication, session, OIDC, MFA, database, stored-data, runtime-host
or VM contract changes are included. The earlier HOLD receipts remain HOLD;
the broader resource/role matrix remains INCOMPLETE. Packaged desktop checks
on the subsequent Server artifact remain required. No company-site deployment
is authorized.
