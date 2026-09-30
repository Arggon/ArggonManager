---
type: task
status: in_progress
id: task-native-panel-refresh-filter
title: "OpenCode panel: live refresh, fold/filter and paging"
assignee: Arggon
branch: feat/task-native-panel-refresh-filter
parent: ui-native-panel-v2
labels: [opencode-seam, tui, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T15:23:01.347Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-native-panel-refresh-filter
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-native-panel-v2/task-native-panel-refresh-filter.md
  Leaves live only under a story. id is the filename stem: task-native-panel-refresh-filter.
  CLI `arggon create task native-panel-refresh-filter` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode panel: live refresh, fold/filter and paging

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- Ticked against the PR branch 2026-09-30; evidence in the review comment. -->

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The sidebar snapshot is created on mount with no setter (never refreshes) and the panel only reloads on `r`; done/cancelled items crowd the tree and the 200-line limit hides the rest with a single `… more item(s)` hint.

## Acceptance

- [x] Panel and sidebar refresh on tracker changes (or session events) instead of mount-only; `r` remains a manual reload
- [x] Fold/hide: collapse subtrees, hide `done`/`cancelled`, and a text filter on id/title; state kept per session
- [x] Paging beyond the 200-line cap (or an explicit, navigable "more" affordance)
- [x] Tests + a filtered/folded smoke capture; docs updated
