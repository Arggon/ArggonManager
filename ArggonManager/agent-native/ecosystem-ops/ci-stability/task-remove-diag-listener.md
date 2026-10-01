---
type: task
status: todo
id: task-remove-diag-listener
title: "Remove the dead [DIAG] stderr listener in startBoardServer's spec fixture (leftover diagnostics)"
parent: ci-stability
labels: [board, testing]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-remove-diag-listener.md
  Leaves live only under a story. id is the filename stem: task-remove-diag-listener.
  CLI `arggon create task remove-diag-listener` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Remove the dead [DIAG] stderr listener in startBoardServer's spec fixture (leftover diagnostics)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from bug-live-reload-sse-race (PR #521): a committed dead `[DIAG]` stderr listener remains in startBoardServer's spec fixture (leftover from task-board-move-dialogs diagnostics). Acceptance: remove it, prove the fixture's output assertions do not depend on it, full ui-smoke lane green.
