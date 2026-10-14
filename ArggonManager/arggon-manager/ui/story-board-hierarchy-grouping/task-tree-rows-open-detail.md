---
type: task
status: in_progress
id: task-tree-rows-open-detail
title: "Tree interactions: open the detail drawer (click/keyboard) and compact/extend each subtree — the tree is read-only today"
assignee: arggon-delivery-lead
branch: feat/task-tree-rows-open-detail
parent: story-board-hierarchy-grouping
labels: [ui, board]
created: "2026-10-14"
updated: "2026-10-14"
claimed_at: "2026-10-14T15:42:36.289Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-tree-rows-open-detail
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-board-hierarchy-grouping/task-tree-rows-open-detail.md
  Leaves live only under a story. id is the filename stem: task-tree-rows-open-detail.
  CLI `arggon create task tree-rows-open-detail` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Tree rows open the detail drawer on click and keyboard (serve + static with --details) — the tree is read-only today

## Context

Product-owner requests 2026-10-14, while testing the freshly shipped grouped-ancestry view (`task-web-board-hierarchy-view`, PR #814):

1. **Clicking a row should show the item's details** — the drawer already exists (the columns view opens it on a card click; serve fetches `/api/item`, the static export embeds the payload behind `--details`), but the tree rows are deliberately read-only (no anchors), so clicking does nothing.
2. **Compact/extend each item** — every branch should fold and unfold (collapse/expand its subtree) so a 660-item tracker stays navigable.

Both live in the same tree code (`cli/src/board.ts`: `renderBoardTree`, the embedded client script around `refreshTree`/`wireBoardColumns`/`boardTreeDisplay`, plus `e2e/board.smoke.spec.ts`), so they are one item, one maker.

## Acceptance

- [ ] Clicking a tree row opens the same detail drawer the columns view opens, for that item; serve and static-with-`--details` behave the same; a static export without `--details` offers no fake affordance (it stays honestly drawer-free)
- [ ] Keyboard: rows are reachable (roving focus or equivalent) and Enter/Space opens the drawer; the subtree disclosure is keyboard-operable; axe scan green in the tree states
- [ ] Each container row carries a compact/extend (collapse/expand) control: collapsing hides its subtree, expanding restores it; the state persists per browser like the columns' layout preference, and the existing reset restores the default
- [ ] Composition is honest with the other tree mechanics: with a filter/lens active, a match inside a collapsed subtree stays discoverable (reveal the path to a match, or mark the collapsed branch as containing matches — decide and record); counts stay the lens verdict; terminal-hiding and the view toggle keep composing
- [ ] The "no dead links" property is kept (no `href` navigation on rows; a missing parent stays marker text)
- [ ] The requests become pinned tests (e2e `@smoke`: click→drawer, keyboard open, collapse/expand + persistence, the filter-inside-collapsed case; both modes where applicable); README documents the interactions
- [ ] `arggon validate`, affected suites, `npm test`, CI `ui-smoke` green; prettier clean on touched files

## Notes
