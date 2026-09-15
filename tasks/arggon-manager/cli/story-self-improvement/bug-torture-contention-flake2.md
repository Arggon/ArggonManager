---
type: bug
status: done
id: bug-torture-contention-flake2
title: labs/torture auto-commit contention still flakes in CI despite wall-clock retry
assignee: Arggon
branch: fix/bug-torture-contention-flake2
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-torture-contention-flake2.md
  Leaves live only under a story. id is the filename stem: bug-torture-contention-flake2.
  CLI `arggon create bug torture-contention-flake2` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# labs/torture auto-commit contention still flakes in CI despite wall-clock retry

## Context

Second occurrence (first: bug-autocommit-silent-skip / PR #168, which moved the retry budget from ~450ms attempt-counted to 10s wall-clock). Observed again 2026-09-14 in PR #207's first CI run: `labs/torture.test.ts` "concurrent tracker auto-commit contention" failed — a losing commit race left `task-a.md` dirty (git status cleanliness assertion). Passed locally and on CI re-run. The 10s budget absorbs SLOW contention; the CI failure mode appears to be different (likely many concurrent suites on the runner stretching a git operation past the budget, or retry loop contention between the suite's own 6 processes). Needs isolation hardening (e.g. per-test GIT_DIR/TMPDIR isolation, or making the assertion retry-tolerant at the observation level without weakening the contract), not another budget bump.

## Acceptance

- [x] Failure mode identified precisely from the CI log (what held the lock and for how long) and documented in this item
- [x] Hardening landed: either isolation (scoped TMPDIR/GIT_DIR per fixture) or an observation-level retry that preserves the clean-tree contract; labs/torture scenario green across repeated CI runs (PR #214 cli check green; 6/6 stable local vitest runs of labs/torture.test.ts; full suite 817 passed)

## Notes

### Failure mode (CI run 34904682283, 2026-09-14T22:33, job "cli", step "npm run test")

- Assertion: `labs/torture.test.ts:317` — `git status --porcelain` returned `M tasks/launch/auth/story-login/task-a.md` instead of `""`. All "every comment landed" assertions (lines 308–311) had already passed: every comment was written to its file.
- Timing: the whole scenario ran in **3292ms** — the 10s commit retry budget was NEVER exhausted. This is not scheduler starvation and not a slow lock holder; the losing process never got near its deadline.
- No lock warning in the log: `warnGitSkip` was not on this path. The skip was **silent on stderr** (the "nothing to commit" benign path stays quiet by design) but **present in the JSON payload** as `commit.skipped: "nothing to commit"` (ok:true).
- Mechanism (git index-clobber race, not index.lock contention): process A `git add` succeeds; process B `git add` succeeds; A's `git commit` (or B's) rewrites `.git/index` between the other process's `add` and its `commit`, dropping the other's staged entry. The loser's `git commit` then reports "nothing to commit" → `commitTrackerMutation` returns a benign quiet skip → its mutation sits written-but-uncommitted → dirty `task-a.md`.
- Conclusion: the product's 10s budget is NOT wrong; no product change needed. The test treated `ok:true` + `commit.skipped` as full success while also demanding a clean tree — correct contract, missing recovery.

### Hardening

Mirrors the post-fix comment-race.test.ts pattern: cleanly reported skips are collected — both `ok:false` lock failures AND `ok:true` with a `commit.skipped` payload — and each is retried sequentially (one extra `comment` invocation; its auto-commit picks up the uncommitted mutation too), after which the strict clean-tree/index.lock assertions stand unchanged. The scenario still runs 6 real concurrent processes against real git; an *unreported* skip still fails the assertion.

### 2026-09-15 @Arggon
Lead-architect review: APPROVED — and the root-cause analysis is the best part of this cycle. Index-clobber race (add/commit interleaving drops the loser's staged entry) is a DIFFERENT failure than the budget exhaustion we fixed in #168, proven by the 3292ms timing and the silent-on-stderr benign skip path. Hardening mirrors the comment-race pattern without weakening the clean-tree contract, and correctly leaves the product budget alone. Your follow-up candidate (the 'nothing to commit' benign path masking a lost staged entry) is going to the backlog per standing rule. Merge follows.

