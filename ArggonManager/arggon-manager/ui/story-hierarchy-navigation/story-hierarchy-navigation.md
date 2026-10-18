---
type: story
status: in_progress
id: story-hierarchy-navigation
title: Parent-to-children navigation in every GUI surface
assignee: arggon-delivery-lead
parent: ui
labels: []
created: "2026-10-11"
updated: "2026-10-18"
claimed_at: "2026-10-18T15:26:03.184Z"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-hierarchy-navigation/story-hierarchy-navigation.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Parent-to-children navigation in every GUI surface

## Context

Product-owner requirement 2026-10-11: from any item you must reach its parent and its children in every GUI surface we ship. Verified the same day — none of the three surfaces offers it:

- Web board (`board --serve`, `cli/src/board.ts`): the detail drawer renders `parent` as a plain-text `drawer-row` (~L1030) and dependencies as plain-text divs; no link, no children section.
- TUI (`board --tui`, `cli/src/tui.ts`): `buildTuiDetailLines` prints `parent: <id>` as one text field among others; the reducer is read-only and no key jumps to a parent or lists children (ENTER only opens the pane).
- OpenCode board panel (`opencode/plugins/arggon/tui.tsx`): no parent/child/breadcrumb/ancestor rendering at all.

What exists today is query-side only: the `ancestor:`/`parent:` list predicates and the `board --serve` filters. Clicking/keyboard-walking the tree is missing everywhere.

## Acceptance

- [x] Each of the three child tasks merges with its per-surface acceptance met, reviewed against the project's review bar (evidence travels, docs travel, scope on the item)
- [x] Parent and children resolve through the kernel's recorded `parent` edges (no second hierarchy), and an item with no parent / no children renders that honestly rather than hiding the section
- [x] The ZCode `/arggon-board` path (served `board --serve` + loopback URL) inherits the web fix with no extra work — verified, not assumed
- [x] `arggon validate` green; `npm test` + `ui-smoke` green; prettier clean

## Notes
