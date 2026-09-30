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
