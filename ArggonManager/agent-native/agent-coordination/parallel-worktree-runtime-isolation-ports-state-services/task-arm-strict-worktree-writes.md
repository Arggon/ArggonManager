---
type: task
status: todo
id: task-arm-strict-worktree-writes
title: "Arm `x-tracker.strict-worktree-writes` for the coordinator's parallel waves (or record why the report-only default is kept)"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, methodology]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-arm-strict-worktree-writes.md
  Leaves live only under a story. id is the filename stem: task-arm-strict-worktree-writes.
  CLI `arggon create task arm-strict-worktree-writes` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Arm `x-tracker.strict-worktree-writes` for the coordinator's parallel waves (or record why the report-only default is kept)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @ses_f03213cdbffeJ4RqV9JXfur867
Found by a 0.5.0 adoption audit (2026-10-02, coordinator session).

## Context

This repo *is* the parallel-worktree-runtime-isolation epic: the coordinator runs waves of workers,
one worktree each. `ArggonManager/.convention.yml` already arms `x-tracker.strict-gate-bins: true`
(#533) but leaves `strict-worktree-writes` unset, so #568's single-writer observation stays a
warning that no one reads at the moment of collision. That is the report-only default working as
designed — the flag is opt-in and its refusal is deliberately coordination-shaped, not deletion-shaped
— so this item is a decision item, not a bug.

Today's state is the F12 scenario with the guard off: three worktrees carry uncommitted changes, and
two of them belong to items that are still `todo`/unclaimed on `origin/main` with no
`worktree_path`, so no stamp could even have been written (see
task-coordinator-claims-through-native-start).

## Acceptance

- [ ] Decision recorded on the item: arm the flag, or keep report-only with the compensating
      coordination rule written down (which one is a deliberate choice, not a default).
- [ ] If armed: `x-tracker.strict-worktree-writes: true` in `ArggonManager/.convention.yml`, and
      `ArggonManager/docs/agents.md` §worktree rules updated so the worker contract states the
      refusal shape (the stamped owner, claim time, newer files) and BOTH dead-owner recovery paths
      — `start --worktree --take-over-worktree` and the manual `rm <git-dir>/arggon-claim.json`.
- [ ] If armed: evidence from a real refused attach (or `npm run smoke:native-start-cold`) showing
      the refusal names the owner before any item mutation.
- [ ] If not armed: the compensating rule is written into the coordinator contract (who owns a
      worktree, how a collision is noticed, who may resolve it).
