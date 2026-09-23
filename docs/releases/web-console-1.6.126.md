# Web Console 1.6.126

Web Console 1.6.126 fixes the shared-environment and account-administration
edges exposed by the OpenID Connect permission matrix.

## Zero-environment lifecycle

- An authenticated account with no active environment is a supported empty
  state. Stale tab selection and project API scope are cleared instead of
  rejecting the authenticated route.
- Project schemas, catalogs, secrets, workloads, hosts, storage, and other
  project-scoped collections are not requested until an authorized environment
  exists.
- Environment refresh now returns the full reselection Promise, so revocation
  cannot leave a stale store base URL or finish before the new authorization
  state is applied.

## Account identity presentation

- A non-empty account name remains authoritative. When it is absent, linked
  login identity fields are considered in the exact order `name`, `login`,
  and `externalId`, followed by the local username and legacy account field.
- Descriptions remain operator-owned account data. OIDC identity names, login
  names, and e-mail addresses are never used as a description substitute.
- Identity blocks avoid duplicate name/login text and always expose a useful
  accessible label. Loaded identity links remain display-only and are excluded
  from account update payloads.

## Verification boundary

The release adds route, project service, account model, and identity component
regressions for direct URLs, stale preferences, revoked environments, empty
inventories, fallback order, accessible labels, and API serialization. The
complete browser test suite must remain green before packaging. Server runtime
acceptance additionally uses independent direct-user and OIDC-group accounts
for each environment role, checks the real environment dropdown, and compares
visible projects and stacks as exact sets.

Use this release with Orchestration Engine `0.183.319` and PastureStack Server
`v1.6.462`. No HAProxy or identity-provider configuration change is required.
