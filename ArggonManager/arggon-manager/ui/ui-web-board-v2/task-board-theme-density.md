---
type: task
status: done
id: task-board-theme-density
title: Web board dark mode and density toggle
assignee: Arggon
branch: feat/task-board-theme-density
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-30"
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


## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The board hardcodes `color-scheme: light` with fixed density; dark is table stakes for a surface reviewers keep open, and a compact density would tame 281-card columns.

## Acceptance

- [x] Light/dark follows `prefers-color-scheme` and can be overridden by a toggle persisted in localStorage; `color-scheme` is set correctly on the root so native controls match
- [x] Contrast meets WCAG AA for text, badges and columns in both themes (evidence in the review verdict)
- [x] No theme flash on load (theme applied before first paint)
- [x] Compact/comfortable density toggle keeps card content readable and the grid intact
- [x] Static + serve parity; tests for the state plumbing + screenshot evidence; README updated


### 2026-10-01 @Arggon (coordinator salvage)

The original worker went silent mid-implementation (quota). This coordinator
completed and verified the uncommitted WIP it left in the worktree: theme
(auto via prefers-color-scheme + persisted toggle) and density (compact /
comfortable) with contrast assertions extended to the dark palette and 29-step
@smoke coverage. Landed via PR after #501 (which merged empty — claim-only —
before the WIP existed; coordinator error, noted for the record). Gates:
prettier clean, e2e tsc clean, board tests 96/96, full suite via CI, lint ok,
@smoke 28-29/29 (the known sticky-header SSE race flaked once in two full
runs; passes solo, bounded retry from #497 present), validate ok.

### 2026-09-30 @Arggon
Worker evidence (task complete, PR #504 merged): gates on the concluded tree — vitest 1936 passed, eslint clean, build OK, check:plugin exit 0, tsc e2e OK, arggon validate ok, playwright @smoke 29/29 including the dark-theme axe scan (zero exclusions). Dark palette asserted in board.test.ts: text pairs >= 4.5:1 (worst 4.63), boundaries >= 3:1 (worst 3.24). Screenshots of all four theme x density combos captured from a static export (resolved data-theme/data-density + computed body bg verified per combo).

FINDING (needs an item — not filed by me): boards rendered through tsx (npm run arggon -- board / board --serve) embed esbuild keepNames helper calls (__name) with no definition; the body script dies with '__name is not defined', so filter/drag/collapse/theme buttons are dead on that path (the <head> theme boot still runs — separate script block). Reproduced at d55e0933 (before this branch existed), so PRE-EXISTING, not a regression from this item. Invisible to gates: vitest transforms via oxc (no __name in toString) and the smoke lane drives dist/cli.js (tsc, no __name). Fix shape: either build boards from the tsc output or strip/inject the helper for embedded sources.
