---
type: task
status: in_progress
id: task-tui-detail-pane
title: "TUI detail pane: read an item without leaving the board"
assignee: Arggon
branch: feat/task-tui-detail-pane
parent: ui-tui-v2
labels: [tui, ui]
priority: p1
created: "2026-09-22"
updated: "2026-09-23"
claimed_at: "2026-09-23T01:07:46.046Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-tui-detail-pane
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-detail-pane.md
  Leaves live only under a story. id is the filename stem: task-tui-detail-pane.
  CLI `arggon create task tui-detail-pane` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI detail pane: read an item without leaving the board

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Enter currently prints the selected item's file path to the footer (README keybindings); reading the body, acceptance checklist or dependencies means quitting the TUI and opening the file. The kernel read path already provides everything the pane needs.

## Acceptance

- [ ] Enter opens a read-only detail pane for the selected item: title/type/status/priority/assignee, body (sanitized + wrapped, scrollable when longer than the pane), acceptance checkboxes, labels, dependencies with their statuses, branch/worktree_path/milestone and the path
- [ ] Esc (or Enter) returns to the board with the selection, filter and scroll window preserved; a documented fallback for very narrow terminals
- [ ] Content is sanitized through the existing human-text path; the pane never writes
- [ ] Golden tests + pty evidence in the verdict; README keybindings updated
