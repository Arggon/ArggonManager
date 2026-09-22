---
type: task
status: todo
id: task-board-column-controls
title: "Web board column controls: collapse, hide terminal columns, sticky headers"
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-column-controls.md
  Leaves live only under a story. id is the filename stem: task-board-column-controls.
  CLI `arggon create task board-column-controls` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board column controls: collapse, hide terminal columns, sticky headers

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The board always renders five equal columns; on a mature tracker the done column dominates the page (41,662 px of 41,752 px body height on 2026-09-22). There is no collapse, no hide-done lens, and headers scroll away.

## Acceptance

- [ ] Any column can be collapsed/expanded; a toggle can hide `done`/`cancelled`; the header keeps the count visible when collapsed
- [ ] Column headers stay visible while scrolling (sticky) without breaking the existing grid/responsive rules
- [ ] State persists in localStorage (documented choice) and resets cleanly; static and serve modes behave the same
- [ ] No runtime dependencies; tests + Playwright-CLI smoke; README updated
