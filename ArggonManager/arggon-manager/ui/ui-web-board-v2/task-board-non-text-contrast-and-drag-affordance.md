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

- [x] Every non-text boundary listed above has a measured contrast ratio
      recorded in this item's body (selector, foreground, background, ratio).
- [x] Each is either fixed to clear 3:1, or recorded with a reason and an owner
      why it does not need to.
- [x] A decision is made and recorded for `.card.dragging`'s 0.5 fade, with the
      accessibility rationale (a dragged card is not being moved by a keyboard or
      screen-reader user) stated either way.
- [x] If the decision is to keep a transient fade, it is documented as such in
      `CONTRIBUTING.md` § UI smoke tests so the next reader does not read the
      axe gate's silence as a pass. (N/A: no fade kept — but CONTRIBUTING §
      Accessibility gate now documents where the 1.4.11 check lives anyway.)
- [x] A check exists for whatever is decided — a unit assertion on the rendered
      CSS, a documented manual check in the engineering smoke bar, or a widened
      automated gate — so the decision does not regress silently.
- [x] `npm test`, `npm run lint`, `npm run build` and `arggon validate` are green.

### 2026-09-30 @Arggon
Decision and measurements (PR #480)

**Decision — .card.dragging: replace the 0.5 fade with a lift.** The mid-drag fade is gone. A keyboard or screen-reader user never sees the dragging state at all — they move cards through the move dialog, which never sets .dragging — so the fade bought nothing for them; for pointer users it composited every descendant to ~1.5-2.7:1 while the card was in flight. The affordance is now elevation (box-shadow 0 8px 20px rgb(0 0 0 / 0.3)) plus a solid 2px #0550ae outline — the focus-ring color, distinct from the dashed #666a6f drop-target outline on .column.over. The card stays fully legible mid-drag (computed opacity 1 in the browser). No transient exception needed, so no owner bookkeeping; the stylesheet now carries no opacity declaration at all.

**Non-text boundaries (WCAG 1.4.11, 3:1), measured (WCAG 2.x relative luminance):**
- .column.over outline #666a6f on #ebecf0 — 4.61:1 — PASS (fixed by the parent item; recorded here for completeness)
- .column .count pill boundary: fill #d0d4da on #ebecf0 measured 1.26:1 — FAIL — fixed with a 1px #666a6f border (4.61:1 vs the column, 5.45:1 vs the fill; text pair #424a53 on #d0d4da is 6.04:1, axe-enforced)
- .lens chip border #d0d4da on #f4f5f7 measured 1.36:1 (1.49:1 vs the white fill) — FAIL — fixed: border now #666a6f (4.99:1 on the page, 5.45:1 vs the fill); .lens.active fill #0550ae on #f4f5f7 is 6.96:1 — PASS
- .drawer-panel edge: #fff on the 0.35 scrim measured 2.43:1 — FAIL — fixed: 1px #666a6f border (5.45:1 vs the panel fill); .move-menu-panel had the identical defect and got the same fix
- focus indicator: shared button:focus-visible / .card:focus-visible outline #0550ae on #fff is 7.59:1 — PASS
- Same policy applied to the sibling interactive controls that shared the 1.3:1 #d0d4da border: #board-filter-input, #board-filter-clear, .card-move, .drawer-close, .move-menu-target, .move-menu-cancel, and (picked up in the origin/main merge) the batch-1 .col-toggle and .layout-toggle.

**Check:** board.test.ts "renderBoardHtml non-text contrast" asserts the rendered CSS — every recorded boundary pair >= 3:1 via a WCAG ratio helper, every interactive control on the boundary grey, and zero opacity declarations in the stylesheet. CONTRIBUTING.md § Accessibility gate now states that the axe gate is silent on 1.4.11 by construction and that npm test is the 1.4.11 gate.

**Gates (merged with origin/main 95d664d5):** npm test 1807 passed / 107 files; npm run lint clean; npm run build green; npm run check:plugin green; arggon validate ok; npx playwright test --grep @smoke 19 passed, zero exclusions. Real-browser evidence (headless chromium against arggon board --serve on this worktree): computed border-color of #board-filter-input, #board-filter-clear, .column .count, .drawer-panel, .col-toggle, .layout-toggle = rgb(102,106,111) = #666a6f; a card with .dragging applied (exactly as the dragstart handler does) computes opacity 1, outline rgb(5,80,174) solid 2px, shadow rgba(0,0,0,0.3) 0px 8px 20px; screenshots of the default board, the mid-drag card and the open drawer visually confirm.
