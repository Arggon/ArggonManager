---
type: task
status: todo
id: task-deps-board-edges
title: Dependency edges on the board
parent: story-deps-queries
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/deps-graph/story-deps-queries/task-deps-board-edges.md
  Leaves live only under a story. id is the filename stem: task-deps-board-edges.
  CLI `arggon create task deps-board-edges` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Dependency edges on the board

## Context

Render the graph on the static and served boards without breaking self-containment.

## Acceptance

- [ ] Cards show a `↳ blocked by <id>` line per open dependency; edges render between columns
- [ ] Static export stays a single self-contained HTML file; `--serve` identical
