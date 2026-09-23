---
type: task
status: todo
id: task-ui-docs-refresh
title: "Docs refresh after waves 1-2: /api/item note and the current smoke:tui-board steps"
parent: ui-foundation
labels: [ui, docs]
priority: p3
created: "2026-09-23"
updated: "2026-09-23"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ui-docs-refresh.md
  Leaves live only under a story. id is the filename stem: task-ui-docs-refresh.
  CLI `arggon create task ui-docs-refresh` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Docs refresh after waves 1-2: /api/item note and the current smoke:tui-board steps

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-23 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Two doc drifts found during wave-2 reviews:

1. `cli/README.md` board paragraph does not mention the serve-only `GET /api/item?id=` detail route added by `task-board-item-detail` (PR #412) — the CLI package README describes the board surface.
2. `ArggonManager/docs/engineering.md` §Smoke test and `CONTRIBUTING.md` still describe `npm run smoke:tui-board` as "sends `q`, asserts headers + seeded id"; the harness now drives board → filter → detail pane → Esc → q (PR #410).

## Acceptance

- [ ] `cli/README.md` board paragraph documents `/api/item` (serve-only, kernel bounded read, read-only, `?id=` contract)
- [ ] `ArggonManager/docs/engineering.md` §Smoke test + `CONTRIBUTING.md` UI-smoke section describe the current `smoke:tui-board` steps and assertions
- [ ] Grep the changed phrases across `README.md`, `docs/`, `cli/README.md` — no other statement becomes false
- [ ] Docs-only PR; `cli` check green
