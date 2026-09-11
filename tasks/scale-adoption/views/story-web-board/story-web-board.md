---
type: story
status: todo
id: story-web-board
title: Local web board
parent: views
labels: [viewer]
created: "2026-09-11"
updated: "2026-09-11"
---
# Local web board

## Context

`arggon board` writes static HTML. Backlog.md's local web board adds live reload and drag-and-drop; do the same while keeping 'the files are the source of truth' — every edit goes through the update path, never raw file writes from the browser.

## Acceptance

- [ ] `arggon board --serve` reflects tree changes without manual refresh
- [ ] Drag-and-drop performs only legal v0 transitions
- [ ] Static export (`arggon board`) keeps working unchanged
