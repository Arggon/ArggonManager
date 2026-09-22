---
type: task
status: todo
id: task-board-theme-density
title: Web board dark mode and density toggle
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-theme-density.md
  Leaves live only under a story. id is the filename stem: task-board-theme-density.
  CLI `arggon create task board-theme-density` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board dark mode and density toggle

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The board hardcodes `color-scheme: light` with fixed density; dark is table stakes for a surface reviewers keep open, and a compact density would tame 281-card columns.

## Acceptance

- [ ] Light/dark follows `prefers-color-scheme` and can be overridden by a toggle persisted in localStorage; `color-scheme` is set correctly on the root so native controls match
- [ ] Contrast meets WCAG AA for text, badges and columns in both themes (evidence in the review verdict)
- [ ] No theme flash on load (theme applied before first paint)
- [ ] Compact/comfortable density toggle keeps card content readable and the grid intact
- [ ] Static + serve parity; tests for the state plumbing + screenshot evidence; README updated
