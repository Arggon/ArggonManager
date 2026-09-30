---
type: task
status: in_progress
id: task-board-non-text-contrast-and-drag-affordance
title: "Non-text contrast and the mid-drag fade: a design decision"
assignee: Arggon
branch: feat/task-board-non-text-contrast-and-drag-affordance
parent: ui-web-board-v2
labels: [accessibility, ui, board]
priority: p2
created: "2026-09-29"
updated: "2026-09-30"
claimed_at: "2026-09-30T16:30:57.156Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-non-text-contrast-and-drag-affordance
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-non-text-contrast-and-drag-affordance.md
  Leaves live only under a story. id is the filename stem: task-board-non-text-contrast-and-drag-affordance.
  CLI `arggon create task board-non-text-contrast-and-drag-affordance` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Non-text contrast and the mid-drag fade: a design decision

## Context

`task-axe-core-browser-ci` fixed the board's **text** contrast (WCAG 1.4.3, AA)
because axe automates that check, and the lane now gates it. Two adjacent classes
of contrast problem remain that axe does **not** automate, so nothing in CI can
catch them today. They need a human decision plus a check of some kind.

1. **Non-text contrast (WCAG 1.4.11, non-text content, 3:1).** axe reports no
   rule for it — the criterion is a manual check. The board's UI-component
   boundaries that were measured while fixing the parent's defects:
   - `.column.over` — the drop-target indicator, a 2px dashed outline. It was
     `#8c919a` (2.68:1 on the `#ebecf0` column) and **was** darkened to
     `#666a6f` (4.61:1) in the parent item, because it is the only cue that a
     column will accept a drop and it sits on the same surface as the other
     failing greys. That one change is done and needs no further decision — it
     is listed here only so the remaining surface is explicit.
   - `.column .count` — the count pill, `#424a53` on `#d0d4da`.
   - `.lens` / `.lens.active` — chip border `#d0d4da` on white, active fill
     `#0550ae` with white text.
   - `.drawer-panel` / the focus ring, if the drawer has no visible focus
     indicator of its own.
     Each of these needs its 3:1 ratio measured and either fixed or recorded with
     a reason.

2. **`.card.dragging { opacity: 0.5 }` — a design decision, not a defect report.**
   The parent item removed the _static_ blanket fade (`.card.dep-blocked
{ opacity: 0.55 }`) because it pushed every descendant on the card to
   1.5–2.7:1 while the card sat on the board, and replaced it with a muted
   surface. The **mid-drag** fade is transient and the axe scan never sees it
   (it runs on the ready page, before interaction), so it was left alone. The
   question is whether a card being dragged should stay legible: for a
   keyboard/screen-reader user the card is not being "moved" at all, and for a
   pointer user the fade is a long-standing affordance. Options range from
   keeping the fade (documented as an intentional transient exception, which
   would need an owner recorded) to replacing it with a non-contrast affordance
   such as a raised shadow or a dashed outline.

## Acceptance

- [ ] Every non-text boundary listed above has a measured contrast ratio
      recorded in this item's body (selector, foreground, background, ratio).
- [ ] Each is either fixed to clear 3:1, or recorded with a reason and an owner
      why it does not need to.
- [ ] A decision is made and recorded for `.card.dragging`'s 0.5 fade, with the
      accessibility rationale (a dragged card is not being moved by a keyboard or
      screen-reader user) stated either way.
- [ ] If the decision is to keep a transient fade, it is documented as such in
      `CONTRIBUTING.md` § UI smoke tests so the next reader does not read the
      axe gate's silence as a pass.
- [ ] A check exists for whatever is decided — a unit assertion on the rendered
      CSS, a documented manual check in the engineering smoke bar, or a widened
      automated gate — so the decision does not regress silently.
- [ ] `npm test`, `npm run lint`, `npm run build` and `arggon validate` are green.
