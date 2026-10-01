# Release runbook — publishing `arggon-manager` + `@arggondev/lib`

> **Superseded by automation (ADR 0018, `task-release-workflow`).** The manual
> bump/tag/publish procedure this page used to carry is gone: releases are now
> proposed by release-please and published by
> [`.github/workflows/release.yml`](../../.github/workflows/release.yml).
> **The operator procedure lives at the repo root
> [`release.md`](../../release.md)** — read it there. This page keeps only the
> invariants that outlive the automation.

## Invariants (still binding)

- **`CHANGELOG.md` is append-only** — a release adds its section at the top and
  never rewrites older sections (the release flow asserts it; older sections
  must stay byte-identical).
- **Never move or delete a release tag** — `vX.Y.Z` is the release of record;
  the CI guard fails loudly if a shipped version is re-shipped from a different
  commit, and re-tagging would break every pinned adopter install.
- **Never unpublish** — npm unpublish is off the table for released versions;
  a bad release is fixed by a new release.
- **Owner-only irreversible decisions** — npm publishes and GitHub Releases are
  owner-run or owner-configured (npmjs.com trusted publishers); everything else
  in the flow is automation.
- **Merge the release PR by itself** — the guard classifies the pushed HEAD
  commit; a version bump buried under later commits in the same push silently
  strands the release (the bump never lands at HEAD).

## Version bump rules (for the release PR's changelog)

- **major** — convention/schema break: existing legacy `tasks/` trees need the
  `arggon migrate --layout` move to keep working.
- **minor** — new commands, new templates or template changes, methodology
  changes, or any new adopter-facing feature.
- **patch** — bug fixes with no adopter-facing surface change.
