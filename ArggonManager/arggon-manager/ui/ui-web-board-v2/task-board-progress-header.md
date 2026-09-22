---
type: task
status: todo
id: task-board-progress-header
title: "Web board progress header: per-epic rollup, blocked and priority mix"
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-progress-header.md
  Leaves live only under a story. id is the filename stem: task-board-progress-header.
  CLI `arggon create task board-progress-header` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board progress header: per-epic rollup, blocked and priority mix

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The board shows per-column counts only; progress per epic/story, blocked items with reasons, WIP and priority mix require running `arggon report`. A compact rollup header would make the board the standing PM view without duplicating report logic.

## Acceptance

- [ ] A summary panel computes from the kernel report/aggregation (single source, no copied rules): per-epic completion (done+cancelled/total), blocked count with reasons, in_progress (WIP) count and priority mix
- [ ] With `--group-by story`, group headers show a completion fraction
- [ ] Payload stays bounded (computed at render, no per-item bloat); static + serve parity; tests
- [ ] README + docs/json-output.md updated
