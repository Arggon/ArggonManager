---
type: task
status: in_progress
id: task-columns-view-shows-only-task-and-bug-leaves
title: Columns view shows only task and bug leaves
assignee: arggon-delivery-lead
branch: feat/task-columns-view-shows-only-task-and-bug-leaves
parent: story-hierarchy-navigation
labels: []
created: "2026-10-16"
updated: "2026-10-17"
claimed_at: "2026-10-17T20:01:24.388Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-columns-view-shows-only-task-and-bug-leaves
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-hierarchy-navigation/task-columns-view-shows-only-task-and-bug-leaves.md
  Leaves live only under a story. id is the filename stem: task-columns-view-shows-only-task-and-bug-leaves.
  CLI `arggon create task columns-view-shows-only-task-and-bug-leaves` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Columns view shows only task and bug leaves

## Context

Product-owner request 2026-10-16, confirmed as a feature (not a bug): with grouped ancestry off (columns view, `#board-view-toggle` unpressed), the board should show only tasks — containers (initiatives/epics/stories) belong to the grouped-ancestry tree view. Verified against the live board that columns today render all types (initiative 28, epic 72, story 236, task 1696, bug 668 by `data-type` count), so this is a behavior change, not a fix. Claimable leaves are task/bug (stories are claimable containers per `cli/src/board.ts:356` but render as hierarchy) — maker to follow the owner's "only tasks" wording for tasks and confirm bugs stay (they are leaves) or brief otherwise.

## Acceptance

- [x] Columns view (grouped ancestry off) renders only task/bug leaf cards; initiatives/epics/stories render only in the grouped-ancestry tree view, on both static export and serve
- [x] Column counts, summary panel and card totals stay consistent with what is rendered (or are labeled); lens/filter and the detail drawer behave sanely for the hidden types
- [ ] Tests pin it (unit/parity, incl. serve-vs-static shape); `arggon validate` green; prettier clean; PR opened

## Notes

### 2026-10-17 @arggon-maker
## Maker evidence — columns view now shows only task/bug leaves

### Change
cli/src/board.ts renderBoardHtml: introduced leafItems = sorted.filter(type === task || type === bug). leafItems drives the columns, column counts (statusTotals), the lens snapshot (lensItems), story group headers, and the summary panel (buildBoardSummary(leafItems)). sorted (all items) still drives the grouped-ancestry tree (renderBoardTree) and open-descendant counts — untouched, so containers keep their home in the tree view.

cli/src/board-serve.ts startBoardServer render(): same leafItems filter for the summary panel, static/serve parity.

### Filter semantics per surface
- Columns view (grouped ancestry off): only task/bug leaf cards render; data-type == {task, bug}; containers never appear as column cards
- Grouped-ancestry tree: all types, untouched, nested by recorded parent edges
- Column counts / summary panel: derive from filtered leaf set; match rendered cards
- Lens/filter (applyBoardFilter): operates on leafItems snapshot
- Detail drawer: GET /api/item?id=<id> works for any type on serve; hidden types remain reachable
- Sorting (wave 2): applies within the filtered leaf set (sortByUpdated before filter)

### Commands run (expected vs observed)
- npm run vitest run cli/src/board.test.ts: 155 passed (incl. 5 new leaf-filter pins)
- npm run vitest run cli/src/board-parity.test.ts: 23 passed (incl. new static-vs-serve leaf parity)
- npm run vitest run cli/src/board-serve.test.ts: 31 passed
- npm run vitest run cli/src/cli.test.ts: 43 passed (--github fixture now uses task leaf)
- npm run vitest run (full): 3685 passed / 166 files
- npx tsc -p tsconfig.json: clean
- npx eslint <touched>: clean
- npx prettier --check <touched>: clean
- npm run arggon -- validate: ok (0 warnings, convention v5)

### Files changed
cli/src/board.ts, cli/src/board-serve.ts, cli/src/board.test.ts, cli/src/board-parity.test.ts, cli/src/board-serve.test.ts, cli/src/cli.test.ts, cli/README.md, item body (acceptance checklist ticked 2 of 3)

### Notes
- PR not opened (lead opens per role boundary); branch pushed to origin
- item status left as in_progress per maker/lead boundary

### handoff 2026-10-17 @arggon-maker (session: ses_eb48aeb38ffem7z6oUPQW8YQMY) — next: Lead: open PR from branch feat/task-columns-view-shows-only-task-and-bug-leaves and flip item to done after merge
- branch: feat/task-columns-view-shows-only-task-and-bug-leaves
- open questions: None
