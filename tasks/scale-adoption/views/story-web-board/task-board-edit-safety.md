---
type: task
status: todo
id: task-board-edit-safety
title: Enforce claim and transition rules on board edits
parent: story-web-board
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Enforce claim and transition rules on board edits

## Context

The board must not become a side door around the claim rules.

## Acceptance

- [ ] Claim conflict (already-assigned item) is rejected; `--force` stays CLI-only
- [ ] `in_progress` without assignee rejected for story/task/bug
- [ ] `blocked` requires a non-empty reason via a board prompt
