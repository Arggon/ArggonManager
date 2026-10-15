---
type: bug
status: done
id: bug-start-claim-branch-inherits-unpushed-tracker-commits
title: "`start --worktree` cuts the claim branch from the primary checkout's LOCAL HEAD, so a PR inherits every unpushed tracker auto-commit as unrelated diff churn — and the contamination is invisible until the PR is open"
assignee: arggon-delivery-lead
branch: fix/bug-start-claim-branch-inherits-unpushed-tracker-commits
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, claims, tracker-merge]
created: "2026-10-11"
updated: "2026-10-15"
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

- [x] Reproduce on a fixture: a primary checkout with one unpushed tracker auto-commit, then
      `start --worktree` — the claim branch demonstrably contains that local commit
- [x] `start` never cuts a claim branch from a base carrying unpushed tracker auto-commits:
      it branches from a clean base, or it refuses with a named cause **before** creating the
      branch, or it reports the inherited commits in the `--json` envelope so the lead sees the
      contamination before opening a PR (pick one, say why)
- [x] A regression test pins the outcome: `git diff <base>...HEAD` on a freshly claimed branch
      contains **only** the item file
- [x] The refusal or the report names the remedy (push main / drop the inherited commits) and
      distinguishes tracker auto-commits from the lead's own deliberate work
- [x] The chosen route is documented where `start` is described (README,
      `ArggonManager/docs/json-output.md`, `ArggonManager/docs/opencode2.md`) and the
      tracker-merge pitfalls reference it
- [x] `npm test` green, `npm run build` ok, `arggon validate` ok, prettier clean on files touched

## Notes

### 2026-10-15 @Arggon

### Evidence — route (c): report inherited unpushed commits (maker session, 2026-10-15)

**PR:** https://github.com/Arggon/ArggonManager/pull/834 (`fix/bug-start-claim-branch-inherits-unpushed-tracker-commits`, base `main`).

**Route decision: (c) report, not (a) branch-from-clean-base / (b) refuse.**

- (a) rejected: the claimed item file often exists ONLY on the local HEAD — its creation is itself an unpushed `chore(tasks): created <id>` auto-commit (measured on THIS item's own claim: the item file was absent at `origin/main`). Cutting from a clean base would leave the worktree without the item (`loading the item in the worktree` fails) and re-add an item local main already holds. A clean base also needs a fetch or a possibly-stale `origin/*` ref.
- (b) rejected: it fires on the NORMAL flow — item creation auto-commits locally, so the next `start` would be refused until main is pushed; the documented "push main after every mutation" discipline would become a hard precondition on the most common path, and `start` cannot repair it itself (a push is a network mutation).
- (c) chosen: additive, non-breaking, offline-safe, preserves claim semantics, and surfaces the evidence where the decision happens (before the PR is opened). Full rationale in the PR body.

**Repro (fixture, real git + real CLI):** bare `origin` + checkout tracking it, one unpushed tracker auto-commit, then `start --worktree --json`:

- envelope `inheritedCommits`: `{ base: "origin/main", branchPoint: b2a9339…, total: 1, trackerTotal: 1, workTotal: 0, commits: [{ sha, subject: "chore(tasks): created unrelated", tracker: true }], itemOnBase: true, remedy: "push … (git push origin main) … or drop them (git rebase --onto origin/main b2a9339… feat/task-rate-limit)" }`
- claim branch demonstrably contains the local commit: `git -C <worktree> log --oneline origin/main..HEAD` → `b9ddccb claim: task-rate-limit`, `b2a9339 chore(tasks): created unrelated`; `git diff --name-only origin/main...HEAD` → the claimed item file **and** `ArggonManager/unrelated/unrelated.md` (the churn).
- second item (item file itself unpushed): `itemOnBase: false` → remedy drops the rebase arm and says the item file rides one of the inherited commits; human output prints both `note:` lines.

**Regression tests (`cli/src/start.test.ts`, real-git fixtures, 7 new tests):**

- contaminated primary (1 tracker auto-commit + 1 deliberate commit) → report classified; `git diff origin/main...HEAD` asserted to carry `deliberate.ts` + the unrelated item file + the claimed item file.
- clean primary → no report, and `git diff origin/main...HEAD` is ONLY the item file (acceptance box 3).
- plain `start` reports too.
- pure tests: drift pin (`isTrackerAutoCommit` vs kernel `trackerCommitMessage`), cap + exact totals, `itemOnBase` remedy split, human formatter.

**Gates (worktree, rebased onto origin/main):** `npm run arggon -- validate` ok; `npx vitest run cli/src/start.test.ts` 65 passed; `npm test` 3488 passed / 158 files; `npm run lint` clean; `npm run test:structure` 5 passed; `npx prettier --check` clean on every touched file.

**Docs:** README §`start`, `docs/json-output.md` §`start` (row + prose), `docs/opencode2.md` (worktree lifecycle), `skills/arggon-cli/references/pitfalls.md` (tracker-merge) + derived copies/ledger via `skills:sync` / `init . --agents claude`.

**Known gap (follow-up for the delivery lead):** the native `tools.arggon.start` creates the worktree through the host `ctx.worktree.create` domain and its `preparation` receipt carries no equivalent report yet (stated in `opencode2.md`); native parity is a separate item.

### handoff 2026-10-15 @Arggon — next: Delivery lead: review PR #834 (route (c) report, tests, docs); on merge use MERGE-merge (tracker commits). No maker steps left.

- branch: fix/bug-start-claim-branch-inherits-unpushed-tracker-commits
- open questions: Native tools.arggon.start parity (no report yet) — follow-up item; strict-mode refusal could be armed later if reporting proves insufficient; rebase --onto remedy relies on branchPoint at cut time.

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx

verdict: approve

### Lead review + merge verification — 2026-10-15 (delivery lead)

Merged as f4553a0a (PR #834). Route (c) — report, not prevent — accepted, with the maker's reasoning on the record: (a) branch-from-clean-base would leave the worktree without the item file (its creation commit is often itself unpushed) and needs a fetch; (b) refusing fires on the normal flow (item-creation auto-commits are local by nature) and `start` cannot repair it (a push is a network mutation); (c) is additive, offline-safe, and surfaces the evidence before the PR opens. The report rides both start paths when THIS run cuts the branch: `inheritedCommits` in `--json` (base, branchPoint, exact totals, capped list, tracker-vs-work classification, `itemOnBase`, remedy) plus human notes with the remedy leading; attach re-runs and clean bases stay report-free. `itemOnBase` correctly drops the rebase arm when dropping the inherited commits would take the item off the branch.

Evidence: real-git repro (contaminated primary → the branch carries the auto-commit and the envelope names it; clean primary → only the item file), 7 new tests including the drift pin against the kernel's own commit-message builder, the cap/totals, the remedy split and the human formatter; full suite 3488 green; CI green on the refreshed head. Docs: README §start, `json-output.md` §start, `opencode2.md`, and the tracker-merge pitfalls line (skill source + derived copies + ledger). Note: acceptance box 3 is pinned in its clean-base reading ("only the item file") with the contaminated case covered by the report tests — that is the chosen route's contract; recorded.
