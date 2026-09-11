---
type: task
status: todo
id: task-report-markdown
title: Export standup markdown summary
parent: story-progress-report
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Export standup markdown summary

## Context

One copy-paste block for standups: per-epic progress lines plus blocked items with reasons.

## Acceptance

- [ ] `--format markdown` writes to stdout
- [ ] Blocked section lists `blocked_reason` per item
- [ ] No network or GitHub calls — pure tree read
