---
type: task
status: done
id: task-deps-next-ready
title: next --ready and dependency filters
assignee: Arggon
parent: story-deps-queries
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/deps-graph/story-deps-queries/task-deps-next-ready.md
  Leaves live only under a story. id is the filename stem: task-deps-next-ready.
  CLI `arggon create task deps-next-ready` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# next --ready and dependency filters

## Context

Extend `next` ranking and the filter parser with dependency predicates.

## Acceptance

- [x] `next` skips items with open `depends_on` (they are not ready) and says so in `reason`
- [x] `next --ready` limits the pool to unblocked items; empty pool stays `suggestion: null`
- [x] Filter predicates `depends-on:`/`blocked-by:` compose with AND/! like the existing ones
