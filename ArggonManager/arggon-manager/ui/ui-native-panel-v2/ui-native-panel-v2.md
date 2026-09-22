---
type: story
status: todo
id: ui-native-panel-v2
title: "OpenCode board panel v2: interactive and live"
parent: ui
labels: [opencode-seam, tui, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-native-panel-v2/ui-native-panel-v2.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# OpenCode board panel v2: interactive and live

## Context

<!-- Why this story exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`task-native-tui` (W5) shipped the OpenCode V2 board surface: a `session.panel` tree (header + counts + flat tree lines, 200-line limit), a sidebar status line and the `/arggon-board` command with esc/f/r keys. Source read on 2026-09-22: the panel is display-only (no selection, no detail, no filter/fold); the sidebar signal is created on mount with no setter, so it never refreshes; there is no paging beyond the 200-line limit.

## Acceptance

- [ ] Child tasks done with their checklists honest
- [ ] The panel stays display-only except where a spec authorizes actions; any action goes through the kernel rules (no write path bypass)
- [ ] `npm run smoke:tui` extended for the new interactions (slot crash isolation preserved)
- [ ] docs/playbooks/opencode.md § TUI and the manual checklist updated
