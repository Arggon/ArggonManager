---
type: bug
status: todo
id: bug-torture-contention-flake2
title: labs/torture auto-commit contention still flakes in CI despite wall-clock retry
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
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

- [ ] Failure mode identified precisely from the CI log (what held the lock and for how long) and documented in this item
- [ ] Hardening landed: either isolation (scoped TMPDIR/GIT_DIR per fixture) or an observation-level retry that preserves the clean-tree contract; labs/torture scenario green across repeated CI runs

## Notes
