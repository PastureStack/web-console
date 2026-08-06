# Volume Path and Storage Driver Preflight

The service and standalone-container forms preserve the existing
`dataVolumes` and `volumeDriver` API contract while adding deterministic input,
completion, and server-side validation.

## User interface contract

The storage driver is a select control. Its first option is Docker local
storage, represented by an empty `volumeDriver`. Other entries are derived
from the current environment's storage-driver and storage-pool resources.
Secret-capable drivers are hidden. Inactive drivers, drivers without an active
pool, incomplete host coverage, and incompatible legacy selections remain
visible only when needed and cannot be submitted.

Every driver description reports its scope, access mode, and active-host
coverage. `pasturestack-nfs` is available only when it uses Environment scope,
reports `multiHostRW`, and has active-pool coverage for every active host.

Volume paths use an ARIA combobox and listbox with no more than eight entries.
Candidates come from, in order:

1. mount specifications already used by services in the current environment;
2. existing volumes belonging to the selected driver;
3. other rows in the current form;
4. safe format suggestions.

Prefix matches precede contains matches. Candidate source priority and natural
ordering then provide stable results, and duplicate values retain the
highest-priority source. Up and Down move the active option, Enter or Tab
completes it, Escape closes the list, and mouse selection keeps the input
focused. The candidate list is rendered below the input and its table cells
explicitly allow overflow so it is not clipped.

The accepted formats remain:

```text
/container/path
volume-name:/container/path
/host/path:/container/path
volume-name:/container/path:ro
```

The client rejects relative or unsafe target paths, unsafe bind sources,
invalid volume names and modes, control characters, overly long values,
duplicate targets, and unavailable drivers. It warns when a selected driver
will create an anonymous volume or when a bind mount bypasses that driver.

## Authoritative validation

The UI calls the project `volumepreflight` action after a 300 ms debounce.
Request sequencing prevents an older response from replacing the newest
result. The response contains only status, driver metadata, host counts, and
localized reason identifiers; it does not expose driver credentials or NFS
connection settings.

Client preflight is advisory. The orchestration engine runs the same
authoritative check again when creating or updating a standalone container,
creating or updating a service, and upgrading a service. This closes the race
between viewing the form and submitting it. The engine contract has dedicated
regression tests for Environment scope, `multiHostRW`, and complete active-host
coverage for `pasturestack-nfs`.

## Localization and regression controls

All 13 supported locales define the driver access-mode label and the existing
service-mount candidate source. Traditional Chinese uses `路徑` for this form
and its tab while storage resources continue to use `磁碟區`; the character
`捲` is forbidden in that locale.

Static release gates require the select-only driver control, candidate source
inventory, keyboard and mouse behavior, ARIA roles, server preflight wiring,
all locale keys, and final API filters. Unit coverage protects parsing,
priority and deduplication, NFS driver rules, environment-mount discovery,
late-response handling, and completion controls.
