---
type: bug
status: todo
id: bug-spec-017-missing-synopsis-blocks-all-prs
title: "spec-methodology-adapters-017.md has no Synopsis/Design section, so the repo-wide spec gate is red on main and blocks every PR"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs, spec]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
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
- [ ] `spec-methodology-adapters-017.md` carries the Synopsis the validator requires, written in the spec's own words (its Purpose + Invariants + Surfaces), introducing no new decisions — or the spec is restructured so an existing section legitimately satisfies the validator.
- [ ] `npm test -t "passes on this repo's real docs"` green, full suite green, and `arggon validate` ok on the same head.
- [ ] Note in the item trail which initiative owns the spec so the author can review the wording rather than find it rewritten under them.
