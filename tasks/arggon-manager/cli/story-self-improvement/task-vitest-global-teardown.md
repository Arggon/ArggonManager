---
type: task
status: in_progress
id: task-vitest-global-teardown
title: "vitest globalTeardown: shared /tmp purge for stale arggon-* fixture dirs"
assignee: Arggon
branch: feat/task-vitest-global-teardown
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T22:27:28.458Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/task-vitest-global-teardown.md
  Leaves live only under a story. id is the filename stem: task-vitest-global-teardown.
  CLI `arggon create task vitest-global-teardown` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# vitest globalTeardown: shared /tmp purge for stale arggon-* fixture dirs

## Context

Follow-up from the bug-tmp-fixture-leak review (PR #198): the per-file tracking shims stop NEW leaks, but (a) ~13.5k stale `arggon-*` dirs from non-rebased branches' runs still sit in /tmp, and (b) branches that miss the per-file pattern leak again. A vitest `globalTeardown` (or globalSetup-registered cleanup) in a shared setup file purges stale `arggon-*` dirs regardless of per-file discipline — age-gated (e.g. only dirs older than the current run) so concurrent suite runs on the same machine don't delete each other's active fixtures.

## Acceptance

- [x] Shared vitest globalTeardown removes `arggon-*` temp dirs older than a safety threshold (age-gated), configured in vitest.config.ts
- [x] One-off purge of the current stale backlog executed and noted in the item (count before/after)
- [x] Concurrent-run safety: the teardown does not remove dirs created after the suite started (documented in a test or the teardown's guard)

## Implementation notes

- **Registration**: Vitest 5 has no `globalTeardown` hook (the option is silently ignored — verified by probe). The supported mechanism is `test.globalSetup` with a file whose default export returns a teardown function, so `vitest.config.ts` registers `./test/teardown-tmp.ts` there. The teardown runs in-process after the suite.
- **Guard logic (concurrent-run safety)**: `SUITE_START_MS` is captured at module load of the teardown file, i.e. when this suite starts. A dir is removed only if `mtimeMs < min(SUITE_START_MS, now - ageGateMs)`, so anything created during or after this suite — including fixtures of a concurrently running suite — is never touched. Symlinks named `arggon-*` are never followed/deleted.
- **Threshold**: 2h (`ARGGON_TEARDOWN_MAX_AGE_MS` env override), chosen because it comfortably exceeds any suite duration here (~30s), giving an extra safety margin on top of the suite-start gate for suites started before ours that are still running.
- **Scope**: /tmp (`os.tmpdir()`) only. The `ArggonManager-*-task-*` worktree siblings created by `worktree.test.ts` live next to real checkouts under the projects parent, not /tmp; deleting those on mtime alone risks live worktrees, so they are intentionally out of scope (the per-file shims own them).
- **Complementarity**: per-file shims (PR #198) = precise, immediate cleanup of what each test creates; this teardown = coarse, age-gated safety net that reclaims leaks from branches missing the shim pattern or from crashed runs. Both are needed.

## One-off purge (2026-09-14)

- Before: 17,262 `arggon-*` dirs in /tmp (`find /tmp -maxdepth 1 -name 'arggon-*' | wc -l`).
- After: ~9.5k remain — all younger than the 2h age gate, i.e. fixtures of live/other sessions and this suite's own fresh runs, deliberately left in place. The stale backlog (older than 2h) was fully purged (7,754 removed on the first proof run).

## Notes
