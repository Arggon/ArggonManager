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
