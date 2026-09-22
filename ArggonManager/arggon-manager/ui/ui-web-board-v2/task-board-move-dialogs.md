---
type: task
status: todo
id: task-board-move-dialogs
title: "Web board move dialogs: replace window.prompt, add undo affordance"
parent: ui-web-board-v2
labels: [viewer, board, a11y, ui]
priority: p3
created: "2026-09-22"
updated: "2026-09-22"
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

- [ ] An in-page dialog replaces both prompts: assignee required for `in_progress` claims, non-empty reason required for `blocked`, inline validation, Esc cancels, focus trapped and restored
- [ ] Success toast offers an explicit undo when the reverse transition is legal (never force, never steal — same parity rules); failure keeps the current revert path
- [ ] Tests + Playwright-CLI smoke (drop → dialog → cancel; drop → dialog → confirm; undo path); README/docs updated
