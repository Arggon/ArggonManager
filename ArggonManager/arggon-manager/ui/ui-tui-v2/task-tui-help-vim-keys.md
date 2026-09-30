---
type: task
status: in_progress
id: task-tui-help-vim-keys
title: TUI help overlay and vim-style navigation keys
assignee: Arggon
branch: feat/task-tui-help-vim-keys
parent: ui-tui-v2
labels: [tui, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T18:57:28.911Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-tui-help-vim-keys
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-help-vim-keys.md
  Leaves live only under a story. id is the filename stem: task-tui-help-vim-keys.
  CLI `arggon create task tui-help-vim-keys` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI help overlay and vim-style navigation keys

## Context

Navigation is arrows-only and there is no help overlay: the key list lives only in the footer/README. Terminals users expect hjkl/g/G; scripts and CI want color control.

## Acceptance

- [x] `h/j/k/l`, `g`/`G` and PgUp/PgDn/Home/End work alongside the existing arrows
- [x] `?` opens a help overlay listing every key (grouped: navigation, filter, view, quit); Esc closes it
- [x] `--no-color` and `NO_COLOR` are honored; the frame stays readable without SGR
- [x] Golden tests + README keybindings table updated

## Notes

### 2026-09-30 @Arggon
verdict: implemented (awaiting review)

Branch feat/task-tui-help-vim-keys, PR #492 (ready).

Gates (all green): npm test (108 files / 1854 tests), npm run lint, npm run build, npm run check:plugin, arggon validate --json, npm run smoke:tui-board (pty).

Evidence, expected vs observed:
- Reducer: h/l = arrows left/right, j/k = arrows up/down (same clamping against counts), g/G = home/end (card 0 / count-1); j/k/g/G scroll the detail pane with the same clamps (G at 40 lines x 8 rows lands on scroll 34).
- Help overlay: ? opens a modal frame listing every key grouped navigation/filter/view/quit (golden: exactly height padded lines, every documented key present, no SGR with color off); esc and ? close it with the board state byte-identical (sort/readyOnly/card preserved in the test); Ctrl-C quits from the overlay.
- Color: runTuiBoard color:false emits no SGR color sequences (asserted /\x1b\[[0-9;]*m/ absent); NO_COLOR=1 disables by default; explicit color:true wins over the env; the CLI --no-color flag parses (spawn test) and is the only value that can force colors off.
- pty smoke: j pressed on the live board (selection unchanged — one filtered card, as expected), ? opens the grouped overlay in the pty, esc returns to the same filtered board.

DELIBERATE KEY CHANGE (merge-order note): the ready-only lens moved from l to L — the work order requires lowercase l as the vim right motion. Footer/README/overlay all say 'L ready'. PRs #484 (v views) and #489 (c/m) document their own keys; the TUI_HELP data structure, the footer string and the README table are the three conflict points when those merge — the overlay content is data, so conflicts localize.

Deviations: none.
