---
type: story
status: todo
id: story-progress-report
title: Progress rollup report
parent: reporting
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Progress rollup report

## Context

v0 deliberately has no status rollup. A read-only report can still compute per-container completion (done+cancelled vs total) without ever writing container status.

## Acceptance

- [ ] `arggon report` shows counts per story, epic, and initiative
- [ ] Markdown export suitable for standups
- [ ] Report never mutates frontmatter
