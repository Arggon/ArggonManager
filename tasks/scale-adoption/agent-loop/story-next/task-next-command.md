---
type: task
status: done
id: task-next-command
title: Add next command for claimable suggestions
assignee: arggondev
branch: feat/task-next-command
parent: story-next
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Add next command for claimable suggestions

## Context

Selection heuristic: skip claimed and non-claimable items, prefer lexicographic order, print why the item was chosen.

## Acceptance

- [x] Suggestion includes id, title, parent chain, and reason
- [x] Empty todo pool prints a friendly message, exit 0
- [x] `--json` emits one suggestion object

## Notes

Closed by @Arggon (authorized): work landed via PR #64; item left stale in `in_progress`.
