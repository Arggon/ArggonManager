---
type: bug
status: done
id: bug-tui-column-shift
title: TUI columns shift under selected column when it runs out of cards
assignee: Arggon
branch: fix/bug-tui-column-shift
parent: story-tui-board
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-tui-board/bug-tui-column-shift.md
  Leaves live only under a story. id is the filename stem: bug-tui-column-shift.
  CLI `arggon create bug tui-column-shift` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI columns shift under selected column when it runs out of cards

## Context

User report: in `arggon board --tui`, done items render BELOW the blocked column while blocked is selected; they cannot be navigated there, and moving to the done column makes them appear in the right place.

Root cause (reproduced with a scripted frame diff): the card-row loop in `renderTui` inserts the selected column's cell **unpadded** when color is on. A card cell is pre-padded to the column width, but an empty cell (selected column ran out of cards while a right-hand column has more rows) is inserted with width 0, shifting every column to its right one column-width left. Done's cards therefore paint inside blocked's x-range. Navigation uses the true counts (why the cards are not selectable there), and moving to done re-renders with populated selected cells, "fixing" the layout.

## Acceptance

- [x] Regression test: color ON, selected column shorter than a right-hand column — every visible card renders at its own column's x-offset (row-3+ included)
- [x] Fix: card-row cells always padded to the column width regardless of selection (padEndTo on an SGR-wrapped cell is a no-op by length)

## Notes

Reproduction: blocked selected (1 card) + done (3 cards), 80x12, color on → rows 3-4 drew task-d2/task-d3 at x=32 (blocked) instead of x=48 (done). Same frame with color:false was correct, which is why the golden tests missed it.
