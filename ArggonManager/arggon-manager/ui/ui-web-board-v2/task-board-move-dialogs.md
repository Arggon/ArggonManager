---
type: task
status: in_progress
id: task-board-move-dialogs
title: "Web board move dialogs: replace window.prompt, add undo affordance"
assignee: Arggon
branch: feat/task-board-move-dialogs
parent: ui-web-board-v2
labels: [viewer, board, a11y, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T17:24:30.137Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-move-dialogs
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-move-dialogs.md
  Leaves live only under a story. id is the filename stem: task-board-move-dialogs.
  CLI `arggon create task board-move-dialogs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board move dialogs: replace window.prompt, add undo affordance

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Claim (assignee) and blocked-reason collection use `window.prompt` — blocking, unstyled, unlabeled, no validation, and hard to drive by keyboard/screen readers. A failed update after a legal drop reverts the card but offers no retry/undo affordance.

## Acceptance

- [x] An in-page dialog replaces both prompts: assignee required for `in_progress` claims, non-empty reason required for `blocked`, inline validation, Esc cancels, focus trapped and restored
- [x] Success toast offers an explicit undo when the reverse transition is legal (never force, never steal — same parity rules); failure keeps the current revert path
- [x] Tests + Playwright-CLI smoke (drop → dialog → cancel; drop → dialog → confirm; undo path); README/docs updated

### 2026-09-30 @Arggon
Verdict (PR #487)

**Dialog.** One in-page modal (`wireBoardMovePrompt`, toString-embedded on EVERY board — static export included, because the drop flow is) replaces both `window.prompt` calls: claiming into `in_progress` asks the assignee, moving to `blocked` asks the reason. Whitespace-only input keeps the dialog open with a `role=alert` inline error ('a value is required (Esc or cancel aborts the move)'); Esc, cancel and backdrop resolve null and the flow toasts the same '(drop cancelled)' refusals as before; focus is trapped by the shared `trapBoardFocus`, moved to the input on open (aria-label per mode) and restored to the opener on close; Enter confirms. No `window.prompt` call survives anywhere in the rendered page — asserted in board.test.ts for both the static export and serve mode.

**Undo.** The success toast carries an explicit Undo button when the REVERSE transition classifies legal under the same embedded `evaluateDrop` parity rules (or completes through the shared claim dialog, e.g. undoing into an unclaimed in_progress). Undo re-enters `attemptMove` — same optimistic move, same update endpoint, never force, never steal; failure keeps the existing revert path untouched. The toast action button is styled from the existing palette and inherits the toast's 6s dismissal.

**Tests.** board.test.ts: no-prompt assertion (both modes), dialog wiring/validation/focus source assertions, undo wiring assertions (reverse legality via evaluateDrop, attemptMove re-entry) + the static-export test now pins the card tabindex attribute (the focus-trap selector string legitimately rides with the export). e2e @smoke: three NEW order-independent cases — drop→dialog→Esc cancel (no server write), drop→dialog→confirm with inline validation + persisted claim, blocked move→reason→Undo round-trip (persists in_progress, blocked_reason cleared) — plus the action-menu drag-parity test now drives the in-page dialog instead of the removed native prompt handler. Dialog tests mute the SSE stream (the CLI resets each broadcast a reload; a reload between mousedown and move drops Chromium drags — the fixture's documented failure mode) and the undo test parks the item in cancelled so the roving-focus test's nearest-non-empty-column crossing is unchanged.

**Browser evidence.** Screenshots (headless chromium, board --serve on this worktree's 367-item tracker): the claim dialog open over the board with title '--assignee required to claim <id> (GitHub login or agent id):', input focused, cancel/claim actions; and the inline 'a value is required' error state after an empty confirm. Esc cancelled cleanly (no write; tracker count unchanged).

**Gates (after merging origin/main c02cca17 — PR #480 merged, CSS carried intact):** npm test 1842 passed / 108 files; lint clean; build green; check:plugin green; arggon validate ok; npx playwright test --grep @smoke 22 passed (19 + 3 new), zero exclusions, run twice for stability.

**Docs.** README --serve bullet documents dialog + undo; docs/json-output.md gains a move-dialog paragraph; the keyboard/touch bullet now says every dialog traps focus.

### handoff 2026-09-30 @Arggon — next: PR #487 ready for review/merge; item stays in_progress until the coordinator flips it after merge
- branch: feat/task-board-move-dialogs
- open questions: note: test 773 rewritten to drive the in-page dialog (native prompt handler removed with window.prompt)
