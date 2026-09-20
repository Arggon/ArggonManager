---
type: task
status: done
id: task-agents-md-budget-headroom
title: AGENTS.md budget headroom exhausted (5 B); init --full tree grew 18% un-budgeted
assignee: Arggon
branch: feat/task-agents-md-budget-headroom
parent: operating-principles
labels: []
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-agents-md-budget-headroom.md
  Leaves live only under a story. id is the filename stem: task-agents-md-budget-headroom.
  CLI `arggon create task agents-md-budget-headroom` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# AGENTS.md budget headroom exhausted (5 B); init --full tree grew 18% un-budgeted

## Context

Follow-up from the task-adr0006-remeasure review (PR #227): the generated AGENTS.md measures 2,043 B against its 2,048 B budget — 5 B of headroom. The very next init-docs addition will regress the assertion (task-review-comments-instruction already forced prose compression once). Also from the same measurement: the full `init --full` tree grew ~18% since the ADR 0006 baseline (43.7 KB → 51.8 KB, dominated by the generated SKILL.md) with no total-tree budget at all.

## Acceptance

- [x] Decision + landing: either compress the generated AGENTS.md below ~1.9 KB (restoring meaningful headroom) or raise the budget consciously in the docs-budget assertion with rationale — decided as lead-architect, not by accident on the next addition (template compressed: rendered 2,043 B → 1,872 B, 176 B headroom; all normative rules and test-asserted phrases kept)
- [x] A total-tree budget (or advisory report line in doctor --budget) covers the init --full output so 18%-style growth is visible (advisory line now renders numeric growth vs the 43,694 B baseline: "+18.2% vs the 2026-09-14 baseline (43,694 B)"; light test added in measure.test.ts)
- [x] doctor --budget numbers updated and green (AGENTS.md 1,872 B pass; validate ok:true; doctor 0 modified / 0 drifted)

## Notes

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. 2,043 -> 1,872 B with every test-asserted phrase and normative rule surviving is the compression discipline we want; the advisory init-tree line (+18.2% vs baseline, numeric, no hard budget) makes the SKILL-driven growth visible without inventing a cap. Your point (3) is fair — the compress-vs-raise rationale now lives in this comment trail: compression chosen because the budget was set deliberately in ADR 0006 and 176 B of headroom restores slack without moving the goalposts. Merge follows.
