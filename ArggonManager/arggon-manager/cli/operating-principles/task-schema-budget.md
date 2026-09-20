---
type: task
status: done
id: task-schema-budget
title: "doctor --budget: MCP tool-schema budget (schema bloat guard)"
assignee: Arggon
branch: feat/task-schema-budget
parent: operating-principles
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-schema-budget.md
  Leaves live only under a story. id is the filename stem: task-schema-budget.
  CLI `arggon create task schema-budget` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# doctor --budget: MCP tool-schema budget (schema bloat guard)

## Context

Candidate #1 of the product-discovery research round (2026-09-15): tool-schema bloat is a documented pain in agent systems — "a single complex JSON schema can consume 500+ tokens, and 90 tools means 50K+ tokens of overhead" (Towards AI, State of Context Engineering 2026). ArggonManager's MCP server exposes 9 tools (~4.7 KB tools/list, ~1.2k tokens measured 2026-09-14 in exploration-product-discovery-002) — small today, but nothing MEASURES it, and schemas grow one feature at a time. Extends the doctor --budget machinery (task-adr0006-remeasure) with the MCP schema dimension. Effort S; principle: token-context (ADR 0006).

## Acceptance

- [x] `doctor --budget` reports the MCP tools/list payload: total bytes + tokens (~chars/4, same method as the baseline) + the largest tools, against an advisory budget threshold (constant in measure.ts, baseline recorded, e.g. total <=6 KB)
- [x] The doctor --budget command description updated to mention the MCP schema dimension; skills:sync run so the generated SKILL region reflects it (FOREVER-FIX LIVE TEST: the region regeneration must pick this up mechanically)
- [x] Tests (fixture tool definitions, deterministic bytes) + docs/json-output.md additive

## Notes

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. Live measurement beats the estimate (9,050 B real vs ~4.7 KB estimado — 9 tools ya crecieron), the 12 KiB advisory with ~35% headroom is documented, measuring via the LIVE tools/list in-process instead of a copied schema list is the right call, and runDoctor staying synchronous via measureBudgetForDoctor shows care for the existing callers. The forever-fix nuance you found is the real takeaway: the mechanism regenerated the region mechanically once doctor joined a region filter — the coverage hole (hand-written-only commands never feed regions) goes to the backlog. Merge follows.
