---
type: task
status: done
id: task-parity-guard-for-board-drop-rules-vs-statusts
title: Parity guard for board drop rules vs status.ts
assignee: Arggon
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

- [x] The board's drop rules are provably 1:1 with `status.ts` + `update.ts` (board-parity.test.ts: embedded page script executed in a vm sandbox gives identical verdicts to the TS function over the full transition matrix, and the TS function's accept/refuse matches runUpdate on real trees)
- [x] A deliberate divergence in either copy makes the suite fail (source-equality check catches edits to the embedded function; the verdict matrix catches rule edits in either copy)
- [x] `npm test` passes and the board still refuses illegal drops with the CLI rule message (341 tests green; serve test asserts the exact claim-conflict message from the CLI)

## Notes

Review comment: https://github.com/Arggon/ArggonManager/pull/67#issuecomment-5636817270
