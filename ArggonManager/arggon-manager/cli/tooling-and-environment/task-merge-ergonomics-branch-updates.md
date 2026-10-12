---
type: task
status: in_progress
id: task-merge-ergonomics-branch-updates
title: "Merge ergonomics: require-up-to-date + tracker auto-commit churn makes every merged PR stale for the next one — evaluate merge queue / auto-update-branch / a documented refresh step"
assignee: arggon-delivery-lead
branch: feat/task-merge-ergonomics-branch-updates
parent: tooling-and-environment
labels: [git, delivery, friction]
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T23:39:22.632Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-merge-ergonomics-branch-updates
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-merge-ergonomics-branch-updates.md
  Leaves live only under a story. id is the filename stem: task-merge-ergonomics-branch-updates.
  CLI `arggon create task merge-ergonomics-branch-updates` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Merge ergonomics: require-up-to-date + tracker auto-commit churn makes every merged PR stale for the next one — evaluate merge queue / auto-update-branch / a documented refresh step

## Context

Delivery-lead friction observed 2026-10-12 while landing the release-pipeline waves
(the owner asked for exactly this class of report: "there are too many back and
forwards with branches updates").

The shape, with today's instances:

- `main` receives tracker auto-commits continuously (claims, comments, flips,
  cleanup) plus auto-done bot flips — several per item per day.
- Branch protection requires a PR to be up to date with `main` before merge.
  So with two PRs merging back to back, the second is already `BEHIND`:
  - PR #746: `not mergeable: the head branch is not up to date with the base
branch` → manual `git fetch && git merge origin/main && git push` in the
    worktree, then a fresh CI run before the merge could proceed.
  - PR #747 (first attempt): `Base branch was modified. Review and try the merge
again.` → retry.
- Each refresh costs a full CI cycle (cli ~5-7 min) and a manual worktree dance
  for the delivery lead — the exact per-PR tax that scales with wave width.

## Acceptance

- [ ] Decide the remedy, with reasoning recorded (dated comment on this item;
      a demo/report of the chosen path on a real PR): GitHub **merge queue** on
      `main`; `gh pr merge --auto` plus branch auto-update; a small documented
      refresh procedure (or `arggon` helper) the lead runs before merging; or
      relaxing the up-to-date requirement with the risk named
- [ ] The merge flow the delivery lead follows is written where the lead reads
      it (`docs/agents.md` §Orchestration or `engineering.md` §Naming, commits,
      PRs) so the next lead does not rediscover it — including what to do when
      the merge is refused for staleness
- [ ] No regression in the repo's merge discipline: merge commits (never
      squash) for branches carrying tracker auto-commits; auto-done's flip PRs
      still land (the workflow's own rebase/retry path must not fight the
      chosen remedy)
- [ ] Measured cost recorded before/after (per-PR extra CI runs / manual steps
      on a 2-PR wave), so the improvement is observable rather than asserted

## Notes

### 2026-10-12 @ses_ed6d54e92ffe2VO1GeR34DQEEy
### 2026-10-12 @arggon-delivery-lead — decision recorded (remedy shape)

**Keep the require-up-to-date protection** — it is the only guard against two individually-green PRs merging into a semantically broken combination. The remedy is two-part:

1. **Implemented now (this item):** a documented, one-command refresh the lead runs when a merge is refused. Preferred path without a worktree dance: `gh api -X PUT repos/Arggon/ArggonManager/pulls/<n>/update-branch` (refreshes the PR branch server-side; then re-merge when checks finish). Fallback when a local merge is needed: in the item's worktree `git fetch origin && git merge origin/main && git push`. The doc states what a refusal means (conflict → resolve in the worktree; API 422 → fall back) and when to choose which. Where it lives: `ArggonManager/docs/engineering.md` §Naming, commits, PRs (the lead's reading path). A helper script is optional and at the maker's discretion (test it if added).
2. **Durable fix, owner's settings (recommended, not blocking):** enable the **merge queue** on `main` — it serializes merges and refreshes queued PRs, which is exactly this friction. No agent can change branch protection, so this is recorded for the product owner to enable when convenient.

Measured evidence stays in this item: on 2026-10-12 the wave hit `#746 BEHIND → manual bump` and `#747 "Base branch was modified" → retry`, each costing a full CI cycle (cli ~5–7 min). The maker should tick box 1 citing this comment.
