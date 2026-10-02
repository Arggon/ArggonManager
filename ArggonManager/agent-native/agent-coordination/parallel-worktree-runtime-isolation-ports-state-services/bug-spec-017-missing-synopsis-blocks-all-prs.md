---
type: bug
status: done
id: bug-spec-017-missing-synopsis-blocks-all-prs
title: "spec-methodology-adapters-017.md has no Synopsis/Design section, so the repo-wide spec gate is red on main and blocks every PR"
assignee: Arggon
branch: fix/bug-spec-017-missing-synopsis-blocks-all-prs
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs, spec]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
worktree_path: /home/arggon/Projects/ArggonManager-bug-spec-017-missing-synopsis-blocks-all-prs
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-spec-017-missing-synopsis-blocks-all-prs.md
  Leaves live only under a story. id is the filename stem: bug-spec-017-missing-synopsis-blocks-all-prs.
  CLI `arggon create bug spec-017-missing-synopsis-blocks-all-prs` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec-methodology-adapters-017.md has no Synopsis/Design section, so the repo-wide spec gate is red on main and blocks every PR

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
`cli/src/spec.test.ts > spec validate (real docs) > passes on this repo's real docs/specs and docs/plans` asserts the repo's REAL docs validate, so a malformed spec turns every PR's `cli` job red — not just its own. `ArggonManager/docs/specs/spec-methodology-adapters-017.md` (added by 448b31dc, the methodology-productization initiative) has Purpose, Invariants, Surfaces, Acceptance and Non-goals but no **Synopsis** (or Design / Model of data), which `cli/src/spec.ts:167-172` requires: `SPEC_MISSING_SECTION — missing a Synopsis/Design/'Model of data' section`. main is red from this commit onward; it was the cause of PR #589's `cli` failure (that PR's diff does not touch the spec — it is a compose of this one).

## Acceptance
- [x] `spec-methodology-adapters-017.md` carries the Synopsis the validator requires, written in the spec's own words (Purpose + Invariants + Surfaces), introducing no new decisions. Evidence: a `## Synopsis` section sits between Purpose and Invariants, in the house shape (a one-paragraph claim + the ASCII pipeline + the three things that make it a product + the no-dependency clause already stated in the Invariants). Nothing was asserted that the spec does not already say: the pipeline rows name the same surfaces as S1/S2, the matrix and never-overwrite rules are Invariant 3/4 restated, and the kernel-as-enforcement-of-record is Invariant 5.
- [x] `npm test -t "passes on this repo's real docs"` green, full suite green, and `arggon validate` ok on the same head. Evidence: `cli/src/spec.test.ts` 28/28 (the real-docs case now passes: the validator's `SPEC_MISSING_SECTION` for 017 is gone); full suite 2163 green / 118 files; `arggon validate` `ok (0 errors, 0 warnings, convention v5)`; prettier clean on the spec.
- [x] Note in the item trail which initiative owns the spec so the author can review the wording rather than find it rewritten under them. Evidence: the spec was added by 448b31dc (`chore(tasks): file methodology-productization initiative, ADR 0020, spec/plan 017, exploration 018`), i.e. the methodology-productization initiative — that item is the owner and is where the wording should be reviewed; the change is additive prose only, so a reviewer's edit supersedes it cleanly.
