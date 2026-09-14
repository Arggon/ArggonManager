---
type: task
status: todo
id: task-vitest-global-teardown
title: "vitest globalTeardown: shared /tmp purge for stale arggon-* fixture dirs"
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
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

- [ ] Shared vitest globalTeardown removes `arggon-*` temp dirs older than a safety threshold (age-gated), configured in vitest.config.ts
- [ ] One-off purge of the current stale backlog executed and noted in the item (count before/after)
- [ ] Concurrent-run safety: the teardown does not remove dirs created after the suite started (documented in a test or the teardown's guard)

## Notes
