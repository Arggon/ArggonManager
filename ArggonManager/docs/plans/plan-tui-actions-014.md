---
plan_id: tui-actions-014
title: Plan for TUI actions (claim/status) through the kernel update path
spec: ArggonManager/docs/specs/spec-tui-actions-014.md
status: proposed
created: 2026-09-30
---

# Plan: TUI actions (claim/status) through the kernel update path (tui-actions-014)

Derived from `ArggonManager/docs/specs/spec-tui-actions-014.md`. Each task carries a
verifiable acceptance criterion and links back to the spec.

## T1: Embedded legality rules (pure, cli/src/tui.ts)

- `tuiLegalMoves(item)` (kernel-legal targets only) and `tuiActionVerdict(item,
  to, edit)` — the mirror of `evaluateDrop` (transitions, same-status,
  claim-conflict, in_progress-requires-assignee, force refused on sight) plus
  the blocked-reason requirement; `TuiActionState` stage machine (move →
  reason/assignee → confirm) and the reducer branch in `handleKey` (`c`, `m`,
  number keys, y/N, esc; `q`/`Ctrl-C` keep quitting).
- **Acceptance:** golden reducer tests per stage (golden frames for menu,
  prompts, confirm); the board state behind a cancelled flow is byte-identical.

## T2: Loop wiring (the only write path)

- `runTuiBoard` gains `opts.runUpdate` (defaults to the kernel `runUpdate`;
  tests inject a spy): the loop executes a finished flow exactly once, then
  syncs (re-read + clamp) and renders the success/failure footer message;
  failures are sanitized footer text, the flow closes, the alternate-screen
  lifecycle is untouched.
- **Acceptance:** loop tests with a spy — success re-reads and repaints; a
  throwing kernel call lands in the footer and the loop survives (and still
  quits cleanly afterwards).

## T3: Parity suite (three-way pin)

- Table over all statuses × targets × claim shapes: `tuiActionVerdict` ≡
  `evaluateDrop` (force always false) ≡ kernel `canTransition`; the embedded
  tables ≡ `lib/src/status.ts` TRANSITIONS; live fixture cases where
  `runUpdate`'s accept/refuse matches the verdicts (claim ok, claim conflict,
  blocked without reason, illegal transition).
- **Acceptance:** the matrix test fails on any divergence; fixture cases
  green.

## T4: Docs

- README: keybindings table (`c`, `m`), the `--tui` bullet gains the write
  paragraph (kernel path, no force/steal, no auto-commit, reopen-through-confirm).
- **Acceptance:** grep of the new keys/claims across README matches behavior.

## T5: pty smoke + gates

- `smoke/tui-board-smoke.ts` grows a claim step (`c`, assignee prompt, apply)
  and a move step (`m` → legal target → confirm) against the real kernel on
  the fixture, with expected-vs-observed frame assertions.
- **Acceptance:** `npm test`, `npm run lint`, `npm run build`,
  `npm run check:plugin`, `arggon validate --json`, `npm run smoke:tui-board`
  all green; `arggon spec validate` + `spec analyze` clean; spec + plan
  flipped to `implemented` in this PR.

## Risks

- A stale flow (tree moved under the open menu) is rejected by the kernel and
  surfaces as footer text — by design; the parity suite covers the refuse
  path with a live fixture case.
- Cascade side effects of a `done` move surface through the success message
  (`cascade: <id>` from `runUpdate`'s `autoCompleted`).
