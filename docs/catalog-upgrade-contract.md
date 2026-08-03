# Catalog Upgrade Version Contract

PastureStack stores an installed Catalog stack with an immutable revision-based
external identifier such as
`catalog://pasturestack:infra*healthcheck:0`. The Catalog API resolves that
identifier to the installed display version and returns newer compatible
versions in `upgradeVersionLinks`. The keys are user-facing semantic versions;
the values are the exact version-resource links used to load Compose files,
questions, and localized release notes.

The stack-list update badge and the upgrade form must consume the same
`upgradeVersionLinks` map. A badge may report an available update only when the
map contains at least one non-empty link. The upgrade form must render the
installed revision as a labelled current option and every valid map entry as a
selectable target. It must not infer a target from `defaultVersion`, rewrite the
stored external identifier, or compare image tags in the browser.

The classic `new-select` component must expose grouped and ungrouped content as
class-level reactive computed properties. Assigning a computed-property
descriptor to an instance during `init()` is unsupported by the Ember 6
runtime: the API data remains correct, but the native `<select>` renders only
its prompt. This failure mode caused the stack list to show an update for
Metadata Healthcheck and NFS Storage while their upgrade target lists appeared
empty.

Release validation therefore covers both boundaries:

- mapping a current revision and valid `upgradeVersionLinks` entries into
  version choices;
- rendering those choices through the shared native-select component and
  updating them when the source array changes;
- rendering primitive Catalog enum values as native `<option>` elements and
  continuing through every later question in the upgrade form.

Required-answer validation is value-aware rather than truthiness-based. Empty
strings, whitespace-only strings, `null`, `undefined`, and empty arrays are
missing answers. The boolean value `false` and numeric value `0` are valid
answers. This matters for required enum questions whose YAML options are
booleans: a default of `false` must be deployable without forcing the operator
to select the already-selected option again.

Catalog enum templates must not name an `each` block parameter `option` while
also rendering a native `<option>` element. With the Ember 6 compiler, that
block parameter shadows the HTML element name and turns each string value into
a dynamic component definition. The browser then fails with `Invalid value
used as weak map key`, leaves the enum list empty, and aborts all following
questions. The source gate compiles this template and rejects dynamic-component
bytecode at the enum boundary.

The broader Catalog form gate compiles every application template, rejects a
lexical block parameter that shadows any native HTML or SVG element, verifies
the native controls used by every supported Catalog input component, and scans
application JavaScript for computed-property descriptors assigned to component
instances at runtime. Unit coverage also fixes the required-answer boundary for
`false` and `0`.

Formal acceptance must inspect at least one installed older revision and prove
that its displayed current version, selectable target, target resource link,
and prospective post-upgrade external identifier all describe the same Catalog
template. It must also open a target with primitive enum questions, verify every
choice and every following field, and stop before submitting unless workload
upgrade was explicitly requested.

For a release candidate, acceptance also opens the default revision of every
available Catalog template and compares the rendered control counts with the
Catalog question schema. The matrix must cover boolean, enum, integer,
multiline, password, secret, and string controls; no select may contain an
unlabelled option, and a control interaction must not remove any later
question.
