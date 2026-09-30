---
type: task
status: in_progress
id: task-tui-sort-ready-lens
title: "TUI sort and ready lens: priority/next rank, ready-only view"
assignee: Arggon
branch: feat/task-tui-sort-ready-lens
parent: ui-tui-v2
labels: [tui, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T15:57:32.705Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-tui-sort-ready-lens
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-sort-ready-lens.md
  Leaves live only under a story. id is the filename stem: task-tui-sort-ready-lens.
  CLI `arggon create task tui-sort-ready-lens` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI sort and ready lens: priority/next rank, ready-only view

## Context

<!-- Why this task exists. -->

## Acceptance

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Cards are sorted lexicographically by id; the kernel's priority field and `next` ranking (claimable + todo + unclaimed + deps terminal, by downstream weight) are invisible in the TUI, so the terminal view cannot answer "what should I pull next?".

## Acceptance

- [x] `s` cycles sort: id | priority | next-rank (deterministic tie-breaks), applied per column
- [x] The ready-only lens toggles with `l` (key moved from the work order's `r`: PR #472's live refresh ships `r` = force refresh first; see the comment below) using the kernel `isReadyTodo`/claim rules (no copied predicate)
- [x] Rows surface priority, assignee and blocked markers; the header shows the active sort/lens
- [x] Golden tests + pty evidence; README keybindings updated

### 2026-09-30 @Arggon
Implemented on feat/task-tui-sort-ready-lens, PR #475 (ready).

DEVIATION (reported per lane rules): the ready-only lens toggles with 'l' (lens), not the work order's 'r' — PR #472's live refresh shipped 'r' = force refresh first and both work orders claimed the key. Acceptance box ticked with the key swap noted.

Kernel-first: new exports isReadyTodo + sortByNextRank in lib/src/view-model.ts (readyTodoCount refactored onto isReadyTodo; runNext untouched); the TUI lens/sort are pure composition over them.

Evidence:
- pty (npm run smoke:tui-board): seeded 'create --priority p1' card + a card chained onto the seeded task; steps prove the lens hides the blocked (⌫) card and names 'ready-only' in the header, and priority/next sorts lead the todo column with the p1 card. 13 pty steps ok, composed with #472's live-refresh and #469's split-PgDn scenarios in one session.
- Unit: sort cycle, three sort orders, lens composition + whole-tree readiness, clamp after toggle, search-prompt typing, loop-level s/s/l repaint; kernel tests for both new exports.
- Gates: npm test 107 files/1816 tests (row-table-stdout 18/18, run twice); lint clean; build clean (plugin bundle committed); validate ok:true.
- CI row-table flag from the coordinator: does NOT reproduce on the rebased branch (the flagged run predates the rebase onto post-#472 main; no row-table code touched). Watching the fresh CI run on this push.

### handoff 2026-09-30 @Arggon — next: Review+merge PR #475 (merge, never squash). If CI flags row-table-stdout again, pull the CI log - it does not reproduce locally on the rebased branch.
- branch: feat/task-tui-sort-ready-lens
