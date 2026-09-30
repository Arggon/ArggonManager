---
type: task
status: in_progress
id: task-board-live-reload-state
title: Web board live reload preserves view state + connection banner
assignee: Arggon
branch: feat/task-board-live-reload-state
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T15:28:32.453Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-typecheck-e2e-specs-task-board-live-reload-state
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-live-reload-state.md
  Leaves live only under a story. id is the filename stem: task-board-live-reload-state.
  CLI `arggon create task board-live-reload-state` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board live reload preserves view state + connection banner

## Context

Serve mode reloaded the whole page on any tracker write with no state kept and
no signal when the SSE stream died. Closed with a snapshot/restore client plus
a connecting/live/reconnecting pill, both serve-only (see evidence below).

## Acceptance

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Serve mode broadcasts an SSE `reload` and the page runs `location.reload()` for any tracker change (`cli/src/board-serve.ts` RELOAD_SCRIPT), so scroll position, filters, collapsed columns and an open drawer are lost on every write. There is also no indicator when the SSE stream drops and the view goes stale.

## Acceptance

- [x] A live reload preserves scroll, filter/lens, collapsed columns and an open drawer (state snapshot/restore around rebuild, or a targeted DOM refresh without full `location.reload()`). *(Snapshot/restore around the existing full reload: scroll, filter expression and the open drawer id (`data-item-id` on the drawer, set/cleared by `wireBoardDetail`) travel in `sessionStorage`; after the reload the filter is re-applied, scroll restored, and the drawer reopened through the same card-click path. A drawer whose card no longer exists stays closed — the pre-existing delete test pins that. Collapsed columns: no such state exists on the board yet; `task-board-column-controls` keeps its collapse state in localStorage, which survives `location.reload()` natively, so nothing to carry here.)*
- [x] A connection state indicator (connecting/live/reconnecting) driven by EventSource `onopen`/`onerror`; a stale board is visually marked. *(`#board-conn` pill, `role=status` `aria-live=polite`: `connecting …` → `live` on open → `reconnecting — board may be stale` on error, back to `live` on reconnect. Strictly passive (`pointer-events:none`) — the drawer-close interception the smoke lane caught on the first run. All three contrast pairs clear WCAG AA; the zero-exclusion axe scan runs with the pill on the ready page.)*
- [x] Manual refresh and the offline static export are unaffected (the reload client is serve-only). *(All client changes stay in `RELOAD_SCRIPT`, injected only by `render()` in board-serve.ts; `renderBoardHtml` output is unchanged — unit-pinned: the static render contains no `EventSource`, `board-conn` or `board-live-state`.)*
- [x] Tests (serve unit + Playwright-CLI smoke: move a card, assert preserved state and banner transitions); docs updated. *(Serve unit: injected-client contract + static-export isolation in `board-serve.test.ts`. Playwright: 3 new `@smoke` tests — banner live, stale marking with `/events` aborted, and the preservation test (external CLI write → reload → filter + drawer + exact scroll offset restored, proven via a window marker that only the pre-reload page holds). README `--serve` bullet updated.)*

### 2026-09-30 @Arggon
Evidence (worker, PR #471): Implementation = snapshot/restore around the existing full location.reload() (server render stays authoritative). Snapshot (sessionStorage, per tab): scroll x/y, filter expression, open drawer id. Drawer id exposed via data-item-id on #board-drawer, set/cleared by wireBoardDetail. Restore order: filter -> scroll -> drawer reopen (same click path; missing card = stays closed). Connection pill #board-conn (role=status, aria-live=polite): connecting -> live (onopen) -> reconnecting - board may be stale (onerror), auto-flips back on reconnect; pointer-events:none after the smoke lane caught it intercepting the drawer close button; contrast pairs #59636e/#1a7f37/#cf222e on #fff all pass AA and ride under the zero-exclusion axe scan.

Browser evidence (ADR-0008 style, npx playwright test --grep @smoke on the built bin): first run 2 failures, both real - (1) banner intercepted drawer-close clicks (fixed: pointer-events:none, drawer test green), (2) scroll assert 150 vs 157 - the preservation itself was exact (157 was the offset after Playwright's scroll-into-view at snapshot time); test now captures the true pre-write offset and asserts equality. Final: 16 passed (13 pre-existing incl. axe + delete-drawer-gracefully, +3 new: banner-live, stale-marking, preserve-filter/drawer/scroll).

Gates: npm test exit 0 (board suites: 97 tests incl. new injected-client + static-isolation units); npm run lint 0; npm run build 0; npm run check:plugin 0; arggon validate --json ok:true. Collapsed columns: nothing to preserve today - column-controls (next in lane) stores collapse in localStorage which survives reload natively.
