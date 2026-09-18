---
type: bug
status: in_progress
id: bug-start-worktree-node-modules
title: arggon start --worktree fails and rolls back in fresh worktrees without node_modules
assignee: Arggon
branch: fix/bug-start-worktree-node-modules
parent: start-worktree-ergonomics
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T13:07:36.745Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-start-worktree-node-modules
---
<!--
  Placement (v0): tasks/arggon-manager/cli/start-worktree-ergonomics/bug-start-worktree-node-modules.md
  Leaves live only under a story. id is the filename stem: bug-start-worktree-node-modules.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# argon start --worktree fails and rolls back in fresh worktrees without node_modules

## Context

Hit twice by OpenCode2 program workers (2026-09-18) and once by the coordinator
while starting `task-opencode-v2-spec`. Repro on this repo (pre-commit hook =
`npm run arggon -- validate`, the documented wiring):

```
npm run arggon -- start task-opencode-v2-spec --worktree --assignee Arggon --json
```

Observed: `start` creates `../<repo>-<id>` on the item branch, runs the claim
commit inside it, the pre-commit hook fails
(`ERR_MODULE_NOT_FOUND: Cannot find package 'commander'` — no `node_modules` in
the fresh worktree), `start` returns `START_FAILED`, and **removes the
worktree**; the item stays unclaimed. The documented order (`start` →
symlink) cannot work because the symlink would be needed before the first
commit.

Workaround (used by both workers): `git worktree add <path> -b <branch>`,
`ln -s <primary-checkout>/node_modules <path>/node_modules`, then re-run
`start --worktree` (it attaches, claims, commits, pushes).

## Acceptance

- [x] Repro recorded on a fixture (hook-enabled repo, no deps in the worktree)
      with expected vs observed.
- [x] Behavior decided and implemented per `start-worktree-ergonomics`:
      prepare the worktree (link the primary `node_modules` when present) **or**
      keep the worktree on hook failure with an actionable error **or** make the
      manual sequence the documented path.
- [x] Regression test covers the chosen behavior (fixture with a pre-commit
      gate).
- [x] `docs/agents.md` worktree guidance + the `arggon-cli` skill updated; no
      hook is silently bypassed.

## Notes

- The failure is honest (it surfaces the missing dependency), but the rollback
  destroys the diagnostic context and forces every agent to redo the manual
  dance; the fix is about ergonomics, not about skipping gates.

### 2026-09-18 @Arggon
Decision (worker Arggon): prepare the worktree + never destroy it on failure.

Repro (documented in the body, hit by two workers + coordinator): fresh worktree has no node_modules, the wired pre-commit gate ('npm run arggon -- validate') dies with ERR_MODULE_NOT_FOUND, and start removes the worktree instead of leaving it diagnosable.

Decided behavior:
1. Prepare: after worktree add (create or attach) and before the claim commit, if the primary checkout has node_modules and the worktree does not, symlink it into the worktree. Best-effort (try/catch, no-op when the primary has none); reported in human output and as the additive JSON field linkedNodeModules.
2. Never destroy: no rollback path remains. Any failure after the worktree exists keeps the worktree and branch, and the error names the failing step, the worktree path, a step-specific remediation, and that re-running 'start --worktree' attaches.
3. No hook bypass: --no-verify is never used; the fixture test proves the pre-commit gate executes inside the worktree (the gate's dependency require is what makes the first start succeed).

Out of scope note: the post-start x-worktree hook remains non-fatal and unchanged.
