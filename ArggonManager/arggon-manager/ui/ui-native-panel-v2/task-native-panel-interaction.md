---
type: task
status: in_progress
id: task-native-panel-interaction
title: "OpenCode panel: selection, detail and next/active jumps"
assignee: Arggon
parent: ui-native-panel-v2
labels: [opencode-seam, tui, ui]
priority: p2
assignee: Arggon
created: "2026-09-22"
updated: "2026-09-30"
claimed_at: "2026-09-30T15:13:07.362Z"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-native-panel-v2/task-native-panel-interaction.md
  Leaves live only under a story. id is the filename stem: task-native-panel-interaction.
  CLI `arggon create task native-panel-interaction` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode panel: selection, detail and next/active jumps

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- Ticked against the merged-with-main PR branch 2026-09-30; evidence in the review verdict comment. -->

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The W5 panel renders flat tree lines (header + counts + up to 200 lines) and only binds esc/f/r; there is no selection, no item detail and no way to jump to the kernel `next` suggestion or the session's active item (both already computed in `boardSnapshot`).

## Acceptance

- [x] j/k (and PgUp/PgDn/g/G) move a visible selection over the tree; Enter opens the selected item (file path or an inline detail block with body/checklist), Esc returns
- [x] `n` jumps to the `next` suggestion and `a` to the active session item; the header keeps totals and the counts line
- [x] Width-aware clipping and sanitization preserved; no slot crash on a corrupt tracker (existing P1 guard)
- [x] `npm run smoke:tui` extended with a selection capture; docs/opencod2 TUI section updated

### 2026-09-28 @Arggon-coordinator
## Coordinator state note — 2026-09-28

This item is **unclaimed (`todo`)** but PR #411 (`feat/task-native-panel-interaction`) has been open since 2026-09-23 with real work on it. Recording the exact state so it is not lost:

- Remote branch head: `73c03c80`; the local worktree `/home/arggon/Projects/ArggonManager-task-native-panel-interaction` is stale at `21a49f1d` (22 commits behind the remote, 4 local-only tracker commits). Any resumption must work from a fresh worktree off the **remote** branch, not the existing directory.
- Diff against `main` at that head: ~1416 insertions across `opencode/plugins/arggon/board.ts`, `board.test.ts`, `tui.tsx`, `tui.test.ts`, `index.ts`, `index.bundle.ts` and `smoke/tui-smoke.ts`. No acceptance box in the body is ticked and no review verdict is on the item, so this PR has **never been reviewed against the engineering review bar**.
- Not in the current wave: the active backlog is the P1 smoke normalizer, the shell-tasks pilot, the native start cold-start smoke, fast-check properties and axe-core CI. The panel PR also collides with the now-merged ast-grep native guard scope (`opencode/plugins/arggon/**`) and the `smoke/` module, so it needs its own wave.

Next coordinator action when a wave frees up: claim the item properly, rebase/verify the branch against current `main` (the P1 shared worktree prep and the cleanup-observation fix both landed in the plugin since), run `npm run lint:structure`/`test:structure` plus the TUI smoke, review against the bar, and post the verdict here.

### 2026-09-30 @Arggon
Review verdict (adoption wave 2026-09-30, @Arggon): adopted PR #411 after a week of main drift (459 commits since the old merge-base). The branch was updated by MERGING origin/main (2f14d652), not rebasing: the branch history is already pushed, a rebase would need a force-push (forbidden); merge-update is this repo's precedent (8130395d, a00ba235). Conflicts resolved: item body (took main: coordinator note + claim), index.bundle.ts (regenerated via build:plugin from merged sources, 389154 B).

Verified against the acceptance checklist (all four boxes ticked honestly):
- Keymap pins j/k + arrows, PgUp/PgDn, g/G + Home/End, Enter detail, n/a jumps, r/f/esc (tui.tsx arggon.board.* bindings).
- Board selection is a clamped, id-resolving state machine; detail rows bounded (16 rows x 200 chars) and control-escaped before the width clip (board.ts).
- Corrupt tracker degrades to the unreadable header (P1 guard) — smoke check passes.

Gates on the merged branch (all green): npm test 107 files / 1791 tests; npm run lint; npm run build; npm run check:plugin (bundle matches sources); npm run lint:structure; npm run test:structure (3 passed); npm run smoke:tui 18/18 incl. j-cursor, n-next, a-active, enter-detail; npm run arggon -- validate --json ok:true. Prettier clean on all touched files.

Item left in_progress; PR #411 marked ready with an updated description. Completion is the coordinator's call after merge.

### handoff 2026-09-30 @Arggon — next: Coordinator: review the review-verdict comment (2026-09-30) and merge PR #411; flip the item to done after merge.
- branch: feat/task-native-panel-interaction
- open questions: Bundle size grew to 389154 B after merging main's native-prep code; fine per check:plugin
