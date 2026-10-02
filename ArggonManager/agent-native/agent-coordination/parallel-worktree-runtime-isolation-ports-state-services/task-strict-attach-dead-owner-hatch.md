---
type: task
status: in_progress
id: task-strict-attach-dead-owner-hatch
title: "Strict worktree-write gate: recovery hatch when the stamped owner session is dead"
assignee: Arggon
branch: feat/task-strict-attach-dead-owner-hatch
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, opencode-seam]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T03:24:55.350Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-strict-attach-dead-owner-hatch
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-strict-attach-dead-owner-hatch.md
  Leaves live only under a story. id is the filename stem: task-strict-attach-dead-owner-hatch.
  CLI `arggon create task strict-attach-dead-owner-hatch` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Strict worktree-write gate: recovery hatch when the stamped owner session is dead

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-01 @Coordinator
Filed from the #568 review: under `x-tracker.strict-worktree-writes`, a crashed stamped session makes every new session 'foreign' by session id, and the refusal's own remedy ('have it re-attach') is impossible — the documented manual recovery is removing `<git-dir>/arggon-claim.json` by hand.

## Acceptance
- [ ] Document the manual recovery step in convention.md + agents.md (in the #568 docs touch or this item's PR).
- [ ] Decide + implement a designed hatch: e.g. `start --take-over-worktree` (records a dated takeover receipt naming the replaced stamp), or a stale-stamp window (claimedAt older than N days auto-expires with a warning).
- [ ] Tests: dead-owner scenario pins the hatch; live-owner refusals unchanged.
