---
type: task
status: in_progress
id: task-cut-methodology-reading-to-an-operational-core
title: Cut methodology reading to an operational core
assignee: arggon-superagent
branch: agent/methodology-operational-core-ac4110cc6356
parent: methodology-improvements
labels: []
created: "2026-11-04"
updated: "2026-11-04"
claimed_at: "2026-11-04T12:06:14.567Z"
worktree_path: /home/arggon/.dsh/state/superagent/work/methodology-operational-core-ac4110cc6356
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-cut-methodology-reading-to-an-operational-core.md
  Leaves live only under a story. id is the filename stem: task-cut-methodology-reading-to-an-operational-core.
  CLI `arggon create task cut-methodology-reading-to-an-operational-core` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Cut methodology reading to an operational core

## Context

Issue #868 requests a shorter required methodology surface without losing rules: https://github.com/Arggon/ArggonManager/issues/868. The normal work loop must be readable independently of recovery procedures, command matrices and historical rationale.

## Acceptance

- [x] The four-file operational core is at most 120 KiB; the start-here page is at most 20 KiB.
- [x] Depth is behind targeted links and the claim, done, review and promotion rules each have a canonical home.
- [x] Agents and README provide a core / reference / history reading map.
- [x] context:report prints governing-doc sizes and tests reject budget regression.
- [x] A fresh-agent standard-task walkthrough is recorded with any departures from the core.

Methodology impact class: Advisory — reorganizing existing rules without changing gates or authority (ADR 0016).

## Notes

### 2026-11-04 @arggon-superagent

Methodology impact class: Advisory (ADR 0016). Existing rules/gates/authority preserved; depth moved to targeted references, duplicates replaced by canonical links or generated excerpts. Independent read-and-reason standards review approves after corrections consolidated in task-verify-operational-core-extraction-review-corrections. Four-file core 97,242 B; start 19,891 B. Fresh-agent confirmation completed a real fixture task using only core plus command help; hosted PR/CI enforcement was not exercised by that local walkthrough. See docs/labs/operational-core-confirmation.md and the initial departure record. Build, lint, structural gates, tracker validate, spec baseline and strict report pass; final full-suite run is tracked separately. Status remains in_progress until actual merge; this deployment requires a person to merge.

### 2026-11-04 @arggon-superagent
Final verification: core 97,195 B (agents 19,844; convention 40,011; engineering 28,940; umbrella 8,400) and start 19,844 B, strict context report pass. Build, lint, lint/structure, test:structure, validate and spec-analyze baseline pass. Focused seam, ADR/MCP/link and context tests pass. The local full suite reached 3,729 passed with one headless-workflow parity failure, now fixed by editing the template and re-pinning both workflow copies plus regenerated ledger to 0.11.0; the optional installed-Claude probe failure is baseline-only and filed as bug-optional-claude-probe-rejects-advisory-missing-icon-warning. PR #873 is not ready until the re-pinned commit receives CI; a person merges it.
