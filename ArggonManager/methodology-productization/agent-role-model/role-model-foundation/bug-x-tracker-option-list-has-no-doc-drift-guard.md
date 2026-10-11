---
type: bug
status: in_progress
id: bug-x-tracker-option-list-has-no-doc-drift-guard
title: "No test guards the `x-tracker` option list in convention.md against drift — `product-acceptance` shipped implemented-but-undocumented through PR #637's green CI"
assignee: arggon-delivery-lead
branch: fix/bug-x-tracker-option-list-has-no-doc-drift-guard
parent: role-model-foundation
labels: [tests, docs, cli]
priority: p2
created: "2026-10-04"
updated: "2026-10-11"
claimed_at: "2026-10-11T09:57:18.134Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-x-tracker-option-list-has-no-doc-drift-guard
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

- [x] A test derives the official `x-tracker` option list from the type/parser (the single source) and asserts `docs/convention.md` §Tracker hygiene names every key — a new option cannot be added without a doc line. `cli/src/convention-option-doc-contract.test.ts` derives the list three ways (the `TrackerConfig` type members, the parser's `key === "…"` branches, the runtime default object) and checks all three agree, then requires the doc's "official options" sentence to name every key.
- [x] The guard covers the **parse-error sentence** too: the keys it enumerates as boolean-only are exactly the boolean keys, so a boolean option cannot ship outside that list. The same suite checks the "an `k1`/`k2` value that is not `true`/`false`" window both directions — this is what forced the `x-worktree.env` and `x-github.issue-roundtrip` doc completions below.
- [x] The same treatment for the namespaced extensions documented alongside it: the derivation is cheap and uniform, so `x-playbooks`, `x-import`, `x-worktree` and `x-github` are guarded the same way (`x-github` is not in the delivery lead's list but has the identical shape — an exactness gap one section down; it is covered here rather than left as a known hole, at the cost of one doc line). `x-views` is the one deliberate exclusion, named with its reason in the suite: its parser accepts any view name, so the option set is the adopter's, not the kernel's. `x-generated` is excluded for the same kind of reason (machine-written state, tolerant parse).
- [x] A deliberate escape hatch: the inline marker `undocumented-by-design` on a parse branch in `lib/src/convention.ts` exempts exactly that key; convention.md §Tracker hygiene documents the marker (added below) and the suite fails if the doc ever stops documenting it. The premise test proves the marker discriminates (same option marked vs unmarked over synthetic branches).
- [x] `npx prettier --check` clean for both changed files (`cli/src/convention-option-doc-contract.test.ts`, `ArggonManager/docs/convention.md`); `arggon validate` green (ok, 0 errors, 0 warnings); `npm test` green (137 files, 2945 passed, after `npm run build` in the worktree — the one pre-fix failure was `headless-ci.test.ts` demanding the prebuilt `dist/`, a worktree gap, not the change). Repo-wide `prettier --check .` reports the same 648 pre-existing warnings before and after this change; the §Tracker hygiene clauses touched here are all prettier-clean.
- [x] The test reads the doc and the source, not a copy of either: the kernel's `lib/src/convention.ts` text (type members, parser branches, boolean-validations), the runtime `parseConventionConfig("")` projection, and convention.md's own enumeration and parse-error sentences. The only literals are the section↔type↔projection table (structure, no option names) and the marker string. Negative control run twice: a synthetic new boolean option in all three kernel faces failed exactly the two doc rules (the PR #637 shape), and went green again once its branch carried the marker; both edits were then reverted.

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

Found while reviewing PR #637 (`task-role-model-report-only-detector`), raised by the
worker and confirmed by me: the `x-tracker` option list in
`ArggonManager/docs/convention.md` §Tracker hygiene is **prose with no structural guard**.
`cli/src/convention.test.ts` and its siblings assert _parsing behaviour_; nothing asserts
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
