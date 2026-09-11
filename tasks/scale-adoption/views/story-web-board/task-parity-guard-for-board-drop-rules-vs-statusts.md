---
type: task
status: todo
id: task-parity-guard-for-board-drop-rules-vs-statusts
title: Parity guard for board drop rules vs status.ts
parent: story-web-board
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/scale-adoption/views/story-web-board/task-parity-guard-for-board-drop-rules-vs-statusts.md
  Leaves live only under a story. id is the filename stem: task-parity-guard-for-board-drop-rules-vs-statusts.
  CLI `arggon create task parity-guard-for-board-drop-rules-vs-statusts` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Parity guard for board drop rules vs status.ts

## Context

Follow-up from the architect code review of PR #67 (drag-and-drop board).
`evaluateDrop` in `cli/src/board.ts` embeds a hand-copied transitions table
plus the claim rule into the page script, duplicating `cli/src/status.ts`
(`TRANSITIONS`) and `cli/src/update.ts` (claim rule). Nothing stops the two
copies from silently diverging — a transition added to the CLI would keep
being refused (or wrongly allowed) by the board. Prefer generating the
embedded table from `status.ts` at render time; if that is not feasible,
add a parity test that fails on drift.

## Acceptance

- [ ] The board's drop rules are provably 1:1 with `status.ts` + `update.ts` (generated from source, or a parity test that fails on drift)
- [ ] A deliberate divergence in either copy makes the suite fail
- [ ] `npm test` passes and the board still refuses illegal drops with the CLI rule message

## Notes

Review comment: https://github.com/Arggon/ArggonManager/pull/67#issuecomment-5636817270
