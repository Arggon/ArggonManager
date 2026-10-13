---
type: task
status: in_progress
id: task-retired-role-words-product-text
title: "Retired role word survives in product text: goal-mode contract line and the capability-matrix note"
assignee: arggon-delivery-lead
branch: feat/task-retired-role-words-product-text
parent: role-model-foundation
labels: [docs, roles]
created: "2026-10-13"
updated: "2026-10-13"
claimed_at: "2026-10-13T16:40:00.242Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-retired-role-words-product-text
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-retired-role-words-product-text.md
  Leaves live only under a story. id is the filename stem: task-retired-role-words-product-text.
  CLI `arggon create task retired-role-words-product-text` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Retired role word survives in product text: goal-mode contract line and the capability-matrix note

## Context

`task-adopter-template-family-followups` (PR #781, merged) extended the template-family guard to the seam subtrees, but two spots that render role vocabulary sit outside it: `cli/src/goal-mode.ts:316` still renders "let the coordinator flip the item" in the goal contract itself (product text, not a template), and `adapters/capability-matrix.json:116` plus its byte-identical template copy name "(coordinator, worker, reviewer)". Both are the retired pre-rename role word class the guard exists for (ADR 0021 §6.1).

## Acceptance

- [x] the goal-mode contract's rendered text uses the shipped role vocabulary; affected tests/snapshots updated
- [x] `adapters/capability-matrix.json` + its template copy use the shipped ids; `x-generated` checksum refreshed
- [x] a guard covers these spots, or their exclusion is named with its reason
- [x] `arggon validate` + affected suites green; prettier clean on touched files

## Notes

### 2026-10-13 @ses_ec9dcc293ffeyooHsG9CAdABL0
### Maker evidence — task-retired-role-words-product-text (branch feat/task-retired-role-words-product-text)

Files (6, commit 6bbf2fdc):
- `cli/src/goal-mode.ts:316` — the no-goal objective's "let the coordinator flip the item" → "let the delivery lead flip the item" (the shipped role, ADR 0021 §6.1). This is product text the CLI renders, not a template the family walk can see.
- `adapters/capability-matrix.json:116` + `templates/docs/adapters/capability-matrix.json:116` — zcode `docs-travel-with-code` mechanism "(coordinator, worker, reviewer)" → "(`arggon-maker`, `arggon-standards-reviewer`; the delivery lead is the main session)", the ids the bundle actually ships (its README/plugin.json say so). The two copies are byte-identical (`cmp`), new sha256 `d95ed44a0502a4fc0ef42173591194cd872208e18aab2850564be687b5ce15b5`.
- `ArggonManager/.convention.yml` — x-generated record for `adapters/capability-matrix.json` refreshed `sha256:4f4481f7…` → `sha256:d95ed44a…` (destination bytes); the provenance audit's repo-self clause is green.
- `cli/src/adopter-template-invariant-drift.test.ts` — the family walk no longer filters to `.md` (that filter is exactly how the JSON template escaped it); `REQUIRED_MEMBERS` gains `templates/docs/adapters/capability-matrix.json` so the walk cannot be narrowed back to Markdown.
- `cli/src/goal-mode.test.ts` — new "renders the shipped role vocabulary" assertion over the RENDERED contract of both no-goal shapes.

Where the guard landed:
- Matrix (both copies): the template copy is walked by the family guard (`templates/docs/`); the committed copy is pinned byte-for-byte to it by `capability-matrix.test.ts`, so an edit to either that skips the other fails.
- goal-mode.ts: the rendered-contract assertion in the goal-mode suite (the CLI string is not a template).

Gates (worktree, head 6bbf2fdc): `npm run build` ok; focused (goal-mode, adopter-template-invariant-drift, capability-matrix, provenance-audit) 4 files / 87 tests passed; `npm test` 154 files / 3348 tests passed; `npm run lint` clean; `npm run test:structure` 5 passed; `npm run arggon -- validate` ok, 0 warnings; `npx prettier --check` clean on the six touched files.

Negative controls (each probe reverted): "coordinator" put back in goal-mode.ts → the new goal-mode assertion FAILs ("expected 'DEFINE THE GOAL FIRST: …' to contain 'delivery lead'"); "(coordinator, worker, reviewer)" put back in the matrix template → the family walk FAILs with "uses the pre-rename role word \"coordinator\" — ADR 0021 §6.1 ships \"delivery lead\"".

Out of scope, reported for the lead (not in this diff): `ArggonManager/docs/agents.md` (this repo's carrier, never rendered into an adopter tree, so the family guard does not walk it) still carries live retired vocabulary — `:198` "ask the coordinator if you cannot tell", `:272` "when a coordinator `arggon comment`", `:636` ".opencode/agents/arggon-{coordinator,worker,reviewer,prover}.md". No sibling item under `role-model-foundation` covers these; a separate decision/follow-up.

### handoff 2026-10-13 @ses_ec9dcc293ffeyooHsG9CAdABL0 (session: ses_ec9dcc293ffeyooHsG9CAdABL0) — next: Lead: review 6bbf2fdc + guards against the four ticked rows, then merge the PR; auto-done flips on merge. Negative controls in the evidence comment.
- branch: feat/task-retired-role-words-product-text
- open questions: docs/agents.md:198,272,636 still carry retired role vocabulary (carrier, not template) — out of rows; no sibling item covers it; lead decides follow-up.
