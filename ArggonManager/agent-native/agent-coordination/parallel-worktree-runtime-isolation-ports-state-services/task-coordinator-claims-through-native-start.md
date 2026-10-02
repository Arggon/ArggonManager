---
type: task
status: todo
id: task-coordinator-claims-through-native-start
title: The coordinator contract never tells the coordinator to claim through `tools.arggon.start` — live worktrees on items that are still `todo`/unclaimed
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam, methodology, worktree]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-coordinator-claims-through-native-start.md
  Leaves live only under a story. id is the filename stem: task-coordinator-claims-through-native-start.
  CLI `arggon create task coordinator-claims-through-native-start` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The coordinator contract never tells the coordinator to claim through `tools.arggon.start` — live worktrees on items that are still `todo`/unclaimed

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @ses_f03213cdbffeJ4RqV9JXfur867
Found by a 0.5.0 adoption audit (2026-10-02, coordinator session).

## Context

`ArggonManager/docs/agents.md` §Orchestration documents the native claim path —
`tools.arggon.start({ id, assignee, worktree: true })` — and says the manual
`git worktree add ../<repo>-<id> -b <branch>` step "can be folded into the claim". The generated
coordinator contract never says so: `templates/docs/opencode/agents/arggon-coordinator.md` mentions
only "the worktree path" in the worker-launch duty, with no claim step anywhere. A coordinator that
follows only its own contract hand-rolls worktrees and never claims.

That is not hypothetical — it is the current tree:

- `task-native-start-take-over-input`: `todo`/unclaimed on `origin/main`, `branch: null`,
  `worktree_path: null` — while PR #579 is **open** and the worktree holds 3 unpushed commits.
- `bug-release-notes-extraction-breaks-on-linked-header` (p1): `todo`/unclaimed on `origin/main`,
  `branch: null` — while its worktree carries 5 changed files, 1 commit ahead of main, and **no PR**,
  including the untracked new `cli/src/release-notes.ts` + `cli/src/release-notes.test.ts`.

Every 0.5.0 worktree guarantee is inert for work claimed this way: no claim stamp (so no
foreign-writer detection), no recorded `worktree_path` (so `cleanup` cannot classify or reap it),
no install link farm or gate-bin readiness receipt, no `.arggon.env`, no draft PR.

## Acceptance

- [ ] `templates/docs/opencode/agents/arggon-coordinator.md` states the claim step explicitly:
      claim through the native `start` with `worktree: true` before dispatching a worker; never
      hand-roll `git worktree add` for a claim; the worktree path comes from the item's recorded
      `worktree_path`, not from a convention guess.
- [ ] Both drifted items reconciled and the outcome recorded on each: `bug-release-notes-…` gets a
      claim (and its uncommitted work committed + PR'd) or its abandoned work is explicitly
      dispositioned; `task-native-start-take-over-input` gets its claim recorded so PR #579's head
      matches a claimed item.
- [ ] A seam test pins the coordinator contract on the native-claim step, so a regenerated template
      cannot quietly drop it again (the same failure mode the prover agent had: shipped in the
      template, missing from the pinned expectation).
- [ ] Evidence on the item: the reconciled frontmatter for both items + the passing seam test.
