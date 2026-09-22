---
type: task
status: todo
id: task-board-live-reload-state
title: Web board live reload preserves view state + connection banner
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-live-reload-state.md
  Leaves live only under a story. id is the filename stem: task-board-live-reload-state.
  CLI `arggon create task board-live-reload-state` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board live reload preserves view state + connection banner

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Serve mode broadcasts an SSE `reload` and the page runs `location.reload()` for any tracker change (`cli/src/board-serve.ts` RELOAD_SCRIPT), so scroll position, filters, collapsed columns and an open drawer are lost on every write. There is also no indicator when the SSE stream drops and the view goes stale.

## Acceptance

- [ ] A live reload preserves scroll, filter/lens, collapsed columns and an open drawer (state snapshot/restore around rebuild, or a targeted DOM refresh without full `location.reload()`)
- [ ] A connection state indicator (connecting/live/reconnecting) driven by EventSource `onopen`/`onerror`; a stale board is visually marked
- [ ] Manual refresh and the offline static export are unaffected (the reload client is serve-only)
- [ ] Tests (serve unit + Playwright-CLI smoke: move a card, assert preserved state and banner transitions); docs updated
