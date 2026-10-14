---
type: bug
status: done
id: bug-cleanup-release-stale-record-wedge
title: "cleanup --release has the same stale-record shape: a leftover dir whose gitdir is gone reaches removal and wedges (top-level CLEANUP_FAILED)"
assignee: arggon-delivery-lead
branch: fix/bug-cleanup-release-stale-record-wedge
parent: story-start-worktree
labels: [worktree, cleanup]
created: "2026-10-14"
updated: "2026-10-14"
worktree_path: /home/arggon/Projects/ArggonManager-bug-cleanup-release-stale-record-wedge
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/bug-cleanup-release-stale-record-wedge.md
  Leaves live only under a story. id is the filename stem: bug-cleanup-release-stale-record-wedge.
  CLI `arggon create bug cleanup-release-stale-record-wedge` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --release has the same stale-record shape: a leftover dir whose gitdir is gone reaches removal and wedges (top-level CLEANUP_FAILED)

## Context

Residual shape found while fixing `bug-cleanup-stuck-when-worktree-dir-gone` (PR #812), which closed the `--prune` arm: its classifier now probes `worktreeIsLive` (git's own verdict; a `prunable` record is not live), prunes the dead record itself, and clears the item record before deleting the branch. The **`--release` arm** (`classifyReleaseEntry`) still lacks the liveness rule: `!existsSync` covers a removed directory, but a leftover directory whose gitdir is gone reaches removal — on the CLI the `worktreeBranch` probe throws to a top-level `CLEANUP_FAILED`, and a domain inventory listing it attempts the removal. Same class, sibling arm.

## Acceptance

- [x] `cleanup --release` applies the same liveness rule: a recorded path that is not a live worktree is a stale record — prune the dead record, treat removal as already-gone, clear `worktree_path`, still handle the branch — never a wedge
- [x] a test pins the shape for the release arm (leftover dir with gitdir gone → release completes, or a self-describing refusal with a working remedy)
- [x] `arggon validate` green; PR opened

## Notes

### 2026-10-14 @ses_ec563ec36ffetHXjD4Hv24DyXX
## Evidence — PR #813

Reproduced red-first, then fixed; 5 new tests (4 CLI, 1 native).

RED (before the fix)
- CLI `runCleanup({ release })`, dead-gitdir state: the run threw out of the classifier —
  `Error: git rev-parse --abbrev-ref HEAD failed: fatal: not a git repository` at `worktreeBranch`
  (lib/src/cleanup.ts) -> `classifyReleaseEntry` -> `releaseClaimedWorktree` (cli/src/cleanup.ts) ->
  `runCleanup`; on the CLI surface that is the top-level `CLEANUP_FAILED` envelope, identical on every retry.
- Native `cleanup({ release })` in the same state: typed `CLEANUP_FAILED: git rev-parse --abbrev-ref HEAD
  failed: fatal: not a git repository` (ArgonToolError), record untouched.

EXPECTED/NOW (green)
- `failures: []`; `released` = [`pruned stale git worktree record`, `deleted branch feat/task-alpha`,
  `cleared worktree_path`]; `release.branch = "feat/task-alpha"` read from git's dead record (the unclaim
  cleared the item field, the dead worktree cannot be asked); the debris directory is retained (asserted);
  `git worktree list` no longer contains the path; `worktree_path` undefined; commit `chore(tasks): released task-alpha`.
- Manual-`git worktree prune` state: [`cleared worktree_path`] (nothing left to drop; the branch name went
  with the record) — previously a permanent refusal.
- Removed-directory state with the record still naming the branch: dead record pruned, branch deleted,
  record cleared — previously the branch was left behind forever.
- Human CLI: exit 0, `released task-alpha` + the three steps printed.
- Native: same three actions; no domain removal attempted (`calls.remove` empty).

GIT BEHAVIOUR PROBED (not assumed), git 2.47
- `git worktree list --porcelain` keeps the `branch refs/heads/<name>` line on a `prunable` record.
- `git branch -D <b>` refuses while the prunable record exists ("cannot delete branch '<b>' used by worktree
  at '<path>'"); after `git worktree prune` it succeeds.
- `git -C <dead dir> rev-parse --abbrev-ref HEAD` -> exit 128 `fatal: not a git repository` (the throw).

GATES (all green)
`npm run build`; `npm run check:plugin`; `npm test` 3402 passed / 157 files; focused (cli/src/worktree.test.ts
+ opencode/plugins/arggon/tools.test.ts + lib/src/cleanup.test.ts + lib/src/worktree.property.test.ts) 234 passed;
`npm run lint`; `npm run test:structure` 5 passed; `npx prettier --check` on every touched file;
`npm run arggon -- validate` -> ok (0 warnings, convention v5).

OWN GATES NOT WEAKENED (checked): still-claimed refusal, foreign live-writer refusal and removal-blocking
refusal are unchanged — a genuinely live worktree refuses exactly as before; only stale/dead records converge.
Real failures stay loud on both `released` and `failures`.

### handoff 2026-10-14 @ses_ec563ec36ffetHXjD4Hv24DyXX (session: ses_ec563ec36ffetHXjD4Hv24DyXX) — next: Review PR #813 (4 CLI + 1 native reproducer), merge, then tick the acceptance rows and flip the item done.
- branch: fix/bug-cleanup-release-stale-record-wedge
- open questions: Compose reaping is skipped for stale records (same as the missing-path release); a still-claimed item with a dead worktree still refuses unconditionally (unclaim first)
