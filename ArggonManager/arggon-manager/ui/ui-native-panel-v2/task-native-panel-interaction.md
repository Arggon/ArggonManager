---
type: task
status: in_progress
id: task-native-panel-interaction
title: "OpenCode panel: selection, detail and next/active jumps"
assignee: Arggon
branch: feat/task-native-panel-interaction
parent: ui-native-panel-v2
labels: [opencode-seam, tui, ui]
priority: p2
created: "2026-09-22"
updated: "2026-09-23"
claimed_at: "2026-09-23T01:09:45.579Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-native-panel-interaction
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-native-panel-v2/task-native-panel-interaction.md
  Leaves live only under a story. id is the filename stem: task-native-panel-interaction.
  CLI `arggon create task native-panel-interaction` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode panel: selection, detail and next/active jumps

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The W5 panel renders flat tree lines (header + counts + up to 200 lines) and only binds esc/f/r; there is no selection, no item detail and no way to jump to the kernel `next` suggestion or the session's active item (both already computed in `boardSnapshot`).

## Acceptance

- [ ] j/k (and PgUp/PgDn/g/G) move a visible selection over the tree; Enter opens the selected item (file path or an inline detail block with body/checklist), Esc returns
- [ ] `n` jumps to the `next` suggestion and `a` to the active session item; the header keeps totals and the counts line
- [ ] Width-aware clipping and sanitization preserved; no slot crash on a corrupt tracker (existing P1 guard)
- [ ] `npm run smoke:tui` extended with a selection capture; docs/opencod2 TUI section updated

### 2026-09-23 @ses_f343321cdffeKlIPKIsESUxF4P
## Evidence — task-native-panel-interaction (PR #411)

**Branch** `feat/task-native-panel-interaction` · **head before this comment** `6035c8a9be354901bfb03de01a267a834943b690` · PR https://github.com/Arggon/ArggonManager/pull/411 (base main, MERGEABLE, CI: cli pass, tasks-validate pass, ui-smoke pass).

### What shipped
- Selection cursor over the flattened tree: `j`/`k` (+ `↓`/`↑`), `PgUp`/`PgDn` (fixed 10-row page — the host passes no height), `g`/`Home`, `G`/`End`; `❯` gutter on every line; `r` resolves the cursor by id (survives reload while the item exists, clamps otherwise); the tree window follows the cursor past the 200-line cap (tail `… N more item(s)` preserved).
- `Enter` toggles a bounded inline detail block under the selected line: acceptance rows `[ ]`/`[x]` + prose through the kernel `runShow` path, sanitized (controls escaped) and bounded (16 rows, 200 chars/row, width clip); `Esc` closes the block first, then the panel.
- `n` jumps to the kernel `next` suggestion, `a` to the session's active item (ARGON_ITEM / feat|fix branch); toast when there is no target. Header totals + counts line unchanged.
- P1 guarantees kept: corrupt tracker → error header, no slot crash; sanitization; esc/f/r; display-only (no tracker writes; the purity test now also covers the detail read).

### Scope note (plumbing files beyond the listed set)
`tui.tsx` needs five new board exports, and `cli/src/plugin-copy.test.ts` pins tui imports == `BUNDLE_EXPORTS`, so two small plumbing edits were unavoidable: `cli/src/plugin-bundle.ts` (allowlist) and `opencode/plugins/arggon/index.ts` (re-export block). Neither is owned by the sibling wave-2 items. Bundle regenerated: `index.bundle.ts` 345,469 → 354,216 B (+8,747 B, +2.5%).

### Claim-commit workaround (bug-native-start-worktree-no-install)
`start --worktree` skipped the claim commit (`tsx: command not found`); ran `npm ci` in the worktree and committed manually `chore(tasks): started task-native-panel-interaction` (dfef2442), then pushed.

### Gates (all in the worktree)
- `npm test`: 95 files / 1581 tests pass.
- `npm run lint`: clean. `npx prettier --check` on every touched file: clean.
- `npm run build`: clean (postbuild regenerates the identical bundle).
- `npm run check:plugin`: exit 0 after the commit.
- `npx tsc -p cli/tsconfig.plugin.json` (strict plugin gate, also in `typecheck.test.ts`): exit 0.
- `npm run arggon -- validate --json`: `ok:true`, 0 warnings.
- `npm run smoke:tui`: 18/18 checks ok, exit 0. New interaction checks: cursor on `I tui-smoke`, `j` → `E core`, `n` → `T task-board-task`, `a` → `▶· S story`, `Enter` → `┌ argon detail · story — Story`. Capture excerpt (replayed screen frames, `ARGON_TUI_SMOKE_SCREEN=1`):
```
❯ · I tui-smoke — TUI smoke
❯   · E core — Core
❯       · T task-board-task — Board task
❯    ▶· S story — Story
❯    ▶· S story — Story
  ┌ argon detail · story — Story
```
- Unit coverage: `board.test.ts` (selection seed/move/clamp/jump/reload-by-id, window-follow, detail acceptance rows/hostile bytes/row+char bounds/error degradation) and `tui.test.ts` (`createBoardController` navigation, jump toasts, detail toggle, esc detail-first, pinned keymap id→bind table).

### Open questions
1. Only `j`/`n`/`a`/Enter are exercised in the PTY smoke; `PgUp/PgDn/g/G/Home/End` binds are pinned by unit tests using documented key names but not driven on the real runtime (extending the smoke is cheap if the coordinator wants it).
2. The smoke's screen replay implements the CSI subset OpenTUI emitted on 2.0.14; a runtime change to new sequences would fail loudly (never silently pass).
3. The `a` jump depends on ARGON_ITEM or the convention branch; the smoke pins `ARGON_ITEM=story` because the fixture is not a git repo.
