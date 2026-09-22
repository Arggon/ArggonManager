---
type: task
status: todo
id: task-board-filter-lenses
title: "Web board filter lenses: search, saved x-views and URL state"
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p1
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-filter-lenses.md
  Leaves live only under a story. id is the filename stem: task-board-filter-lenses.
  CLI `arggon create task board-filter-lenses` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board filter lenses: search, saved x-views and URL state

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The board renders every item (288 here) with no way to narrow the view: the served page has 0 input/select/button elements, and the done column alone is 41,662 px tall (281 cards). Meanwhile the CLI owns a filter language (`lib/src/filter.ts`, `list --filter`, `x-views` saved views) that no UI surface consumes. This is the single highest-leverage web-board improvement: it makes large trackers usable and reuses the kernel's semantics instead of inventing a board dialect (viewer-spike §5).

## Acceptance

- [ ] A filter/search control in the board (static export included, no runtime deps): free text on id/title plus predicates for `type`, `status`, `label`, `assignee`, `priority` and ancestor — semantics kept 1:1 with the kernel filter parser, with a documented supported subset and tests that prove the parity
- [ ] Saved views from the tracker `x-views` render as lens chips (name + expression in the tooltip); `@me` resolves like the CLI
- [ ] The active lens/filter is reflected in the URL hash and survives reload/share/copy; clearing restores the full board; per-column counts reflect the filtered set
- [ ] No `x-views` in the tracker (or no server) degrades cleanly; static export unchanged when no filter is applied
- [ ] Unit tests for the client-side predicate mirror + a Playwright-CLI smoke (apply a lens, column shrinks, URL reflects it); README + docs/json-output.md updated
