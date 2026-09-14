---
type: bug
status: in_progress
id: bug-autocommit-retry-budget-flake
title: "labs/torture scenario 2 flakes under loaded CI: autocommit retry budget too short"
assignee: Arggon
branch: fix/bug-autocommit-retry-budget-flake
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T17:55:16.988Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-autocommit-retry-budget-flake.md
  Leaves live only under a story. id is the filename stem: bug-autocommit-retry-budget-flake.
  CLI `arggon create bug autocommit-retry-budget-flake` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# labs/torture scenario 2 flakes under loaded CI: autocommit retry budget too short

## Context

Found 2026-09-14 by the wave-2 merge verification (PR #163's `cli` run): `labs/torture.test.ts` scenario 2 ("N=6 commenting processes with x-tracker.auto-commit: all mutations committed, no index.lock debris") failed under CI load with `expected 'M  tasks/...' to be ''` — one mutation's commit lost the index.lock race PAST the retry budget (4 attempts, ~450ms total backoff) and was left staged-uncommitted.

Root cause: `commitTrackerMutation`'s retry budget is attempt-counted, not wall-clock. git holds `index.lock` for milliseconds, but a loaded CI runner can stretch a contention window past ~450ms. The fix (wall-clock budget of 10s, lock.ts `LOCK_TIMEOUT_MS` philosophy, injectable `commitRetryTimeoutMs` for tests) was developed on `fix/bug-autocommit-silent-skip` (commit f73ac7e) but that PR had already merged when CI exposed the flake, so it never reached main. This bug lands it.

## Acceptance

- [ ] `commitTrackerMutation` retries index.lock contention within a wall-clock budget (10s default, injectable via `commitRetryTimeoutMs`) instead of an attempt count
- [ ] The skip path is still exercised by a test (injected small budget) and reported via payload + stderr warning
- [ ] labs/torture.test.ts scenario 2 is green under the retry-budget fix (full suite green)

## Notes

- Evidence: `cli` run of PR #163, 2026-09-14T17:35Z, `AssertionError: expected 'M  tasks/launch/auth/story-login/task…' to be ''`.
- Fix commit: f73ac7e on `fix/bug-autocommit-silent-skip` (post-merge push; stranded).

## Notes
