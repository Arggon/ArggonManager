---
type: task
status: in_progress
id: task-adopter-template-family-followups
title: "Adopter template family follow-ups: CONTRIBUTING / PR-template software locks, zcode goal-mode pre-rename word, guard wording"
assignee: arggon-delivery-lead
branch: feat/task-adopter-template-family-followups
parent: role-model-foundation
labels: [docs, templates, methodology]
created: "2026-10-13"
updated: "2026-10-13"
claimed_at: "2026-10-13T14:34:48.021Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adopter-template-family-followups
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-adopter-template-family-followups.md
  Leaves live only under a story. id is the filename stem: task-adopter-template-family-followups.
  CLI `arggon create task adopter-template-family-followups` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adopter template family follow-ups: CONTRIBUTING / PR-template software locks, zcode goal-mode pre-rename word, guard wording

## Context

Leftovers from `bug-adopter-engineering-template-software-locked` (merged as PR #758), reported by the maker and the standards review rather than widened into that fix:

- `templates/docs/CONTRIBUTING.md:32` — "- [ ] Tests pass locally (`npm test` or the project equivalent)" still names the software noun first, and `templates/docs/github/PULL_REQUEST_TEMPLATE.md:18` — "- [ ] Tests pass locally" — has no project-equivalent escape at all.
- `templates/docs/zcode/arggon/commands/arggon-goal.md:29` — "so the coordinator can follow the claim": a pre-rename role word surviving in a shipped seam template, in the subtree the new family guard excludes.
- The new guard's header overstates what it compares (README bullets are plain list items, not blockquote-prefixed).
- The docs-only exemption moved inside the software worked example in `templates/docs/docs/engineering.md`.

## Acceptance

- [x] `CONTRIBUTING.md` + `PULL_REQUEST_TEMPLATE.md` restate their checks as what the project declares (software case kept as a worked example)
- [x] the zcode goal-mode template uses the shipped role vocabulary; the family guard covers the seam templates or the exclusion is named with its reason
- [x] the guard header describes exactly what it compares; the docs-only exemption is lifted out of the software example
- [x] `cli/src/adopter-template-invariant-drift.test.ts` + init-docs tests green; `arggon validate` ok; prettier clean on touched files

## Notes

### 2026-10-13 @ses_eca4ef972ffeE9z0kPXAonRJHo
### Maker evidence — task-adopter-template-family-followups (branch feat/task-adopter-template-family-followups)

Files (6 + item; commit 2d9650c4, tracker tick d7172414):
- `templates/docs/CONTRIBUTING.md:32`, `templates/docs/github/PULL_REQUEST_TEMPLATE.md:18` — check restated as "The verification this project declares passes locally (software worked example: `npm test` or the project's equivalent)".
- `templates/docs/zcode/arggon/commands/arggon-goal.md:29` — "coordinator" → "delivery lead".
- `templates/docs/docs/engineering.md` — "Docs-only changes are exempt from the end-to-end check: there is no behavior change to exercise." lifted out of the _Worked examples (software)_ line into a general clause.
- `cli/src/adopter-template-invariant-drift.test.ts` — family walk now covers `templates/docs/{opencode,zcode}` .md (PR #641 merged, so the #758 exclusion only hid the defect); REQUIRED_MEMBERS adds one seam member per subtree; `bulletsOf` normalizes away the blockquote prefix so README's plain list items are actually compared, and the four-carrier clause asserts every carrier contributes.
- `cli/src/init-docs.test.ts` — two assertions: the CONTRIBUTING/PR rows say what the project declares (not "Tests pass locally"); the docs-only exemption is outside the software worked example.

Gates (in the worktree):
- `npm run build` — ok
- `npx vitest run cli/src/adopter-template-invariant-drift.test.ts cli/src/init-docs.test.ts` — 2 files / 50 tests passed (baseline: 48)
- `npm test` — 153 files / 3333 tests passed
- `npm run lint` — clean; `npm run test:structure` — 5 passed
- `npm run arggon -- validate` — ok, 0 warnings
- `npx prettier --check` on the six touched files — clean

Negative controls (guard keeps teeth; each probe reverted):
- "The coordinator decides." appended to a seam template → FAIL "uses the pre-rename role word \"coordinator\"" (the #758 exclusion let this class ship green).
- README Invariants bullet reworded → FAIL "expected 2 to be 1" (README was invisible to bulletsOf before; now compared).
- re-adding the old exclusion to the walk → FAIL the "walks the whole family … seam subtrees are covered" anti-shrink test.
- CONTRIBUTING reverted to "Tests pass locally" → FAIL the new init-docs assertion.

Not in the diff, reported for the lead: `cli/src/goal-mode.ts:316` still renders "let the coordinator flip the item" in the goal contract; `adapters/capability-matrix.json:116` and its template copy name "(coordinator, worker, reviewer)". Same class, outside this item's four rows.
