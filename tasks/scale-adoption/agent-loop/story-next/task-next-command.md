---
type: task
status: todo
id: task-next-command
title: Add next command for claimable suggestions
assignee: arggondev
parent: story-next
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Add next command for claimable suggestions

## Context

Selection heuristic: skip claimed and non-claimable items, prefer lexicographic order, print why the item was chosen.

## Acceptance

- [ ] Suggestion includes id, title, parent chain, and reason
- [ ] Empty todo pool prints a friendly message, exit 0
- [ ] `--json` emits one suggestion object
