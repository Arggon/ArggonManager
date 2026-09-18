---
type: task
status: in_progress
id: task-show-fixture-cleanup
title: "show.test.ts leaks argon-show-* fixture dirs (no teardown)"
assignee: Arggon
branch: feat/task-show-fixture-cleanup
parent: story-self-improvement
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T17:28:22.879Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-show-fixture-cleanup
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/task-show-fixture-cleanup.md
  Leaves live only under a story. id is the filename stem: task-show-fixture-cleanup.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# show.test.ts leaks argon-show-* fixture dirs (no teardown)

## Context

Flagged by the teardown-sweep worker and the CI-flake worker: `cli/src/show.test.ts`
creates `mkdtemp('arggon-show-*')` fixtures with **no teardown at all**, leaking
directories under the shared `/tmp` on every run. Outside the spawn-family scope
of `task-concurrency-test-teardown-sweep`, but the family is now trivial to
close: `cli/src/test-tmp.ts` (`removeFixtureTree`) exists after PR #347.

- **Stale lock file (PR #347 review finding #3).** `cli/src/tracker-commit.test.ts:808`
  (`holdRepoLock`) writes a fake-holder lock and never releases it, leaving one
  `/tmp/.../arggon-lock-*.lock` per run (the sibling at ~:791 releases via a
  detached child). Release it or document the leak with the age-gated cleanup
  as the backstop.

## Acceptance

- [ ] `show.test.ts` tracks its temp dirs and removes them (adopt
      `removeFixtureTree`); no `arggon-show-*` leftovers after a run.
- [ ] Quick audit: any other `mkdtemp`-creating test without teardown gets the
      same treatment in this PR (list recorded).
- [ ] Full suite green; small PR to `opencode2`.

- [ ] The tracker-commit fake-holder lock is released (or the documented leak is explicitly accepted), with the audit list updated.
## Notes

- Leaks are harmless individually but accumulate on shared machines (the
  age-gated global teardown is a backstop, not a substitute).
