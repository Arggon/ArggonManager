---
type: story
status: todo
id: story-tui-board
title: Terminal UI kanban
parent: ecosystem-ops
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-tui-board/story-tui-board.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Terminal UI kanban

## Context

Backlog.md ships a TUI kanban; our contributors live in terminals too. Reuse the board renderer's data (same kernel read path) in a minimal interactive terminal view — no new schema, no daemon.

## Acceptance

- [ ] `arggon board --tui` renders columns with keyboard navigation (arrows, enter = open item path)
- [ ] Read-only in v1; no writes outside the update path
