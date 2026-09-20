---
type: task
status: done
id: task-milestone-board
title: Group board by milestone
assignee: Arggon
parent: story-milestones
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Group board by milestone

## Context

Prototype grouping on the static board once the design lands.

## Acceptance

- [x] `board --group-by milestone` opt-in flag (unknown fields fail with BOARD_FAILED; --json reports groupBy)
- [x] Items without a milestone group last (ascending milestone order; no-milestone header only when the column mixes both)
- [x] Static export stays self-contained HTML (pure string renderer, no external assets; grouping is render-time only)
