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

- [x] Decide the remedy, with reasoning recorded (dated comment on this item;
      a demo/report of the chosen path on a real PR): GitHub **merge queue** on
      `main`; `gh pr merge --auto` plus branch auto-update; a small documented
      refresh procedure (or `arggon` helper) the lead runs before merging; or
      relaxing the up-to-date requirement with the risk named
- [x] The merge flow the delivery lead follows is written where the lead reads
      it (`docs/agents.md` §Orchestration or `engineering.md` §Naming, commits,
      PRs) so the next lead does not rediscover it — including what to do when
      the merge is refused for staleness
- [x] No regression in the repo's merge discipline: merge commits (never
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

### 2026-10-12 @ses_ecd832dcaffeNprCV9oommyP6g
**Maker evidence — docs-only delivery.**

**Helper decision: not added.** The refresh is one `gh api` PUT plus an optional `gh pr merge --auto`; the fallback is interactive conflict resolution in the worktree. A `cli/` wrapper would be argument-resolution sugar over gh's own CLI — a new maintained surface with a test and the structure gates — and it would be dead weight the moment the merge queue lands. The documented commands are the artifact; no new npm dependency.

**Merge-queue recommendation for the owner (durable fix — a settings change no agent can make):**
- Enable **merge queue** on `main` (Settings → Branches → `main` protection → Require merge queue; the repo is org-owned and public, where the queue is available).
- What it changes: once a PR's required checks pass, adding it to the queue makes GitHub validate it on a `merge_group` of latest `main` + the PRs ahead of it and merge in FIFO order — no branch update, no re-run of the PR's own checks, no retry loop. Set merge method = **merge** to keep merge-not-squash.
- What it needs before it works (follow-up, not this item): CI must also trigger on `merge_group` (`.github/workflows/ci.yml`), or the required `cli` check never reports on the group and merges wedge. The exploration `exploration-ci-pipeline-wall-clock-022` §F flags `push: main` ordering dependencies (ADR 0018 C3, auto-done's re-checkout) as the reason the queue is a delivery-model decision, not a speed fix — verify those when enabling.

**Acceptance evidence:**
- Box 1 ticked: the lead's 2026-10-12 decision comment on this item records the remedy (keep require-up-to-date; documented refresh; merge queue recommended to the owner).
- Box 2: `ArggonManager/docs/engineering.md` §Naming, commits, PRs now carries "Merging: a PR refused as out of date" — server-side `gh api -X PUT …/update-branch` + `gh pr merge --merge --auto` (auto-merge verified allowed: `allow_auto_merge: true`), local-merge fallback for conflicts/422, bot-owned PR branches excluded.
- Box 3: merge discipline untouched — the flow adds no squash path (the documented command is `--merge`), and auto-done's flip PRs keep their own rebase / re-post-`cli` / squash self-merge loop; the doc explicitly excludes bot-owned branches, so the two paths never fight.
- Box 4 (left unchecked): before — #746 BEHIND → manual `git fetch && git merge origin/main && git push` + full CI cycle; #747 "Base branch was modified" → retry (cli ≈5–7 min each). Expected after — one `gh api` PUT + `gh pr merge --auto`: no worktree dance, no retry loop. The live after-observation lands with the lead's own wave merges.

**Gates (worktree, before tracker commits):**
- `npm run arggon -- validate` — expected ok:true; observed `arggon validate: ok (0 warning(s), convention v5)`, exit 0.
- `npx prettier --check` on `ArggonManager/docs/engineering.md` and the item file — expected clean; observed "All matched files use Prettier code style!", exit 0.
- Doc-contract backstop (not required for docs-only, run to protect `main`): `npx vitest run cli/src/adr-status-doc-contract.test.ts cli/src/capability-matrix.test.ts cli/src/mcp-doc-contract.test.ts` — expected pass; observed 3 files / 46 tests passed.

### handoff 2026-10-12 @ses_ecd832dcaffeNprCV9oommyP6g (session: ses_ecd832dcaffeNprCV9oommyP6g) — next: Delivery lead: review + merge the PR; on BEHIND use engineering.md §Naming, commits, PRs refresh flow; observe the box-4 after-cost during this wave.
- branch: feat/task-merge-ergonomics-branch-updates
- open questions: Merge queue needs a merge_group trigger in ci.yml + a push:main ordering check (ADR 0018 C3, auto-done) — follow-up not filed here; box 4 after-observation pending.
