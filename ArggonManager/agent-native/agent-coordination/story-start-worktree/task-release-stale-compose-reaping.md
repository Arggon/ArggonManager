---
type: task
status: todo
id: task-release-stale-compose-reaping
title: cleanup --release skips Compose reaping for stale records while --prune reaps them — decide and align (or document the difference)
parent: story-start-worktree
labels: [worktree, cleanup]
created: "2026-10-14"
updated: "2026-10-14"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/task-release-stale-compose-reaping.md
  Leaves live only under a story. id is the filename stem: task-release-stale-compose-reaping.
  CLI `arggon create task release-stale-compose-reaping` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --release skips Compose reaping for stale records while --prune reaps them — decide and align (or document the difference)

## Context

Flagged while fixing `bug-cleanup-release-stale-record-wedge` (PR #813): for a STALE record (a recorded path that is not a live worktree), the `--release` arm now skips removal, Compose reaping, stamp/env handling and treats removal as already-gone — mirroring the pre-existing missing-path release behavior. The `--prune` arm reaps Compose for stale entries. If a dead worktree had Compose services, release leaves them lingering where prune would reap them.

## Acceptance

- [ ] The difference is resolved one way and recorded: either `--release` reaps Compose for stale records like `--prune` does, or the divergence is deliberate and documented with its reason
- [ ] A test pins the chosen behavior
- [ ] `arggon validate` green; PR opened

## Notes
