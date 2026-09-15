---
type: task
status: done
id: task-autodone-flip-wedge-3
title: "auto-done flip wedge 3: comment on flipped item conflicts rebase"
assignee: Arggon
branch: feat/task-autodone-flip-wedge-3
parent: story-github
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/task-autodone-flip-wedge-3.md
  Leaves live only under a story. id is the filename stem: task-autodone-flip-wedge-3.
  CLI `arggon create task autodone-flip-wedge-3` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# auto-done flip wedge 3: comment on flipped item conflicts rebase

## Context

Third wedge flavor, observed 2026-09-15 (flip PR #262 for task-handoff-provenance...): the coordinator posted the lead-architect review via `arggon comment` on the SAME item whose flip was in flight. The comment auto-commits to main; the flip branch carries that same item file (claim frontmatter + ticks) — so the #240 retry loop's rebase onto fresh main CONFLICTS on the item file, violating its load-bearing assumption ("the flip only touches tasks/, conflicts should be impossible"). The loop warns and abandons; only admin clears it. Extends task-autodone-flip-race (done): that fix handles staleness, not same-file conflicts.

## Acceptance

- [x] The workflow handles the same-file conflict: on rebase conflict during the retry, REDO the flip on a fresh main checkout instead (delete flip branch, re-run `arggon update <id> --status done` on fresh main — the flip is idempotent from a clean tree — re-post the check, push, merge). Bounded retries as in #240.
- [x] The retry loop's "conflicts should be impossible" comment corrected: they are possible when the coordinator comments the flipped item mid-flight.
- [x] Evidence: a simulated same-file main commit during a flip run ends merged (not wedged) — documented repro in the item.

## Notes

### Redo-on-conflict design (landed in `.github/workflows/auto-done.yml`)

When the merge retry loop's `git rebase origin/main` fails (after `git rebase --abort`), a new `redo_flip` function runs, bounded at 2 attempts (each attempt gets a fresh worktree and a fresh branch suffix `redo1`/`redo2` so nothing collides with the wedged branch):

1. `git worktree add --detach <mktemp -d /tmp/auto-done-redo.XXXXXX> origin/main` — a FRESH checkout of main, so it already contains the coordinator's mid-flight comment commit; no rebase, no conflict possible.
2. In the worktree: `npm ci && npm run build`, then re-run the flip loop (`node dist/cli.js update <id> --status done --json` per id), logging per-id outcomes (done/skip/cascade/skipped) exactly like the main path.
3. Commit, push a NEW branch `chore/auto-done-<run_id>-redo<N>`, post the `cli` check on the new head, open the PR, squash-merge it.
4. If main already has the items done (nothing to flip), that counts as recovery: the wedged branch is deleted and the wedge is moot.
5. Cleanup runs ALWAYS (success or failure): `git worktree remove --force` + `git worktree prune` + `rm -rf` of the temp dir. On success the old wedged flip branch `chore/auto-done-<run_id>` is deleted.
6. If both redo attempts fail, the original `::warning::` (admin-merge recovery) fires, now stating both the rebase conflict and the redo failure.

The stale retry-loop comment ("conflicts should be impossible — the flip only touches tasks/") was replaced with the correct explanation: conflicts occur when `arggon comment` on the flipped item auto-commits the same item file to main mid-flight; the redo path covers it. docs/agents.md (auto-done wedge paragraph) got a one-sentence note on the redo recovery.

### Evidence — simulated repro (EXECUTED 2026-09-15, locally, real `dist/cli.js` from this branch)

Scripted against a throwaway git repo in /tmp with the real built CLI:

1. `main` has `task-demo` (`in_progress`). Flip branch `chore/auto-done-123` commits `status: done` + a bumped `updated:` line (what the flip changes).
2. While the flip PR is "open", the coordinator comment lands on main — `arggon comment` rewrites the SAME item file and touches the same frontmatter lines. Committed to main.
3. Retry loop step 1 — `git rebase main` on the flip branch: **CONFLICT** on `tasks/arggon-manager/cli/story-demo/task-demo.md` → `git rebase --abort` (this is the #262 wedge, reproduced).
4. Redo path — `git worktree add --detach <tmp> main`; CLI on fresh main reports `task-demo status = in_progress`; `update task-demo --status done --json` → ok, `{"item":{"id":"task-demo","status":"done"}}`, auto-commit `chore(tasks): done task-demo` based on comment-carrying main.
5. Squash-merge the redo commit into main, remove the temp worktree, delete `chore/auto-done-123`.
6. Final state on main: `status=done`, the `### review` comment section is PRESERVED, wedged branch gone, no worktrees left behind (`git worktree list` shows only the root).
7. Idempotency: re-running `update task-demo --status done --json` on the already-done tree exits ok and produces **no diff** (tree stays clean).

Actual output (abridged):

```
STEP1 rebase: CONFLICT on tasks/arggon-manager/cli/story-demo/task-demo.md (the wedge) -> enter redo path
STEP2 redo: task-demo status on fresh main = in_progress
STEP2 redo: update ok -> {"id":"task-demo","status":"done"} auto-commit: chore(tasks): done task-demo
STEP3 idempotent re-run of update on done item: exit ok
STEP3 idempotent re-run: no diff produced (tree stays clean)
STEP4 final on main: status=done; comment section preserved: 1; wedged branch remaining: 0; worktrees remaining: 1
```

Side finding from the repro (handled in the workflow): the CLI `update --status done` AUTO-COMMITS the flip itself (`commit.hash` in the JSON output) in a clean worktree, so `redo_flip` treats an empty staged tree as success rather than pushing a redundant commit / failing on "nothing to commit".

REASONED, not executed (needs the live GitHub environment; mirrors the already-proven main path step for step): the `gh pr create` / `post_cli_check` / `gh pr merge --squash` calls on the redo branch, branch-propagation `sleep 10`, and branch deletion via `git push origin --delete`.
