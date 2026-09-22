---
type: task
status: todo
id: task-native-panel-interaction
title: "OpenCode panel: selection, detail and next/active jumps"
parent: ui-native-panel-v2
labels: [opencode-seam, tui, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-native-panel-v2/task-native-panel-interaction.md
  Leaves live only under a story. id is the filename stem: task-native-panel-interaction.
  CLI `arggon create task native-panel-interaction` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode panel: selection, detail and next/active jumps

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The W5 panel renders flat tree lines (header + counts + up to 200 lines) and only binds esc/f/r; there is no selection, no item detail and no way to jump to the kernel `next` suggestion or the session's active item (both already computed in `boardSnapshot`).

## Acceptance

- [ ] j/k (and PgUp/PgDn/g/G) move a visible selection over the tree; Enter opens the selected item (file path or an inline detail block with body/checklist), Esc returns
- [ ] `n` jumps to the `next` suggestion and `a` to the active session item; the header keeps totals and the counts line
- [ ] Width-aware clipping and sanitization preserved; no slot crash on a corrupt tracker (existing P1 guard)
- [ ] `npm run smoke:tui` extended with a selection capture; docs/opencod2 TUI section updated
