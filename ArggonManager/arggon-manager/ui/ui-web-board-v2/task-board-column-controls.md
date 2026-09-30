---
type: task
status: in_progress
id: task-board-column-controls
title: "Web board column controls: collapse, hide terminal columns, sticky headers"
assignee: Arggon
branch: feat/task-board-column-controls
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T15:53:14.657Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-typecheck-e2e-specs-task-board-live-reload-state-task-board-column-controls
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-column-controls.md
  Leaves live only under a story. id is the filename stem: task-board-column-controls.
  CLI `arggon create task board-column-controls` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board column controls: collapse, hide terminal columns, sticky headers

## Context

Five equal columns with no collapse, no terminal-column hiding and headers
that scroll away. Closed with heading collapse toggles, a done/cancelled
toggle, a layout reset, sticky headers and localStorage persistence — all
client-side on every board (see evidence below).

## Acceptance

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The board always renders five equal columns; on a mature tracker the done column dominates the page (41,662 px of 41,752 px body height on 2026-09-22). There is no collapse, no hide-done lens, and headers scroll away.

## Acceptance

- [x] Any column can be collapsed/expanded; a toggle can hide `done`/`cancelled`; the header keeps the count visible when collapsed. *(Every heading carries a `–`/`+` toggle (`aria-expanded`, dynamic `aria-label`); the collapsed column keeps only its heading with the count badge visible. The filterbar `hide done/cancelled` toggle (`aria-pressed`) hides both terminal columns.)*
- [x] Column headers stay visible while scrolling (sticky) without breaking the existing grid/responsive rules. *(`position: sticky; top: 0` on the heading with opaque column background via negative-margin/padding extension so cards slide under it; grid template and the `@media` rule untouched. Proven in the browser: with a 12-card todo column, the heading's `getBoundingClientRect().top` is `> 0` unstuck and exactly `0` scrolled 100px into the column.)*
- [x] State persists in localStorage (documented choice) and resets cleanly; static and serve modes behave the same. *(Key `arggon-board-columns-v1`, documented in README as a view preference that never touches the tracker; missing/corrupt/unavailable storage degrades to the default layout; the reset button restores and persists the default. All wiring renders and runs identically in the static export and serve pages — unit tests assert both renders.)*
- [x] No runtime dependencies; tests + Playwright-CLI smoke; README updated. *(Zero new dependencies. Unit: 5 new tests in board.test.ts (both renders); Playwright: 3 new `@smoke` tests — collapse/terminal/persist/reset flow, roving-anchor re-seat when the anchor's column collapses, sticky-header proof. README gained a `column controls` bullet.)*

### 2026-09-30 @Arggon
Evidence (worker, PR #474): Implementation lives in renderBoardHtml so static and serve are identical by construction - sticky h2 (position:sticky; top:0; z-index:5, opaque column bg via negative margins, grid/responsive rules untouched), per-heading collapse toggle (.col-toggle, aria-expanded + dynamic aria-label, en-dash/plus glyph), filterbar hide-done/cancelled (aria-pressed) + reset layout buttons, and a self-contained wireBoardColumns() embedded via toString() on every board. State: localStorage arggon-board-columns-v1 ({collapsed:[],terminalHidden}), corrupt/missing/unavailable storage degrades to defaults; reset persists the default. Keyboard: wireBoardKeyboardNav skips collapsed columns (visibleCards returns [] and ensureAnchor re-seats); wireBoardColumns takes the nav's ensureAnchor handle so any layout change re-seats the roving anchor. Zero new runtime dependencies.

Browser evidence (ADR-0008 style, npx playwright test --grep @smoke on the built bin, axe zero-exclusion with the new controls on the ready page): 16 passed - 13 pre-existing + collapse/terminal/persist/reset flow (incl. persistence across reload and reset persistence), anchor re-seat on collapsing the anchor's column, sticky proof (heading top >0 unstuck, exactly 0 scrolled into a 12-card column). First browser run: 16/16 green (the only lint catch was two unused catch bindings, fixed with optional catch binding; unrelated flake: cli/src/sync-smoke.test.ts failed once in a full-suite run - spawned-CLI init timing, passes standalone and in the final full rerun).

Gates: npm test exit 0 (107 files / 1794 tests, incl. 5 new board unit tests asserting BOTH renders); npm run lint 0; npm run build 0; npm run check:plugin 0; npx playwright test --grep @smoke 16 passed; arggon validate --json ok:true.
