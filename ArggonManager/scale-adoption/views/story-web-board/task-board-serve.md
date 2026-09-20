---
type: task
status: done
id: task-board-serve
title: Serve the board locally with live reload
assignee: Arggon
parent: story-web-board
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Serve the board locally with live reload

## Context

Serve the existing static board locally with a watcher on `tasks/`.

## Acceptance

- [x] `arggon board --serve` binds 127.0.0.1 only (hardcoded loopback host; binding asserted in tests)
- [x] Board reloads when any work item file changes (recursive watcher on tasks/ with debounce; SSE test writes a file and waits for the reload event)
- [x] Exit code and `--json` contract match other commands (`--serve --json` emits the standard ok-envelope with url/port once, then stays serving; failures use BOARD_FAILED with non-zero exit)
