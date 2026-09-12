---
type: task
status: done
id: task-import-issues
title: arggon import-issues via gh
assignee: Arggon
parent: story-import-issues
labels: []
created: "2026-09-11"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-import-issues/task-import-issues.md
  Leaves live only under a story. id is the filename stem: task-import-issues.
  CLI `arggon create task import-issues` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon import-issues via gh

## Context

Import via `gh issue list`, mapping labels to labels and milestone dates to `x-milestone`; requires a parent story per issue (auto-created `story-imported-issues` when missing).

## Acceptance

- [x] `--dry-run` prints the mapping plan; real run writes items through the kernel (validate clean)
- [x] Idempotent by issue number recorded in the item body; closed issues import as `done`
