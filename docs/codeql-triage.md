# CodeQL Critical and High Triage

PastureStack uses GitHub CodeQL default setup with the extended query suite for
GitHub Actions and JavaScript/TypeScript. The repository setting runs on every
change to the default branch and weekly.

The first complete analysis identified two distinct boundaries:

- Runtime findings were fixed in source. The fixes cover deterministic
  temporary files, linear-time host-name validation, exact GitHub host
  matching, a preloaded repository-root-enumerated static asset map that keeps
  request paths away from filesystem APIs and takes its validated root from the
  harness working directory instead of an environment path, complete
  query-fragment encoding,
  complete noVNC line-break replacement, and unambiguous dagre edge IDs.
- Development-only findings were dismissed only after manual review. These
  cover lockfile-pinned dependency code executed by the isolated Node smoke
  harness, operator-configured development and browser-smoke proxy targets,
  repository-only localization and contrast linters, intentional POSIX
  single-quote behavior, an intentional first credential separator, an ANSI
  backspace byte range, and numeric-only noVNC capability keys. None of these
  paths are included in the production browser artifact.

Every dismissal retains its specific rationale in GitHub's code-scanning audit
record. `scripts/check-ui-codeql-critical-high` prevents the reviewed runtime
fixes from silently regressing. A release candidate remains blocked whenever an
open Critical or High dependency or code-scanning alert exists.
