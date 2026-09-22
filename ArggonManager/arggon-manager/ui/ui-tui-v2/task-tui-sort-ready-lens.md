---
type: task
status: todo
id: task-tui-sort-ready-lens
title: "TUI sort and ready lens: priority/next rank, ready-only view"
parent: ui-tui-v2
labels: [tui, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-sort-ready-lens.md
  Leaves live only under a story. id is the filename stem: task-tui-sort-ready-lens.
  CLI `arggon create task tui-sort-ready-lens` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI sort and ready lens: priority/next rank, ready-only view

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Cards are sorted lexicographically by id; the kernel's priority field and `next` ranking (claimable + todo + unclaimed + deps terminal, by downstream weight) are invisible in the TUI, so the terminal view cannot answer "what should I pull next?".

## Acceptance

- [ ] `s` cycles sort: id | priority | next-rank (deterministic tie-breaks), applied per column
- [ ] `r` toggles a ready-only lens using the kernel `isReady`/claim rules (no copied predicate)
- [ ] Rows surface priority, assignee and blocked markers; the header shows the active sort/lens
- [ ] Golden tests + pty evidence; README keybindings updated
