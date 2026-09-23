---
type: bug
status: in_progress
id: bug-tui-selection-offscreen
title: "TUI selection can leave the screen: no scroll window in long columns"
assignee: Arggon
branch: fix/bug-tui-selection-offscreen
parent: ui-tui-v2
labels: [tui, ui]
priority: p1
created: "2026-09-22"
updated: "2026-09-23"
claimed_at: "2026-09-23T00:00:53.024Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-tui-selection-offscreen
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/bug-tui-selection-offscreen.md
  Leaves live only under a story. id is the filename stem: bug-tui-selection-offscreen.
  CLI `arggon create bug tui-selection-offscreen` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI selection can leave the screen: no scroll window in long columns

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`renderTui` renders body rows from index 0 (no scroll offset) and `clampTuiState` clamps the selection to the column length, not to the visible body height — so arrow-down past the last visible row selects an item that is never drawn.

Reproduced on 2026-09-22 against main c4a61b7c (this repo, 288 items; done column = 281 cards):

- Pure renderer, 80x24: 30 todo items, body rows = 21, `handleKey` accepts card index 25, the frame renders ids `task-demo-00`..`task-demo-20` and **does not contain** `task-demo-25` (no highlight rendered).
- Live pty, 160x42, done column selected, `↓`x60: the last frame shows rows 0..38 (early done items) with **0** body highlight sequences (`\x1b[7m`); the selected card is off-screen and the user has no feedback.

Impact: any column with more cards than the terminal body height (every mature tracker) has unreachable-by-vision items; the footer does not say where the selection is.

## Acceptance

- [ ] A scroll window keeps the selected card visible at all times (window follows the selection; no paging past the end; empty rows never shown when items exist)
- [ ] PgUp/PgDn (and Home/End) scroll predictably; the footer shows the position (e.g. `row 61/281`)
- [ ] Golden tests cover: selection at the bottom of a long column renders the highlighted row; window stays valid after resize and after filters change
- [ ] pty evidence (before/after) in the review verdict; README keybindings updated

### 2026-09-23 @ses_f346f75d7ffe1ji5AVdwAh8Ewo
## Implementation (PR #405, branch `fix/bug-tui-selection-offscreen`, head `a203305b`)

Scroll window over the selected column, pure and golden-tested:

- `TuiState.scroll` (window start) + exported `followTuiScroll(card, scroll, count, rows)` and `tuiBodyRows(height)`; `renderTui` re-derives the window per frame (so a frame is always valid), `clampTuiState` re-derives it after filters/resize/tree re-reads.
- `PgUp`/`PgDn` page the selection, `Home`/`End` jump to the column edges (xterm/vt220/rxvt sequences); the CSI splitter now reads whole escape sequences (`\x1b[6~` used to split into unknown keys), `↑`/`↓` clamp to the column count when counts are known.
- Footer leads with the position in every mode (`row 61/281 · …`), so narrow terminals clip the help tail, never the position.
- `runTuiBoard` stays wiring-only (re-read before clamp, re-clamp on resize); zero writes, raw ANSI, no new deps (ADR 0001); per-cell padding + id/title sanitization untouched; filter/search behavior unchanged.

## Gates (all run in the worktree)

- `npm test` → 95 files / **1542 tests passed** (41 in `cli/src/tui.test.ts`).
- `npm run lint` → clean. `npm run build` → clean; committed plugin bundle unchanged (no drift).
- `npm run arggon -- validate --json` → `{"ok":true,...,"errors":[],"warnings":[]}`.
- `npm run smoke:tui-board` → passed (frame carries the five status headers + seeded id).
- CI on `a203305b`: `cli` pass (4m29s), `tasks-validate` pass (37s), `ui-smoke` pass (1m35s) — runs 35801209730 / 35801209776.

## Acceptance evidence

- Scroll window keeps the selected card visible, no paging past the end, no empty rows while items exist: `followTuiScroll` unit cases + goldens (bottom of a 30-card column at 200x24 and the 80x24 repro; resize grow/shrink; filter shrink to 10 cards → `row 10/10`).
- PgUp/PgDn/Home/End + footer position: golden paging test (no overshoot at either edge, `PgUp` at the top stays put) and a loop-level test driving `PgDn`/`End` as single CSI keys through `runTuiBoard` plus a resize.
- pty evidence + README keybinding table (below).

## Before / after pty (`script`-driven, 160x42, this tracker, done column 284 cards, `→`x3 + `↓`x60)

BEFORE (base `e1ccacfc`, built from `git show e1ccacfc:cli/src/tui.ts`):
```
body highlights (\x1b[7m) in last frame: 0
done first body row: "  E agent-coordination agent-co…"   <- window still starts at row 0
done last body row:  "  B bug-scaffold-empty-files sc…"
footer: "←/→ column · ↑/↓ card · / search · enter path · q quit"
```

AFTER (same fixture, same keys):
```
body highlights (\x1b[7m) in last frame: 1
done first body row: "  B bug-convention-config-scala…"   <- window follows the selection (start 22)
done last body row:  "> I scale-adoption Scale adopti…"   <- selected card drawn + highlighted
footer: "row 61/284 · ←/→ column · ↑/↓ card · PgUp/PgDn page · home/end · / search · enter path · q quit"
```

AFTER (`→`x3, `PgDn`, `PgDn`, `End`): highlighted cell `"> E views Views and filtering"`, footer `row 284/284 · …`.

## Notes / open questions

- Known issue `bug-native-start-worktree-no-install` hit: `start --worktree` skipped the claim commit (`tsx: command not found`); ran `npm ci` in the worktree and committed the claim manually (`28f1b139`).
- Pre-existing, not addressed: a CSI sequence split across two stdin chunks (a lone trailing `ESC` in one chunk) is still treated as the Esc key; terminals write sequences atomically in practice, so the fix keeps the per-chunk parser.
- By design: at 80 columns the help tail (`enter path · q quit`) clips because the position leads; full help fits from ~92 columns (README has the full table).
