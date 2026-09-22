---
type: task
status: todo
id: task-board-keyboard-a11y
title: "Web board keyboard and accessibility: focus, move menu, ARIA"
parent: ui-web-board-v2
labels: [viewer, board, a11y, ui]
priority: p1
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-keyboard-a11y.md
  Leaves live only under a story. id is the filename stem: task-board-keyboard-a11y.
  CLI `arggon create task board-keyboard-a11y` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board keyboard and accessibility: focus, move menu, ARIA

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Measured on 2026-09-22 against `board --serve`: 0 focusable cards, 1 aria attribute in the whole DOM (aria-live on the toast), no non-drag path to change a status. HTML5 drag-and-drop also does not fire on touch devices, so phone/tablet users cannot move a card at all. The board is the repo's review surface; keyboard-only users should be able to review and act.

## Acceptance

- [ ] Cards are reachable and navigable by keyboard (roving tabindex or equivalent, visible focus ring, arrow/Home/End across columns), with column landmarks and headings
- [ ] A keyboard/touch alternative to drag: a card action menu (key + tap/click affordance) offering only legal transitions and running the same `evaluateDrop` parity path, including the claim and blocked-reason requirements
- [ ] ARIA roles/labels for board, columns and cards; the toast is a live status region; dialogs/drawer manage focus and restore it on close; no duplicate ids
- [ ] Documented touch fallback (DnD limitation) with a Playwright-CLI mobile-emulation smoke
- [ ] Tests + Playwright-CLI smoke: keyboard-only status move round-trips and persists (verified with `arggon show`)
