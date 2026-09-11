---
type: task
status: done
id: task-report-markdown
title: Export standup markdown summary
assignee: Arggon
parent: story-progress-report
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Export standup markdown summary

## Context

One copy-paste block for standups: per-epic progress lines plus blocked items with reasons.

## Acceptance

- [x] `--format markdown` writes to stdout (unknown formats fail with REPORT_FAILED; default table unchanged)
- [x] Blocked section lists `blocked_reason` per item (with the item's story ← epic chain)
- [x] No network or GitHub calls — pure tree read (kernel loadItems only)
