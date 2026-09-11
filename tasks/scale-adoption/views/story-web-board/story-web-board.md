---
type: story
status: done
id: story-web-board
title: Local web board
assignee: Arggon
branch: feat/story-web-board
parent: views
labels: [viewer]
created: "2026-09-11"
updated: "2026-09-11"
---
# Local web board

## Context

`arggon board` writes static HTML. Backlog.md's local web board adds live reload and drag-and-drop; do the same while keeping 'the files are the source of truth' — every edit goes through the update path, never raw file writes from the browser.

## Acceptance

- [x] `arggon board --serve` reflects tree changes without manual refresh (fs watcher on tasks/ + SSE reload channel; covered by board-serve.test.ts)
- [x] Drag-and-drop performs only legal v0 transitions (parity guard proves embedded rules == TS evaluateDrop == kernel runUpdate; server route runs runUpdate)
- [x] Static export (`arggon board`) keeps working unchanged (the SSE client is injected only in serve mode; existing board tests untouched)
