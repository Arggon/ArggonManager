---
type: task
status: in_progress
id: task-tui-live-refresh
title: "TUI live refresh: watch the tracker and repaint in place"
assignee: Arggon
branch: feat/task-tui-live-refresh
parent: ui-tui-v2
labels: [tui, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T15:29:57.754Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-tui-live-refresh
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-live-refresh.md
  Leaves live only under a story. id is the filename stem: task-tui-live-refresh.
  CLI `arggon create task tui-live-refresh` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI live refresh: watch the tracker and repaint in place

## Context

<!-- Why this task exists. -->

## Acceptance

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The TUI re-reads the tree after every keypress only (`runTuiBoard`), so an idle board silently goes stale while other agents/sessions write (documented v0 limitation). `board --serve` already owns the fs-watch + debounce pattern this can reuse.

## Acceptance

- [x] A debounced fs watcher on the tracker dir re-reads and repaints without a keypress, preserving selection/filter when the item still exists; `r` forces a refresh
- [x] Watcher unavailable or failing degrades transparently to per-keypress reads (never crashes, never exits)
- [x] Footer carries a freshness stamp (e.g. `updated 12:03:44`)
- [x] Tests with an injected watcher; pty evidence; README note updated
