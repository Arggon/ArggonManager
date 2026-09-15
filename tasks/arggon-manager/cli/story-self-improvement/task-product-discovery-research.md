---
type: task
status: in_progress
id: task-product-discovery-research
title: "Product discovery: online research into improvements and new feature possibilities"
assignee: Arggon
branch: feat/task-product-discovery-research
parent: story-self-improvement
labels: []
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T13:57:41.783Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/task-product-discovery-research.md
  Leaves live only under a story. id is the filename stem: task-product-discovery-research.
  CLI `arggon create task product-discovery-research` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Product discovery: online research into improvements and new feature possibilities

## Context

ArggonManager evolved fast (orchestration defaults, token/context efficiency, parity harness, deploy guidance) but its roadmap has been driven by findings from our own experiments. A product-discovery pass grounds the next roadmap round in what the broader ecosystem is doing: agent-native trackers, spec-driven development kits, worktree/orchestration managers, context-engineering practices. Research online with dated sources, then rank concrete improvement/feature candidates for ArggonManager.

Research-first: no product code changes. Outcomes feed the backlog (the coordinator files candidates after review).

## Acceptance

- [x] Exploration recorded via `arggon stack explore` (docs/explorations/): landscape survey of adjacent tools — agent-native task/issue trackers, spec-driven development kits, worktree/orchestration managers, context-engineering practices — each with a dated source and a one-line "what it does that ArggonManager doesn't" — docs/explorations/exploration-product-discovery-002.md (17-entry landscape table, all sources accessed 2026-09-15)
- [x] Ranked list of 8-12 candidate improvements/features: problem it solves, evidence (dated source), effort (S/M/L), which operating principle/ADR it aligns with, and surface (docs-only / CLI / MCP / board) — 12 ranked candidates in the same exploration
- [x] An explicit "evaluated and rejected" section with reasons — scope discipline is part of the deliverable — 8 rejected notables with reasons
- [x] No product code changes in this item

## Notes
