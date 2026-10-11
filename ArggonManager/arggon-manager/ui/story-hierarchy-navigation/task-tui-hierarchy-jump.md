---
type: task
status: todo
id: task-tui-hierarchy-jump
title: "TUI detail pane: jump to parent and list children"
parent: story-hierarchy-navigation
labels: []
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-hierarchy-navigation/task-tui-hierarchy-jump.md
  Leaves live only under a story. id is the filename stem: task-tui-hierarchy-jump.
  CLI `arggon create task tui-hierarchy-jump` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI detail pane: jump to parent and list children

## Context

Parent story `story-hierarchy-navigation`: the TUI detail pane (`buildTuiDetailLines`, `cli/src/tui.ts`) prints `parent: <id>` as inert text and no key walks the tree. Terminal users get the board plus a read-only pane with no way up or down.

## Acceptance

- [ ] A key from an open detail pane jumps to the parent's detail, and a key (or section) lists the children with a way to open each child's detail; keys documented in the help/shortcut surface
- [ ] Items with no parent / no children report that in-pane instead of misfiring
- [ ] Read-only preserved: the new keys never write (reducer stays write-free); rendering goes through the existing sanitize path
- [ ] `npm run smoke:tui-board` green plus new scripted steps covering the jump (or documented manual check in the verdict if unscriptable); `tui.test.ts` pins the bindings
- [ ] `arggon validate` green; prettier clean; PR opened

## Notes

### 2026-10-11 @ses_ed2ed434cffdHsqB0EV526IjUT
verdict: approve (pane p/1-9/c jumps, read-only preserved, smoke green)
- Read the worktree diff (tui.ts + tui.test.ts + smoke + README + own item file) — no board.ts, no plugins/, no templates/; scope stays on the item
- Standards-reviewer: approve, no blocking findings (same-snapshot resolvers, write-free reducer, modal c honestly scoped+documented, sanitize on all new rows, honest-empty notices, real live round-trip test)
- Verifier, all 5 probes green: vitest 159/159, tsc exit 0, prettier clean, smoke:tui-board pass incl. the 3 new jump steps, validate ok
- Recommendation: merge PR #729 (merge, not squash) on green CI; lead ticks Acceptance after merge and flips done
