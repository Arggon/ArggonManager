---
type: task
status: in_progress
id: task-board-progress-header
title: "Web board progress header: per-epic rollup, blocked and priority mix"
assignee: Arggon
branch: feat/task-board-progress-header
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T20:04:24.697Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-progress-header
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

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The board shows per-column counts only; progress per epic/story, blocked items with reasons, WIP and priority mix require running `arggon report`. A compact rollup header would make the board the standing PM view without duplicating report logic.

## Acceptance

- [x] A summary panel computes from the kernel report/aggregation (single source, no copied rules): per-epic completion (done+cancelled/total), blocked count with reasons, in_progress (WIP) count and priority mix
- [x] With `--group-by story`, group headers show a completion fraction
- [x] Payload stays bounded (computed at render, no per-item bloat); static + serve parity; tests
- [x] README + docs/json-output.md updated

### 2026-09-30 @Arggon
Evidence (PR #495, branch feat/task-board-progress-header):

- Single source: report.ts now exports aggregateReport (runReport's aggregation over already-loaded items; parity test pins viaPure.groups/blocked == runReport's) and completedOf (the done+cancelled rule, now used by formatReportMarkdown too); view-model.ts adds priorityCounts (exact tokens; unset/invalid -> none). No rule is restated anywhere in the board.
- Gates: npm test 1854/1854, npm run lint, npm run build, npm run check:plugin exit 0 (bundle regenerated — report/view-model are inlined), arggon validate --json ok:true, npx playwright test --grep @smoke 25/25 (23 pre-existing + 2 new; the lane's axe scan now covers the panel — zero exclusions, still green).
- Panel renders: epics one row each (this repo: agent-coordination 19/20 ... ui 27/40), wip 3, priority mix 'p0 0 · p1 0 · p2 11 · p3 13 · none 2', blocked 0. Screenshot /tmp/evidence-summary-header.png (file://, 368-item tracker); grouped export head renders '⚑ arggon-manager 3/5'.
- Bounded: no per-item payload — one row per epic, one entry per blocked leaf, five buckets; computed at render via buildBoardSummary from the already-loaded items.
- Without the summary option (direct renderBoardHtml callers) the output is unchanged (unit-pinned); runBoard and serve always pass it (static + serve parity, @smoke-asserted on the serve page and a grouped static export).

### handoff 2026-09-30 @Arggon — next: Coordinator: review PR #495; note the panel is covered by the @smoke axe scan (test 1) — keep that ordering when refactoring the spec
- branch: feat/task-board-progress-header
