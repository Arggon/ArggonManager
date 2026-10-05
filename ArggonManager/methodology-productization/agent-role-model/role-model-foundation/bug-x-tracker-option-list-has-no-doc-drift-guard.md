---
type: bug
status: todo
id: bug-x-tracker-option-list-has-no-doc-drift-guard
title: "No test guards the `x-tracker` option list in convention.md against drift — `product-acceptance` shipped implemented-but-undocumented through PR #637's green CI"
parent: role-model-foundation
labels: [tests, docs, cli]
priority: p2
created: "2026-10-04"
updated: "2026-10-04"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-x-tracker-option-list-has-no-doc-drift-guard.md
  Leaves live only under a story. id is the filename stem: bug-x-tracker-option-list-has-no-doc-drift-guard.
  CLI `arggon create bug x-tracker-option-list-has-no-doc-drift-guard` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# No test guards the `x-tracker` option list in convention.md against drift — `product-acceptance` shipped implemented-but-undocumented through PR #637's green CI

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

Found while reviewing PR #637 (`task-role-model-report-only-detector`), raised by the
worker and confirmed by me: the `x-tracker` option list in
`ArggonManager/docs/convention.md` §Tracker hygiene is **prose with no structural guard**.
`cli/src/convention.test.ts` and its siblings assert *parsing behaviour*; nothing asserts
that the documented option list matches the keys `TrackerConfig` actually reads.

The consequence is not hypothetical: `x-tracker.product-acceptance` was implemented and
merged with its option **undocumented** — the flag existed in `lib/src/convention.ts`
while `convention.md` still listed only `auto-commit`, `allow-steal`, `strict-gate-bins`
and `strict-worktree-writes`. The PR's CI was green throughout, including the seam-drift
and docs gates. It was caught by a worker's escalation, not by a test.

That is the same class as the ADR-index drift (`adr-index-parity.test.ts`), which exists
because the index silently rotted three times.

## Acceptance

- [ ] A test derives the official `x-tracker` option list from the type/parser (the single source) and asserts `docs/convention.md` §Tracker hygiene names every key — a new option cannot be added without a doc line
- [ ] The guard covers the **parse-error sentence** too: the keys it enumerates as boolean-only are exactly the boolean keys, so a boolean option cannot ship outside that list
- [ ] The same treatment for the namespaced extensions documented alongside it (`x-views`, `x-playbooks`, `x-import`, `x-worktree`) if the derivation is cheap; if not, say so in the item rather than half-doing it
- [ ] A deliberate escape hatch: an inline marker or an explicit allow-list, documented, so a genuinely undocumented-by-design option is possible and visible in review
- [ ] `npx prettier --check` clean; `arggon validate` + `npm test` green
- [ ] The test reads the doc and the source, not a copy of either — a guard that restates the list in the test is the same bug one level down
