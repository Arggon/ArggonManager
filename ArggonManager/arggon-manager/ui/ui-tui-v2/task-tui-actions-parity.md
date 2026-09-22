---
type: task
status: todo
id: task-tui-actions-parity
title: TUI actions (claim/status) through the kernel update path — spec first
parent: ui-tui-v2
labels: [tui, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/task-tui-actions-parity.md
  Leaves live only under a story. id is the filename stem: task-tui-actions-parity.
  CLI `arggon create task tui-actions-parity` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI actions (claim/status) through the kernel update path — spec first

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The TUI is read-only v1 by story acceptance (`story-tui-board`). The board already proved the safe write pattern: client-side rules identical to `status.ts`/`update.ts`, an embedded parity test, and every write through the kernel `runUpdate` — never force, never steal. Extending the terminal board with actions needs the same treatment and a spec before code.

## Acceptance

- [ ] Spec + plan under `ArggonManager/docs/specs/` + `docs/plans/` written first (claim, transitions, confirmations, error surfacing, why force/steal stay impossible)
- [ ] `c` claims (assignee prompt), legal status transitions apply with confirmation; `blocked` requires a reason; all writes go through `runUpdate`
- [ ] Parity test: embedded rules ≡ board `evaluateDrop` ≡ kernel transition table
- [ ] Failures surface actionably in the footer; the board never leaves the alternate screen dirty
- [ ] Golden tests + pty evidence; README + docs updated
