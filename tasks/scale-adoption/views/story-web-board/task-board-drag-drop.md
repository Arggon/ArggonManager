---
type: task
status: in_progress
id: task-board-drag-drop
title: Drag-and-drop status moves on the web board
assignee: Arggon
branch: feat/task-board-drag-drop
parent: story-web-board
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Drag-and-drop status moves on the web board

## Context

Moving a card between columns maps to `arggon update <id> --status <s>`.

## Acceptance

- [ ] Drops map 1:1 to CLI status transitions; refusal shows the rule that failed
- [ ] Optimistic UI reverts when the update call fails
- [ ] Works with claimable and container types
