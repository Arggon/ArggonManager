---
type: task
status: todo
id: task-tui-board
title: Terminal kanban board
parent: story-tui-board
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-tui-board/task-tui-board.md
  Leaves live only under a story. id is the filename stem: task-tui-board.
  CLI `arggon create task tui-board` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Terminal kanban board

## Context

Terminal UI over `list --json` data; dependency-light implementation (raw ANSI, no heavy framework) per ADR 0001 stack rules.

## Acceptance

- [ ] Interactive columns/statuses with keyboard nav and search (`/`); exits cleanly
- [ ] Renders the same tree state as `arggon board` (golden comparison test on the data layer)
