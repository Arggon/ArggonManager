---
type: task
status: todo
id: task-board-serve
title: Serve the board locally with live reload
parent: story-web-board
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Serve the board locally with live reload

## Context

Serve the existing static board locally with a watcher on `tasks/`.

## Acceptance

- [ ] `arggon board --serve` binds 127.0.0.1 only
- [ ] Board reloads when any work item file changes
- [ ] Exit code and `--json` contract match other long-running-free commands
