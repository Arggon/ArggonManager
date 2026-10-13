---
type: task
status: done
id: task-adopter-template-family-followups
title: "Adopter template family follow-ups: CONTRIBUTING / PR-template software locks, zcode goal-mode pre-rename word, guard wording"
assignee: arggon-delivery-lead
branch: feat/task-adopter-template-family-followups
parent: role-model-foundation
labels: [docs, templates, methodology]
created: "2026-10-13"
updated: "2026-10-13"
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

### handoff 2026-10-13 @ses_eca4ef972ffeE9z0kPXAonRJHo (session: ses_eca4ef972ffeE9z0kPXAonRJHo) — next: Lead: review commits 2d9650c4 + d7172414 against the four ticked rows, then merge the PR; auto-done needs the live checklist (ticked).
- branch: feat/task-adopter-template-family-followups
- open questions: goal-mode.ts:316 still renders 'coordinator'; capability-matrix.json:116 (root+template) names old roles. Out of rows; lead decides follow-ups.

### 2026-10-13 @ses_eca4ef972ffeE9z0kPXAonRJHo
### Maker follow-up — CI found the committed-seam drift, fixed (head baca2f4e)

First CI run: `tasks-validate` failed the committed-seam drift gate — regenerating the zcode goal template changed `.zcode-marketplace/arggon/commands/arggon-goal.md`, and the committed copy lagged. Fixed with the remedy the gate names (`npm run build && node dist/cli.js init --no-commit`), commit 55e40c4e. The regenerated bytes also require their x-generated record to move: `cli/src/provenance-audit.test.ts` ("this repo's own committed seam has no ledger violations") refused the stale checksum, so commit baca2f4e refreshes that one record in `ArggonManager/.convention.yml` (the rest of a full init's version/generatedAt churn is pre-existing and excluded by the drift gate).

CI on baca2f4e: `cli` pass, `tasks-validate` pass, `ui-smoke` pass. Local re-verification on the final head: targeted 50/50; full `npm test` 153 files / 3333 tests; lint, test:structure (5), validate (0 warnings), prettier on the touched set — all green.

Open question (pre-existing, not in the four rows): the ledger record for the gitignored `.agents/skills/arggon-cli/references/exploration.md` is stale (`sha256:d9ab2e7d…` recorded, current render `sha256:3553e0c6…`), so the provenance audit fails in any checkout that has run `arggon init` (the file is generated and gitignored; a fresh checkout never sees it, which is why CI is green). Same class as `fd581f9a` ("sync never updates the ledger") — lead decision whether to file.

### handoff 2026-10-13 @ses_eca4ef972ffeE9z0kPXAonRJHo (session: ses_eca4ef972ffeE9z0kPXAonRJHo) — next: Lead: CI green on baca2f4e (cli, tasks-validate, ui-smoke); review commits 2d9650c4/55e40c4e/baca2f4e + ticked rows, then merge.
- branch: feat/task-adopter-template-family-followups
- open questions: goal-mode.ts:316 renders 'coordinator'; capability-matrix.json:116 (root+template) old roles; stale ledger record for gitignored .agents exploration.md copy. All out of rows.

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-13 (delivery lead)
Merged as 52a6a702 (PR #781); auto-done flip landed. The template-family guard now walks the seam subtrees (the #758 exclusion is gone) and really compares all four carriers (blockquote-normalizing `bulletsOf`); CONTRIBUTING/PR-template checks are restated project-neutrally; the goal-mode template uses the shipped role word; the docs-only exemption is a general clause. Negative controls (reverted) proved each clause fires; the anti-shrink walk test is added.
Residual findings filed: task-retired-role-words-product-text (goal-mode.ts:316 product text + the capability-matrix note).
