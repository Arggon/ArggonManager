---
type: bug
status: todo
id: bug-tui-selection-offscreen
title: "TUI selection can leave the screen: no scroll window in long columns"
parent: ui-tui-v2
labels: [tui, ui]
priority: p1
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/bug-tui-selection-offscreen.md
  Leaves live only under a story. id is the filename stem: bug-tui-selection-offscreen.
  CLI `arggon create bug tui-selection-offscreen` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI selection can leave the screen: no scroll window in long columns

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`renderTui` renders body rows from index 0 (no scroll offset) and `clampTuiState` clamps the selection to the column length, not to the visible body height — so arrow-down past the last visible row selects an item that is never drawn.

Reproduced on 2026-09-22 against main c4a61b7c (this repo, 288 items; done column = 281 cards):

- Pure renderer, 80x24: 30 todo items, body rows = 21, `handleKey` accepts card index 25, the frame renders ids `task-demo-00`..`task-demo-20` and **does not contain** `task-demo-25` (no highlight rendered).
- Live pty, 160x42, done column selected, `↓`x60: the last frame shows rows 0..38 (early done items) with **0** body highlight sequences (`\x1b[7m`); the selected card is off-screen and the user has no feedback.

Impact: any column with more cards than the terminal body height (every mature tracker) has unreachable-by-vision items; the footer does not say where the selection is.

## Acceptance

- [ ] A scroll window keeps the selected card visible at all times (window follows the selection; no paging past the end; empty rows never shown when items exist)
- [ ] PgUp/PgDn (and Home/End) scroll predictably; the footer shows the position (e.g. `row 61/281`)
- [ ] Golden tests cover: selection at the bottom of a long column renders the highlighted row; window stays valid after resize and after filters change
- [ ] pty evidence (before/after) in the review verdict; README keybindings updated
