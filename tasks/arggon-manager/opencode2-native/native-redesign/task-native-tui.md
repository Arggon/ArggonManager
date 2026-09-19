---
type: task
status: todo
id: task-native-tui
title: TUI board and status panels
parent: native-redesign
depends_on: [task-native-permissions-worktrees]
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
---

<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-tui.md
  Leaves live only under a story. id is the filename stem: task-native-tui.
  CLI `arggon create task native-tui` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI board and status panels (W5)

## Context

W5 of `plan-native-first-011`. Register board/status panels and routes through the CLI/TUI plugin API (`session.panel`, sidebar slots) with commands to open them; item status appears in the sidebar. The static HTML board stays as an optional artifact.

## Acceptance

- [ ] The board/status panel opens from a command and renders the current tree.
- [ ] Plugin loads clean; no session-startup regressions.
- [ ] TUI smoke checklist completed (open/close/fullscreen, narrow terminal).
- [ ] No context-budget regression from panel registration.

## Notes

- Depends on W2; web console is out of scope for this wave.
