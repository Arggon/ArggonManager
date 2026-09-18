---
type: bug
status: todo
id: bug-start-worktree-node-modules
title: "arggon start --worktree fails and rolls back in fresh worktrees without node_modules"
priority: p2
parent: start-worktree-ergonomics
labels: []
created: "2026-09-18"
updated: "2026-09-18"
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

- [ ] Repro recorded on a fixture (hook-enabled repo, no deps in the worktree)
      with expected vs observed.
- [ ] Behavior decided and implemented per `start-worktree-ergonomics`:
      prepare the worktree (link the primary `node_modules` when present) **or**
      keep the worktree on hook failure with an actionable error **or** make the
      manual sequence the documented path.
- [ ] Regression test covers the chosen behavior (fixture with a pre-commit
      gate).
- [ ] `docs/agents.md` worktree guidance + the `arggon-cli` skill updated; no
      hook is silently bypassed.

## Notes

- The failure is honest (it surfaces the missing dependency), but the rollback
  destroys the diagnostic context and forces every agent to redo the manual
  dance; the fix is about ergonomics, not about skipping gates.
