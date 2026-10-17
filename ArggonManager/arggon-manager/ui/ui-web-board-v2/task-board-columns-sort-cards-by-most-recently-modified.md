---
type: task
status: in_progress
id: task-board-columns-sort-cards-by-most-recently-modified
title: Board columns sort cards by most recently modified
assignee: arggon-delivery-lead
branch: feat/task-board-columns-sort-cards-by-most-recently-modified
parent: ui-web-board-v2
labels: []
created: "2026-10-16"
updated: "2026-10-17"
claimed_at: "2026-10-16T14:38:09.548Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-columns-sort-cards-by-most-recently-modified
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-columns-sort-cards-by-most-recently-modified.md
  Leaves live only under a story. id is the filename stem: task-board-columns-sort-cards-by-most-recently-modified.
  CLI `arggon create task board-columns-sort-cards-by-most-recently-modified` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Board columns sort cards by most recently modified

## Context

Product-owner request 2026-10-16: the board should be sorted by last time a card was modified. Today cards render in id order (`sortById` in `cli/src/board.ts`: `runBoard`, tree entries, `renderBoardHtml`); the item `updated` frontmatter field (refreshed by every `arggon update`) is never consumed by the board.

## Acceptance

- [ ] Columns view sorts cards within each status column by `updated` descending (most recently modified first), deterministic on ties (id tiebreak); grouped-ancestry tree keeps ancestry grouping
- [ ] Lens/filter, saved views and existing sort controls (priority / next-rank) behave consistently with the new default — updated in docs where the order is described
- [ ] Tests pin the order (unit/parity); `arggon validate` green; prettier clean; PR opened

## Notes
