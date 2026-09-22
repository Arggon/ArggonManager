---
type: task
status: todo
id: task-native-panel-refresh-filter
title: "OpenCode panel: live refresh, fold/filter and paging"
parent: ui-native-panel-v2
labels: [opencode-seam, tui, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-22"
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

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The sidebar snapshot is created on mount with no setter (never refreshes) and the panel only reloads on `r`; done/cancelled items crowd the tree and the 200-line limit hides the rest with a single `… more item(s)` hint.

## Acceptance

- [ ] Panel and sidebar refresh on tracker changes (or session events) instead of mount-only; `r` remains a manual reload
- [ ] Fold/hide: collapse subtrees, hide `done`/`cancelled`, and a text filter on id/title; state kept per session
- [ ] Paging beyond the 200-line cap (or an explicit, navigable "more" affordance)
- [ ] Tests + a filtered/folded smoke capture; docs updated
