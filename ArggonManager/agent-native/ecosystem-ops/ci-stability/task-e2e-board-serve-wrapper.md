---
type: task
status: todo
id: task-e2e-board-serve-wrapper
title: "Migrate the last tsx-wrapper spawn: e2e/board.smoke.spec.ts helper (left out of the #518 sweep)"
parent: ci-stability
labels: [testing, flaky]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-e2e-board-serve-wrapper.md
  Leaves live only under a story. id is the filename stem: task-e2e-board-serve-wrapper.
  CLI `arggon create task e2e-board-serve-wrapper` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Migrate the last tsx-wrapper spawn: e2e/board.smoke.spec.ts helper (left out of the #518 sweep)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from task-runcli-import-tsx-migration (PR #518): the sweep deliberately skipped e2e/ (a parallel worker owned e2e/board.smoke.spec.ts at the time). The helper at e2e/board.smoke.spec.ts:1384 still spawns the tsx wrapper CLI — the exact transient exit-1 surface root-caused in bug-row-table-flake (PR #513). Migrate it to the shared cli/src/test-spawn.ts pattern (node --import <abs loader>) or the e2e-appropriate equivalent, preserving asserted bytes. NOTE: PR #517-era board-serve work touched this file — rebase carefully.
