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

### 2026-10-12 @ses_ecd832dcaffeNprCV9oommyP6g
**Live demo of the documented flow (box 1's "demo/report on a real PR") — and one gate caveat.**

PR #753 opened `BEHIND` (main had moved while the branch was open). Ran the doc's default path, refresh only:
- `gh api -X PUT repos/Arggon/ArggonManager/pulls/753/update-branch` → `{"message":"Updating pull request branch."}`, exit 0 — no 422, no conflict, no worktree dance.
- Observed after: `mergeStateStatus` `BEHIND` → `BLOCKED` with `mergeable: MERGEABLE` (required checks re-running on the refreshed head); local fast-forward to `0a4206bb Merge branch 'main' into feat/task-merge-ergonomics-branch-updates` (18 files from main, none touching this PR's two files).
- Auto-merge deliberately NOT armed — merging is the delivery lead's call, not the maker's.

Gate caveat (expected vs observed, for the standards reviewer): `npx prettier --check ArggonManager/docs/engineering.md` is clean. The item file was prettier-clean at the authored commit (`6f6b3f81`), but the native `comment`/`handoff` appends rewrote it into the tracker tool's standard shape (no blank line after the frontmatter, none after the appended headings) — the same shape as 18/18 sibling items in this folder, all of which fail `prettier --check`; no workflow runs prettier (grep across `.github/workflows/` is empty). I deliberately did not reformat the tracker file. Re-ran on the refreshed head: `npm run arggon -- validate` ok, doc-contract backstop 3 files / 46 tests passed.

### 2026-10-13 @practice-standards-reviewer
### 2026-10-12 @practice-standards-reviewer

verdict: request-changes (impact class missing; two doc-accuracy corrections)

Read: `gh pr diff 753` (exactly 2 files), the item + all comments, `engineering.md` §Review bar / §Naming, commits, PRs, `agents.md` §Changing the methodology itself, live repo settings + branch protection, PRs #746/#747/#753, workflows, `exploration-repo-visibility-011`, `exploration-ci-pipeline-wall-clock-022` §F, ADR 0023. Did not run the project's gates (verifier territory); on head `05edfb09` the required `cli` check is green (`cli`/`tasks-validate`/`ui-smoke` all SUCCESS).

**What holds**

- Scope is exact and the no-helper decision is sound: `engineering.md` (+24) + the item file (+44/−4); no script, no dependency; a wrapper over one `gh api` call would be dead weight once a queue lands.
- The refresh half is real and demonstrated: `gh api -X PUT …/pulls/753/update-branch` left `0a4206bb` "Merge branch 'main' into …" on the branch (18 files from main, none of this PR's two files); #753 is now CLEAN/MERGEABLE. Live settings confirm the premise: `allow_auto_merge: true`, required `cli` check with strict up-to-date.
- Bot exclusion is consistent with `agents.md` §Auto-done (flip PRs self-merge `--squash`; update-branch cannot repair them) and release-please's own branch updates; the human flow adds no squash path.
- Boxes 1–3 are ticked on evidence that exists; box 4 is unchecked with a real before-record (#746 merged 18:50Z, #747 18:57Z on 2026-10-12, both after a manual bump — e.g. `e9b302f8`) and the after-measurement honestly deferred to the lead's wave merges.

**Blocking findings**

1. **Methodology impact class is missing.** This PR touches a named methodology carrier (`ArggonManager/docs/engineering.md`; `agents.md` §Changing the methodology itself), so the PR description *and* an item comment must state the impact class (engineering.md §Review bar → §Docs; agents.md lines 541–546: "a behavioral change without it is a change request"). Neither does: the PR body is Problem/Approach/Test-plan only, and no item comment contains "impact class"/"advisory"/"behavioral". The change documents a new procedure the delivery lead follows — it reads **behavioral** — which also decides whether `skills/arggon-cli/` must move in the same PR (its `references/pitfalls.md` carries the merge-never-squash rule). State the class in both places; if behavioral, add the ADR 0016 reference and check the skill sync.

2. **The `--auto` promise does not hold under this doc's own premise.** "Arming auto-merge once … means the merge lands without a second visit" — GitHub auto-merge does **not** refresh a branch that falls behind after it is armed; with strict up-to-date it waits at `BEHIND` indefinitely. Since the doc's premise is that `main` moves continuously (tracker auto-commits), a main movement during the ~5–7 min check re-run strands the armed PR — the failure mode 2026 field reports name ("auto-merge … never refreshes a stale branch"; `gh`-update sweeps exist precisely for this). The demo deliberately did not arm auto-merge, so this half is also unexercised on the repo. Fix (either): drop `--auto` from the default (refresh → merge once checks finish — what the demo actually did), or keep it and name the re-strand + recovery (`update-branch` again; auto-merge stays armed for a write-access actor).

3. **The merge queue cannot be enabled on this repo as recommended.** The maker's note says "the repo is org-owned and public, where the queue is available", and the new closing sentence implies an available owner setting. Live API: `owner.type: User`; the repo's own `exploration-repo-visibility-011` (2026-09-22) says "owned by a user account (not an org)". GitHub docs: "Pull request merge queues are available in any public repository owned by an organization, or in private repositories owned by organizations using GitHub Enterprise Cloud" — not user-owned repos (the ruleset API rejects `merge_queue` with 422 there). The queue is a delivery-model change (ADR 0023; exploration-022 §F) **plus** an org-transfer precondition — the missing constraint. Correct the note and soften/correct the engineering.md sentence; the `merge_group` CI follow-up is moot until then.

**Minor**

4. The PR body's test plan claims `prettier --check` clean "on engineering.md and the item file"; at head the item file is not prettier-clean (kernel comment/handoff shape, disclosed in the item's live-demo comment). Disclosure is honest and no workflow runs prettier, but the PR-body claim is false at head — correct or qualify it.

Requested changes: impact class in PR description + item comment; the F2 fix; the F3 correction. Nothing else blocks: placement under §Naming, commits, PRs is the location the lead's decision comment chose, the text restates no ADR status, and it duplicates no agents.md rule.

### 2026-10-13 @ses_ecd832dcaffeNprCV9oommyP6g
**Post-review corrections — verdict `request-changes` (practice-standards-reviewer, carried commit `cc90d896`).**

**Methodology impact class: behavioral.** `ArggonManager/docs/engineering.md` is a named carrier (`ArggonManager/docs/agents.md` §Changing the methodology itself); this PR adds a merge-refusal procedure agents must follow (refresh server-side → merge/arm; local-merge fallback; bot-branch exclusion), so it is a pipeline step agents re-learn, not doc reorganization. Adopter-upgrade channel: [ADR 0016](ArggonManager/docs/adr/0016-adopter-upgrade-channel.md). Skill sync for the same PR: `npm run skills:sync` → "synced 7 bundled skill file(s) from their single sources", no tracked diff (`.agents/skills/` is generated/gitignored); `cli/src/skill-copy.test.ts` green (byte-parity pinned), and no skill statement is made false — the merge-never-squash rule in `references/pitfalls.md` still holds.

**F2 — `--auto` re-strand corrected** (`d0694414`): the doc no longer promises "the merge lands without a second visit"; it now states auto-merge does **not** refresh a branch that falls behind after arming, and keeps the recovery one-liner (`update-branch` again; the armed auto-merge completes once the checks pass).

**F3 — merge-queue availability corrected** (`d0694414`): my earlier bullet "the repo is org-owned and public, where the queue is available" was wrong — `gh api users/Arggon --jq .type` → `User`, and GitHub merge queues are organization-owned-repo-only (public org repos, or private org repos on GHEC). The doc's closing sentence and the owner recommendation now state the constraint: the durable fix's precondition is an org transfer (or a non-native queue), and the `merge_group` CI follow-up is moot until then.

**Minor** — the PR body is corrected: `prettier --check` is claimed clean for `engineering.md` only; the item file is disclosed as failing in the kernel's comment/handoff shape (18/18 siblings), and no workflow runs prettier.

Box 4 untouched (unchecked; the lead's after-observation still pending).
