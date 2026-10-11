---
type: task
status: in_progress
id: task-tui-hierarchy-jump
title: "TUI detail pane: jump to parent and list children"
assignee: arggon-delivery-lead
branch: feat/task-tui-hierarchy-jump
parent: story-hierarchy-navigation
labels: []
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T23:19:54.665Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-tui-hierarchy-jump
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

### 2026-10-11 @ses_ed2abf7e2ffeI4uJqBAYeqwL9z
Evidence (maker, task-tui-hierarchy-jump, commit dedb83ce):
- `npm run arggon -- validate` -> ok (0 warnings, convention v5), incl. pre-commit hook on commit
- `npx prettier --check README.md cli/src/tui.ts cli/src/tui.test.ts smoke/tui-board-smoke.ts` -> All matched files use Prettier code style
- `npx vitest run cli/src/tui.test.ts` -> 159 passed (was 143 before; +16 hierarchy cases)
- `npx tsc --noEmit -p tsconfig.typecheck.json` -> exit 0
- `npm run smoke:tui-board` -> passed; new pty steps green: `pane reports no children instead of misfiring`, `parent jump opens the story detail with its numbered children`, `child jump returns to the seeded task detail`; verdict checks `p jumps from the item detail to the parent story detail with numbered children` and `1 opens the parent's first child detail again` both ok
- Expected vs observed (smoke): c on childless seeded task keeps `arggon detail \u00b7 <seeded>` + `children: (none)` + footer `has no children` (observed); p shows `arggon detail \u00b7 entries` + `children (4)` + `[1] <seeded>` (observed); 1 returns to `arggon detail \u00b7 <seeded>` (observed)
- Read-only: handleDetailKey returns new state only, no runUpdate/write; loop passes live `detailItems: items` snapshot; children/notice lines via `safe()` = `sanitizeHumanTextUncapped`, footer notice sanitized (hostile-input tests in tui.test.ts)
- Push: `git push -u origin feat/task-tui-hierarchy-jump` -> new remote branch, exit 0 (PR not opened from here; left for delivery lead)
