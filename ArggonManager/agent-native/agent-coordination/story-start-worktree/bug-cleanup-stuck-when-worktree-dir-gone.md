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

### 2026-10-14 @Arggon
## Evidence — PR #812

Reproduced the wedge three ways in `cli/src/worktree.test.ts` (real git, red first), plus the native retry in `opencode/plugins/arggon/tools.test.ts`.

Reproducer states and OBSERVED failures (before the fix)
1. Directory removed by hand, record still on the item — `cleanup --prune` cleared nothing cleanly: `failures: ["task-alpha: git branch -d feat/task-alpha failed: error: cannot delete branch 'feat/task-alpha' used by worktree at '<path>'"]` (the dead record pins the branch).
2. Directory present but `.git` removed (the incident's interrupted `git worktree remove`) — `removable: true` forever; `failures: ["task-alpha: git worktree remove <path> failed: fatal: validation failed, cannot remove working tree: '<path>/.git' does not exist"]`; branch + record kept; next run identical.
3. After a manual `git worktree prune` (directory still there) — `removable: false`, reason `path exists but is not a git worktree of this repo (remove it manually)`; the record never cleared.

EXPECTED/now: `failures: []`; actions `[pruned stale git worktree record, deleted branch feat/task-alpha, cleared worktree_path]`; branch gone; `git worktree list` no longer contains the path; `worktree_path` undefined; the leftover directory is retained (asserted). Case 3 has no prune action (nothing left to drop). Native: first run fails honestly, second run converges with the same three actions and no second domain removal attempt.

Mechanism
- Kernel `classifyCleanupEntry`: new optional `CleanupGit.worktreeIsLive` (default: git's own `prunable` verdict from `git worktree list --porcelain`) runs before the inventory check — a path that exists but is not a live worktree is a stale record: removal skipped, action `clear stale worktree_path record (path is not a live worktree of this repo; any leftover directory is left in place)`. A probe that cannot answer reads as live, never as gone.
- Both surfaces: new optional `CleanupGit.pruneWorktrees` (`git worktree prune --verbose`), called for stale entries BEFORE `git branch -d` and reported as `pruned stale git worktree record` only when a record was actually dropped.

Git behaviour probed (not assumed)
- `git worktree remove <dir>` (dir present, `.git` gone, record kept): `fatal: validation failed, cannot remove working tree: '<dir>/.git' does not exist`.
- Same path after hand `git worktree prune`: `fatal: '<dir>' is not a working tree` (the incident's message).
- The `prunable` record pins the branch: `git branch -d <b>` -> `error: cannot delete branch '<b>' used by worktree at '<dir>'`; prune first, delete succeeds.
- `git worktree prune --verbose` prints `Removing worktrees/<name>: ...` on STDERR (stdout empty), nothing when there is nothing to drop.

Gates (all green)
`npm run build`; focused suites (`lib/src/cleanup.test.ts` + `lib/src/worktree.property.test.ts` + `cli/src/worktree.test.ts` = 91 passed; native `tools.test.ts` 139/139); `npm test` 3397 passed / 157 files; `npm run lint`; `npm run test:structure` 5 passed; `npm run check:plugin`; `npx prettier --check` on touched files; `npm run arggon -- validate` -> `ok (0 warnings, convention v5)`.

Docs in the PR: `ArggonManager/docs/json-output.md`, `ArggonManager/docs/opencode2.md`, `README.md`.

Open question (out of scope, follow-up candidate): the `--release` arm (`classifyReleaseEntry`) keeps its own stale semantics — `!existsSync(path)` covers the removed directory, but a leftover directory whose gitdir is gone reaches the removal (its `worktreeBranch` probe throws -> CLI top-level `CLEANUP_FAILED`; a domain inventory listing the path attempts the removal). Same liveness rule would close it.
