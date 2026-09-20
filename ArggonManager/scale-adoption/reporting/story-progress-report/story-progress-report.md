---
type: story
status: done
id: story-progress-report
title: Progress rollup report
assignee: Arggon
branch: feat/story-progress-report
parent: reporting
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Progress rollup report

## Context

v0 deliberately has no status rollup. A read-only report can still compute per-container completion (done+cancelled vs total) without ever writing container status.

## Acceptance

- [x] `arggon report` shows counts per story, epic, and initiative (shipped with `report`; verified live and covered by report.test.ts)
- [x] Markdown export suitable for standups (`arggon report --format markdown`)
- [x] Report never mutates frontmatter (read-only collection, covered by a byte-identical file test)
