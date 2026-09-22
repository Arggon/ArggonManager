---
type: story
status: todo
id: ui-tui-v2
title: "Terminal board v2: scroll, detail, filters and live view"
parent: ui
labels: [tui, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/ui-tui-v2.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Terminal board v2: scroll, detail, filters and live view

## Context

<!-- Why this story exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`story-tui-board` shipped read-only v1: five status columns, arrow navigation, `/` substring search, Enter prints the item path, `q` quits. Measured on 2026-09-22 (this repo, 288 items, done column 281 cards):

- Selection can leave the screen: a pure-render proof at 80x24 shows the body renders 21 rows, `handleKey` accepts card index 25, and the selected card is not rendered; a live pty run (160x42, done column, `↓`x60) ends with rows 0..38 on screen and zero body highlights — the selected card is invisible (filed as `bug-tui-selection-offscreen`).
- No detail view (Enter prints the path only), substring-only filter (the kernel filter language and `x-views` are unused), no sort/priority lens, no file watcher (idle views go stale until the next keypress).

## Acceptance

- [ ] Child tasks/bugs done with their checklists honest
- [ ] The TUI stays raw-ANSI and dependency-free (ADR 0001); read-only unless a spec authorizes writes through the kernel update path
- [ ] Golden-frame tests for every new key/interaction + a pty capture in each review verdict (TUI smoke exception, ADR 0008)
- [ ] README keybinding table updated in every PR that changes a key
