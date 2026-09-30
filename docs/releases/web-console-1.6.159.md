# Web Console 1.6.159

Isolated Server v1.6.492 API acceptance found that both v1 and v2-beta return
`secretValue: null` when reading an existing Registry credential. Web Console
1.6.158 copied that value into the Edit Registry form and always included it
in the credential PUT. On the API's partial-update contract, omission preserves
the password while an explicit null or empty value may clear it. Changing only
the username could therefore clear the existing password. The isolated test
stopped before forwarding a browser write and removed its disposable fixture.

The existing-credential editor now starts with a blank password input. Its
update payload always contains the editable username, but includes
`secretValue` only for an explicitly entered nonempty string. Blank, null and
missing values are omitted. Literal whitespace in a replacement password is
preserved through validation. A translated hint explains that leaving the
field blank keeps the existing password. This editor does not offer an implicit
clear-password operation.

Exact credential ID, parent Registry, active project and fresh API update-link
checks remain in place. Creating a missing credential keeps its existing POST
flow and uncertain-write safeguards. No Server API, authorization, OIDC, MFA,
session or proxy contract changes are required.

Focused headless Chrome QUnit tests passed 7/7 with the
`/edit-registry|registry-save/` filter. Both localization-quality and
Traditional Chinese completeness source checks passed.
The tests cover username-only edits with null, undefined and blank password
values, explicit password replacement, whitespace preservation, clone
isolation and existing capability/parent checks. Source tests, official
archive publication, Server image packaging and real browser acceptance are
separate gates; no full resource or role-matrix completion is claimed here.
