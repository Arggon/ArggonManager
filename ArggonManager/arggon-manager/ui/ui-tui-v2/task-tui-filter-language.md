---
type: task
status: todo
id: task-tui-filter-language
title: "TUI filter prompt: kernel filter predicates + saved views"
parent: ui-tui-v2
labels: [tui, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-filter-language.md
  Leaves live only under a story. id is the filename stem: task-tui-filter-language.
  CLI `arggon create task tui-filter-language` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI filter prompt: kernel filter predicates + saved views

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`/` filters by case-insensitive substring on id/title only. The kernel filter language (`lib/src/filter.ts`: `status:`, `type:`, `label:`, `assignee:`, `priority:`, `ancestor:`, free text) and the tracker's `x-views` saved views exist but no TUI surface uses them.

## Acceptance

- [ ] `/` accepts the documented predicate subset parsed with the kernel parser where possible; unknown predicates show an inline hint instead of crashing or silently matching nothing
- [ ] `v` cycles saved views (name + expression shown in the header); Esc clears the filter/view
- [ ] Filtered empty columns stay informative (count 0 + empty mark), footer shows the active filter and matched totals
- [ ] Parser parity tests against `lib/src/filter.ts`; README keybindings + filter docs updated
