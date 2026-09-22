---
type: task
status: todo
id: task-tui-help-vim-keys
title: TUI help overlay and vim-style navigation keys
parent: ui-tui-v2
labels: [tui, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-help-vim-keys.md
  Leaves live only under a story. id is the filename stem: task-tui-help-vim-keys.
  CLI `arggon create task tui-help-vim-keys` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI help overlay and vim-style navigation keys

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Navigation is arrows-only and there is no help overlay: the key list lives only in the footer/README. Terminals users expect hjkl/g/G; scripts and CI want color control.

## Acceptance

- [ ] `h/j/k/l`, `g`/`G` and PgUp/PgDn/Home/End work alongside the existing arrows
- [ ] `?` opens a help overlay listing every key (grouped: navigation, filter, view, quit); Esc closes it
- [ ] `--no-color` and `NO_COLOR` are honored; the frame stays readable without SGR
- [ ] Golden tests + README keybindings table updated
