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

### 2026-09-18 @Arggon
### Evidence: fixture probes (real CLI from this branch), expected vs observed

Harness: scratch git repos (`init` + initiative/epic/story/task), bare `origin`, a fake `node_modules/fake-gate-dep`, and a pre-commit hook that `require`s it — the stand-in for the documented `npm run arggon -- validate` gate. Raw log: `/tmp/opencode/probe-bug-start-worktree-node-modules-output.txt`; script: `/tmp/opencode/probe-bug-start-worktree-node-modules.sh`.

**(a) fresh worktree + dependency-requiring gate** — expected: exit 0, `linkedNodeModules:true`, gate ran, symlink, claim commit. Observed: exit 0; JSON `"linkedNodeModules":true`; `node_modules -> <primary>/node_modules` symlink; `.gate-ran` marker present (gate really ran inside the worktree — no bypass); `claim: task-alpha` commit; the claim commit touches only the item file, so the link was never committed.

**(b) deliberately failing gate** — expected: exit 1 `START_FAILED`; message names failing step, worktree path, remediation, attach; worktree+branch kept. Observed: exit 1; message = `start failed while committing the claim (pre-commit gate); the worktree was kept at <path> (nothing was rolled back).` + git's `gate: deliberate failure` + `...re-run \`arggon start task-alpha --worktree\` — it attaches to the existing worktree. To discard it instead: ...`; worktree dir exists, 2 worktrees registered, `feat/task-alpha` branch exists, item staged-but-uncommitted (`M  tasks/launch/auth/login/task-alpha.md`). Follow-up probe: after fixing the hook, re-run attaches (`worktreeCreated:false`) and lands the claim commit.

**(c) repo without a hook / without primary node_modules** — expected: exit 0, `linkedNodeModules:false`, no link, claim commit. Observed: exit 0; `"linkedNodeModules":false`; no `node_modules` in the worktree; `claim: task-alpha`.

**(d) additive JSON field** — expected: key present, false when no link. Observed: non-worktree `start task-bravo` -> `"linkedNodeModules":false`; (a) true; (c) false; `cli/src/cli.test.ts` asserts the envelope key.

Automated coverage: `cli/src/worktree.test.ts` (link+report; keep+remediation+attach re-run; no-hook unaffected), `cli/src/start.test.ts` (`linkNodeModules` unit matrix + field false without `--worktree`), `cli/src/cli.test.ts` (envelope key). Full suite 1117 passed / 69 files; `lint`, `build`, `validate`, `spec validate` green.

Hooks are never bypassed: `--no-verify` is never passed, the gate must succeed for the commit to land, and its stderr is preserved in the kept-worktree failure.
