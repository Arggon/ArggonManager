---
type: bug
status: in_progress
id: bug-cleanup-stuck-when-worktree-dir-gone
title: "cleanup --prune wedges forever when a candidate's worktree directory was already removed: 'not a working tree', worktree_path never cleared"
assignee: arggon-delivery-lead
branch: fix/bug-cleanup-stuck-when-worktree-dir-gone
parent: story-start-worktree
labels: [worktree, cleanup]
created: "2026-10-14"
updated: "2026-10-14"
claimed_at: "2026-10-14T12:50:37.090Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-cleanup-stuck-when-worktree-dir-gone
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/bug-cleanup-stuck-when-worktree-dir-gone.md
  Leaves live only under a story. id is the filename stem: bug-cleanup-stuck-when-worktree-dir-gone.
  CLI `arggon create bug cleanup-stuck-when-worktree-dir-gone` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --prune wedges forever when a candidate's worktree directory was already removed: 'not a working tree', worktree_path never cleared

## Context

Found 2026-10-14 while clearing a wave's worktrees. For `bug-zcode-agents-brace-elided-retired-ids`, an earlier `cleanup --prune` run removed the worktree **directory** but reported the item's removal as `failed`; every later run now reports the candidate `removable: true` and fails forever:
`git worktree removal failed: fatal: '/home/arggon/Projects/ArggonManager-bug-zcode-agents-brace-elided-retired-ids' is not a working tree`.
The reaper insists on `git worktree remove <path>` and never reaches the "clear `worktree_path`" step. `git worktree prune` clears git's stale record but does not un-wedge the reaper (the next run fails identically); the local branch also had to be deleted by hand. Net effect: the item keeps an orphaned `worktree_path` and the cleanup record is stuck — a permanent failed-retry loop with no named remedy (contrast `bug-cleanup-partial-failure`, done, which covers branch-deletion divergence).

## Acceptance

- [ ] a candidate whose worktree directory no longer exists (but is recorded on the item) is handled: the worktree domain removal is skipped as already-gone and `worktree_path` is cleared, or the refusal is self-describing with a working remedy — never a permanent failed-retry loop
- [ ] `git worktree prune` is either unnecessary (the reaper prunes the stale record itself) or named in the failure's remedy
- [ ] a test pins the shape: remove the directory by hand → `cleanup --prune` completes (clears `worktree_path`; branch deletion handled), or returns a remedy that actually works
- [ ] `arggon validate` green; PR opened

## Notes
