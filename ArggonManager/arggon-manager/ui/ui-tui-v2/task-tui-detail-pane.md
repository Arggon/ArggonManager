---
type: task
status: todo
id: task-tui-detail-pane
title: "TUI detail pane: read an item without leaving the board"
parent: ui-tui-v2
labels: [tui, ui]
priority: p1
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-detail-pane.md
  Leaves live only under a story. id is the filename stem: task-tui-detail-pane.
  CLI `arggon create task tui-detail-pane` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI detail pane: read an item without leaving the board

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Enter currently prints the selected item's file path to the footer (README keybindings); reading the body, acceptance checklist or dependencies means quitting the TUI and opening the file. The kernel read path already provides everything the pane needs.

## Acceptance

- [ ] Enter opens a read-only detail pane for the selected item: title/type/status/priority/assignee, body (sanitized + wrapped, scrollable when longer than the pane), acceptance checkboxes, labels, dependencies with their statuses, branch/worktree_path/milestone and the path
- [ ] Esc (or Enter) returns to the board with the selection, filter and scroll window preserved; a documented fallback for very narrow terminals
- [ ] Content is sanitized through the existing human-text path; the pane never writes
- [ ] Golden tests + pty evidence in the verdict; README keybindings updated

### 2026-09-23 @ses_f343321d6ffeYUdt96vaXCUSTA
## Verdict evidence — PR #410 · head f833ea09 · branch feat/task-tui-detail-pane

CI: cli pass (4m31s) · ui-smoke pass (1m31s — runs smoke:tui-board in the pty on the PR head) · tasks-validate pass.

### What landed
- `cli/src/tui.ts` (+ golden tests in `cli/src/tui.test.ts`; README keybinding table split into board / detail pane + a pane paragraph; `smoke/tui-board-smoke.ts` + its predicate tests).
- `enter` opens a read-only pane for the selected card: title / type / status / priority / assignee, labels, milestone, parent, branch, worktree_path, path, dependencies with their statuses (open deps keep the board's marker; unknown ids count as open), the acceptance rows with their count (the exact task-list rule the cascade counts) and the body (prose + comment history).
- Bodies ride the same kernel read pass as the cards: `loadTuiItems` now also returns id -> raw body from the already-parsed items (no second read); the pane has no write path anywhere.
- Sanitization: every repo-controlled field value and every body line goes through `sanitizeHumanTextUncapped` (the existing human-text path, task-row-table-stdout-sanitize) before wrapping — a hostile body/field renders as inert `\uXXXX` text.
- Wrapping + caps (documented in code and README): word wrap with hard-break for long words; 400 source body lines / 1000 rendered lines, each truncation named by a marker line; width < 40 falls back to the stacked layout (one field per line, values wrapped, never clipped).
- Keys: `esc`/`enter` close, `↑`/`↓` one line, `PgUp`/`PgDn` one page, `home`/`end` ends, `q`/`Ctrl-C` quit. The pane reducer never touches column/card/scroll/filter, so the board returns exactly as left. Raw SGR only, no new dependencies (ADR 0001).

### Gates (worktree: /home/arggon/Projects/ArggonManager-task-tui-detail-pane)
~~~
npm test                           1601 passed | 95 files (24 new pane tests + 6 smoke-predicate tests)
npm run lint                       clean
npm run build                      ok (check:plugin green, bundle byte-identical)
npm run arggon -- validate --json  {"ok":true,...,"errors":[],"warnings":[]}
npm run smoke:tui-board            7/7 pty steps ok + 2 aggregate checks (passed)
~~~

### Golden tests (fresh, not just the pre-existing ones)
- content: title/fields/acceptance/dependencies at 120 cols; missing title -> id; vanished item marker; wrapping at 40 (every line <= width, source text preserved); stacked vs packed layout; body cap + rendered-line cap markers; hostile body line (ESC/BEL/U+2028) and hostile id/title/label/dep id rendered inert.
- frame: exact height/padded lines, window slice = content[scroll..], stale scroll clamped to the last page, bold header vs color:false, vanished item.
- reducer: Enter opens with the board fields untouched; esc and enter close with the board exactly restored; arrow/page/home/end scrolls clamped; board keys ignored inside the pane; q/Ctrl-C quit.
- loop: open -> PgDn -> esc returns to the same highlighted card and the item file is byte-identical afterwards; item deleted mid-session renders the vanished marker instead of a stale body.

### pty evidence (util-linux script, 200x40, real tracker, `/` -> task-tui-detail-pane -> → -> enter)
Before — board with the filter and the card selected (200-col frame, trailing padding stripped):
~~~
arggon board --tui · 1 item(s) · filter: task-tui-detail-pane
todo (0)   in_progress (1)   blocked (0)   done (0)   cancelled (0)
           > T task-tui-detail-pane TUI detail pan…
row 1/1 · ←/→ column · ↑/↓ card · PgUp/PgDn page · home/end · / search · enter detail · q quit
~~~
The pane on Enter — acceptance rows and the body top:
~~~
arggon detail · task-tui-detail-pane · esc back
T task-tui-detail-pane — TUI detail pane: read an item without leaving the board
type: task · status: in_progress · priority: p1 · assignee: Arggon
labels: tui, ui · milestone: (none)
parent: ui-tui-v2 · branch: feat/task-tui-detail-pane · worktree: /home/arggon/Projects/ArggonManager-task-tui-detail-pane
path: ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-detail-pane.md · dependencies: (none)
acceptance 0/5:
  [ ]
  [ ] Enter opens a read-only detail pane for the selected item: title/type/status/priority/…
body:
  <!-- Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-detail-pane.md …
row 1/45 · ↑/↓ line · PgUp/PgDn page · home/end · esc back · q quit
~~~
After PgDn + ↓ (the window moved, still the same pane):
~~~
arggon detail · task-tui-detail-pane · esc back
  [ ] Enter opens a read-only detail pane for the selected item: title/type/status/priority/assignee, body …
  [ ] Golden tests + pty evidence in the verdict; README keybindings updated
body:
  ### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
row 8/45 · ↑/↓ line · PgUp/PgDn page · home/end · esc back · q quit
~~~
After Esc — the same filter, the same selection, the same board:
~~~
arggon board --tui · 1 item(s) · filter: task-tui-detail-pane
todo (0)   in_progress (1)   blocked (0)   done (0)   cancelled (0)
           > T task-tui-detail-pane TUI detail pan…
row 1/1 · ←/→ column · ↑/↓ card · PgUp/PgDn page · home/end · / search · enter detail · q quit
~~~
Narrow fallback (35x20 capture, same item): one field per line, values wrapped:
~~~
arggon detail · task-tui-detail-pa…
T task-tui-detail-pane — TUI detail
pane: read an item without leaving
the board
type: task
status: in_progress
priority: p1
assignee: Arggon
worktree:
/home/arggon/Projects/ArggonManager
-task-tui-detail-pane
path:
ArggonManager/arggon-manager/ui/ui-
tui-v2/task-tui-detail-pane.md
row 1/112 · ↑/↓ line · PgUp/PgDn p…
~~~

### Findings / open questions for the coordinator
1. Docs outside this item's file ownership now describe the old smoke harness: `ArggonManager/docs/engineering.md` §Smoke test ("sends `q`, and asserts the frame carries the five status headers and a seeded item id") and `CONTRIBUTING.md` ("TUI frame check: … the five status headers plus a seeded item id"). The harness now drives a 7-step session ending on the detail pane. One-clause refresh — needs a file owner.
2. The branch carries the claim + this evidence auto-commit; merge (not squash) per docs/agents.md §0.
3. Behaviour note for review: `enter` no longer prints the path (the pane carries it); an empty column still shows "(no item selected)".

### handoff 2026-09-23 @ses_f343321d6ffeYUdt96vaXCUSTA (session: ses_f343321d6ffeYUdt96vaXCUSTA) — next: Address PR #410 review comments; coordinator merges (not squash) and flips done. Worktree ../ArggonManager-task-tui-detail-pane
- branch: feat/task-tui-detail-pane
- open questions: engineering.md §Smoke test + CONTRIBUTING.md still describe smoke:tui-board as headers+q only (now 7 pane steps) — outside my scope; enter no longer prints the path (pane carries it)
