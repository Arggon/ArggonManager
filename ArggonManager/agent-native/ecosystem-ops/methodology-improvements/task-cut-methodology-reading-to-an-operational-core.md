---
type: task
status: todo
id: task-cut-methodology-reading-to-an-operational-core
title: Cut methodology reading to an operational core
parent: methodology-improvements
labels: []
branch: agent/methodology-operational-core-ac4110cc6356
worktree_path: /home/arggon/.dsh/state/superagent/work/methodology-operational-core-ac4110cc6356
created: "2026-11-04"
updated: "2026-11-04"
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

- [ ] The four-file operational core is at most 120 KiB; the start-here page is at most 20 KiB.
- [ ] Depth is behind targeted links and the claim, done, review and promotion rules each have a canonical home.
- [ ] Agents and README provide a core / reference / history reading map.
- [ ] context:report prints governing-doc sizes and tests reject budget regression.
- [ ] A fresh-agent standard-task walkthrough is recorded with any departures from the core.

Methodology impact class: Advisory — reorganizing existing rules without changing gates or authority (ADR 0016).

## Notes
