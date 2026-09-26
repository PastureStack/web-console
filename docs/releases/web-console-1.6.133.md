# Web Console 1.6.133

Host creation controls now follow the selected environment's `host` create
capability. Read-only and restricted users can inspect permitted hosts without
seeing Add Host or Clone; a direct add-host route stops with a localized 403
before loading machine drivers or registration tokens. This does not change
Server authorization.

The project schema is marked ready only for the matching environment and
request generation. Late schema responses cannot reactivate controls for an
earlier project, including overlapping reloads of the same project. Stack and
service create controls use the same readiness check. Environment detail waits
for the project lookup before requesting related networks and policy-manager
resources, so an unauthorized project does not produce unrelated requests.

The error page keeps a localized title when supplied and fits narrow screens;
right-to-left error text is aligned in the error panel. The new host permission
message is supplied in all 13 shipped locales. No OIDC, MFA, or backend API
behavior changes in this release.
