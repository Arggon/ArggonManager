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

- [ ] the goal-mode contract's rendered text uses the shipped role vocabulary; affected tests/snapshots updated
- [ ] `adapters/capability-matrix.json` + its template copy use the shipped ids; `x-generated` checksum refreshed
- [ ] a guard covers these spots, or their exclusion is named with its reason
- [ ] `arggon validate` + affected suites green; prettier clean on touched files

## Notes
