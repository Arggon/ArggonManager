---
type: task
status: in_progress
id: task-remove-diag-listener
title: "Remove the dead [DIAG] stderr listener in startBoardServer's spec fixture (leftover diagnostics)"
assignee: Arggon
branch: feat/task-remove-diag-listener
parent: ci-stability
labels: [board, testing]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T14:30:03.134Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-remove-diag-listener
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-remove-diag-listener.md
  Leaves live only under a story. id is the filename stem: task-remove-diag-listener.
  CLI `arggon create task remove-diag-listener` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Remove the dead [DIAG] stderr listener in startBoardServer's spec fixture (leftover diagnostics)

## Context

Leftover debug scaffolding from task-board-move-dialogs: commit 2e5f3501 added a TEMP DIAGNOSTIC branch in `startBoardServer`'s stderr handler (`e2e/board.smoke.spec.ts`) that forwards any stderr chunk containing `[DIAG]` to the report. No committed source emits `[DIAG]` (zero hits in `cli/`, `lib/`, `smoke/` across all history via `git log -S`), so the branch is unreachable — dead code from a debugging session whose server-side log line was never committed. Filed from bug-live-reload-sse-race (PR #521 review).

## Acceptance

- [x] The dead `[DIAG]` conditional forward is removed from `startBoardServer`; the pre-existing stderr→`output` accumulation (consumed only by the timeout rejection message) is kept.
- [x] Independence proven: the removed branch only wrote to `process.stderr` (the runner's report stream), which no assertion reads; `output` — the only data sink in the function — is fed by the kept `output +=` line, and its only consumers are the URL regex match and the timeout error. With zero `[DIAG]` emitters in the repo the branch never fired, so removal cannot change fixture behavior; the green `@smoke` lane confirms it empirically.
- [x] Gates on the worktree: `npm run build` exit 0 (includes `tsc -p tsconfig.e2e.json` type-check of the spec), `npm test` 1997 passed, `npm run lint` exit 0, `npm run check:plugin` exit 0, `npm run arggon -- validate --json` ok:true, `npx playwright test --grep @smoke` 33 passed (23.7s).

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from bug-live-reload-sse-race (PR #521): a committed dead `[DIAG]` stderr listener remains in startBoardServer's spec fixture (leftover from task-board-move-dialogs diagnostics). Acceptance: remove it, prove the fixture's output assertions do not depend on it, full ui-smoke lane green.
