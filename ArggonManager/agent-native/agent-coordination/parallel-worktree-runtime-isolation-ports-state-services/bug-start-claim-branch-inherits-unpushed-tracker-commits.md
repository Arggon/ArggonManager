---
type: bug
status: in_progress
id: bug-start-claim-branch-inherits-unpushed-tracker-commits
title: "`start --worktree` cuts the claim branch from the primary checkout's LOCAL HEAD, so a PR inherits every unpushed tracker auto-commit as unrelated diff churn — and the contamination is invisible until the PR is open"
assignee: arggon-delivery-lead
branch: fix/bug-start-claim-branch-inherits-unpushed-tracker-commits
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, claims, tracker-merge]
created: "2026-10-11"
updated: "2026-10-15"
claimed_at: "2026-10-15T01:53:28.340Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-start-claim-branch-inherits-unpushed-tracker-commits
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-start-claim-branch-inherits-unpushed-tracker-commits.md
  Leaves live only under a story. id is the filename stem: bug-start-claim-branch-inherits-unpushed-tracker-commits.
  CLI `arggon create bug start-claim-branch-inherits-unpushed-tracker-commits` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `start --worktree` cuts the claim branch from the primary checkout's LOCAL HEAD, so a PR inherits every unpushed tracker auto-commit as unrelated diff churn — and the contamination is invisible until the PR is open

## Context

Observed 2026-10-11 during Wave 1 of the `agent-native` delivery. Three worktrees were
claimed through `tools.arggon.start({ id, assignee, worktree: true })` at 01:18 local, and
each claim branch was cut from the primary checkout's **local** HEAD. That HEAD carried
tracker auto-commits that had not been pushed (`0eeff696` / `a88a7991` / `119b51cd`), and
whose content later reached `origin/main` through squash merges of PRs #679/#680.

Consequence, measured: PR #681's diff carried `task-friction-capture-command.md` (+12) and a
whole new item file, `task-decision-pending-methodology-improvements-014.md` (+45) — two
unrelated item files riding a CLI fix. PR #683 hit the same inheritance and had to merge
`origin/main` (with an add/add conflict on that item file) before its diff was clean.

The documented prevention ("push main immediately after every primary-checkout mutation",
`agents.md` §0) is a discipline, not a mechanism: nothing in `start` checks the base it
branches from, nothing reports the inherited commits, and the contamination is invisible
until the PR is open and its diff is read.

## Acceptance

- [ ] Reproduce on a fixture: a primary checkout with one unpushed tracker auto-commit, then
      `start --worktree` — the claim branch demonstrably contains that local commit
- [ ] `start` never cuts a claim branch from a base carrying unpushed tracker auto-commits:
      it branches from a clean base, or it refuses with a named cause **before** creating the
      branch, or it reports the inherited commits in the `--json` envelope so the lead sees the
      contamination before opening a PR (pick one, say why)
- [ ] A regression test pins the outcome: `git diff <base>...HEAD` on a freshly claimed branch
      contains **only** the item file
- [ ] The refusal or the report names the remedy (push main / drop the inherited commits) and
      distinguishes tracker auto-commits from the lead's own deliberate work
- [ ] The chosen route is documented where `start` is described (README,
      `ArggonManager/docs/json-output.md`, `ArggonManager/docs/opencode2.md`) and the
      tracker-merge pitfalls reference it
- [ ] `npm test` green, `npm run build` ok, `arggon validate` ok, prettier clean on files touched

## Notes
