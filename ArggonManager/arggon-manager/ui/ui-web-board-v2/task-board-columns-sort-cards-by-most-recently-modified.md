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

### 2026-10-17 @arggon-maker
## Evidence — columns sort by most-recently-modified (done, committed b4cad27a, pushed)

### What changed (13 files, +302/−103)
Core derivation: `sortByUpdated` in lib/src/view-model.ts — `updated` descending, id tiebreak, missing/null/empty sorts last (oldest). It is now the columns-view default consumed by:
- cli/src/board.ts runBoard (was sortById) — columns view
- cli/src/board-serve.ts render (was inline id sort) — served board
- cli/src/tui.ts loadTuiItems + visibleTuiItems/applyTuiSort — TUI
- opencode/plugins/arggon/board.ts boardSnapshot — OpenCode panel
- lib/src/view-model.ts visibleItems/itemsForStatus/applyViewLens (updated default)
- sortByPriority / sortByNextRank gained recency-then-id ties for consistency

Kept id-sorted (documented choice):
- treeEntries (grouped-ancestry tree keeps ancestry grouping + id-sorted siblings)
- buildChildrenIndex (drawer children + TUI [n] stable)
- tuiChildrenOf (TUI hierarchy [n] stable)

Docs: README board section + TUI sort cycle row updated to updated-descending.

### Gates run (all green)
- arggon validate: ok, 0 warnings, convention v5
- prettier --check on all touched files: clean
- npm run build (tsc + lib + plugin bundle): clean
- eslint on touched files: clean
- vitest: 3679 passed / 166 files
- Targeted board suites: board, board-parity, board-serve, board-friction, tui, view-model — 417 passed
- Playwright @smoke board.smoke.spec.ts: 49/49 passed (real board --serve via Chromium)

### Friction-footer interaction (kept intact)
The just-merged footer (build stamp + friction badge) was NOT reverted. One e2e assertion compared drawer build text to full footer text; footer now reads `build <stamp> · friction <count>` while the drawer stamp carries only build, so e2e/board.smoke.spec.ts compares the drawer build against the footer's build prefix only (`stamped.split(" · ")[0]`). Both build and friction remain in the footer.

### Commit
b4cad27a feat(board): columns sort cards by most recently modified
Branch feat/task-board-columns-sort-cards-by-most-recently-modified pushed to origin.

### Next step (for the lead)
Open the PR and set the item to done once review lands. Acceptance checklist items are pinned by unit/parity tests; the checklist itself is not ticked by me (done flip is the lead's call).
