---
type: task
status: todo
id: task-board-static-details
title: "Static board export: optional bounded item details (--details)"
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p3
created: "2026-09-23"
updated: "2026-09-23"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-static-details.md
  Leaves live only under a story. id is the filename stem: task-board-static-details.
  CLI `arggon create task board-static-details` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Static board export: optional bounded item details (--details)

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-23 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`task-board-item-detail` (merged, PR #412) shipped the drawer **serve-only**: the served page fetches `/api/item?id=` through the kernel bounded read (prose clipped to 8 KB, 4 KB per comment, last 3 comments), while the static export stays lean and byte-identical. Consequence: sharing a static `board.html` (the primary artifact for review hand-offs) loses the drawer. The acceptance explicitly allowed the serve-only path with the trade-off documented; this is the opt-in follow-up.

## Acceptance

- [ ] Optional `--details` flag on `arggon board` (static) embedding a bounded per-item detail — documented per-item cap (prose bytes) and a measured payload statement on this repo's 316-item tracker in README
- [ ] The static page reuses the serve drawer client with the embedded payload instead of the fetch; works from `file://` with no server; no runtime dependencies
- [ ] Without the flag the static export stays byte-identical to today (regression test)
- [ ] Tests: unit (embedding/caps/escaping) + an `@smoke` case for the static-with-details export; payload-size evidence in the verdict
- [ ] README board section + `ArggonManager/docs/json-output.md` board section updated (flag + payload contract); `cli/README.md` note aligned with `task-ui-docs-refresh`
