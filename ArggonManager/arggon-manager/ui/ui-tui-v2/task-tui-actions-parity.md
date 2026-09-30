---
type: task
status: in_progress
id: task-tui-actions-parity
title: TUI actions (claim/status) through the kernel update path — spec first
assignee: Arggon
branch: feat/task-tui-actions-parity
parent: ui-tui-v2
labels: [tui, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T18:14:23.671Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-tui-actions-parity
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-actions-parity.md
  Leaves live only under a story. id is the filename stem: task-tui-actions-parity.
  CLI `arggon create task tui-actions-parity` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI actions (claim/status) through the kernel update path — spec first

## Context

The TUI is read-only v1 by story acceptance (`story-tui-board`). The board already proved the safe write pattern: client-side rules identical to `status.ts`/`update.ts`, an embedded parity test, and every write through the kernel `runUpdate` — never force, never steal. Extending the terminal board with actions needs the same treatment and a spec before code.

## Acceptance

- [x] Spec + plan under `ArggonManager/docs/specs/` + `docs/plans/` written first (claim, transitions, confirmations, error surfacing, why force/steal stay impossible)
- [x] `c` claims (assignee prompt), legal status transitions apply with confirmation; `blocked` requires a reason; all writes go through `runUpdate`
- [x] Parity test: embedded rules ≡ board `evaluateDrop` ≡ kernel transition table
- [x] Failures surface actionably in the footer; the board never leaves the alternate screen dirty
- [x] Golden tests + pty evidence; README + docs updated

## Notes

### 2026-09-30 @Arggon
verdict: implemented (awaiting review)

Spec-first delivered: ArggonManager/docs/specs/spec-tui-actions-014.md + plans/plan-tui-actions-014.md scaffolded and filled BEFORE implementation (committed first), both flipped to implemented in PR #489. spec validate ok; spec analyze: no new findings for this spec.

Branch feat/task-tui-actions-parity, PR #489 (ready).

Gates (all green): npm test (109 files / 1859 tests), npm run lint, npm run build, npm run check:plugin, arggon validate --json, npm run smoke:tui-board (pty).

Evidence, expected vs observed:
- Parity matrix: tuiActionVerdict ≡ evaluateDrop (force:false) over 5 statuses x 5 targets x 4 item shapes x 4 edits — identical ok+reason; kernel canTransition under-approximates (claim/blocked rules only refuse, never allow).
- runUpdate witness (real fixture): claim accepted (in_progress + assignee); claim conflict refused (/claim conflict/); blocked without reason refused by the KERNEL (/--blocked-reason/) while the mirror allows (the reason prompt is flow UI); stale flow (racing writer moved the item to cancelled) refused (/cannot transition status cancelled -> in_progress/) — surfaced as footer text by the loop.
- pty smoke: c -> assignee prompt (prefill cleared with backspaces for determinism) -> 'smoke' -> y -> frame shows 'claimed task-board-task (in_progress)' and the card renders '@smoke' (real kernel write on the fixture file); then right-arrow to follow the moved card, m -> menu '[1] todo [2] blocked ...' -> 2 -> reason prompt -> 'waiting on the smoke fixture' -> y -> '-> blocked (reason: ...)' and the re-read shows 'blocked (1)'.
- Loop spy tests: exactly one runUpdate per flow; a throwing kernel call lands in the footer and the loop still quits cleanly (alternate screen restored via the existing finish/fail paths).

Deviations: none functional. Notes: (1) a successful write does not move the board selection to the item's new column (the smoke navigates with ->); follow-the-item is a candidate follow-up if review wants it. (2) TUI writes do not auto-commit the tracker (parity with the served board's drag-and-drop), documented in README and the spec.
