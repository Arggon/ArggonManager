---
type: task
status: in_progress
id: task-report-trend
title: report --trend from git history
assignee: Arggon
branch: feat/story-report-trend
parent: story-report-trend
labels: []
created: "2026-09-11"
updated: "2026-09-12"
claimed_at: "2026-09-12T01:19:07.186Z"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-report-trend/task-report-trend.md
  Leaves live only under a story. id is the filename stem: task-report-trend.
  CLI `arggon create task report-trend` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# report --trend from git history

## Context

Parse status transitions from commit history of item files; bucket by ISO week.

## Acceptance

- [x] Cycle time per leaf (first claim → terminal), weekly completions series, `--since` filter
- [x] Deterministic on a fixed repo snapshot (golden test)
