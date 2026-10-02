---
type: task
status: todo
id: task-adr-0019-hatch-shipped-wording
title: "ADR 0019 decision point 4: record the shipped dead-owner take-over (and the native surface's take-over input)"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs, adr]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-adr-0019-hatch-shipped-wording.md
  Leaves live only under a story. id is the filename stem: task-adr-0019-hatch-shipped-wording.
  CLI `arggon create task adr-0019-hatch-shipped-wording` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0019 decision point 4: record the shipped dead-owner take-over (and the native surface's take-over input)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Owed by the task-adr-0019-amendment-claim-stamp verdict and confirmed by the PR #579 review: ADR 0019's decision point 4(b) still says the recovery hatch "is tracked in `task-strict-attach-dead-owner-hatch`". It has since shipped in two parts — `arggon start <id> --worktree --take-over-worktree` (#573, kernel-owned `WorktreeClaimRequest.takeOver`, default OFF, bounded `takeovers` chain, the fired evidence moved out of `claim.foreignWrites` so both strict gates needed no change) and the native seam's `takeOverWorktree` input (#579). The stale-stamp window stays a recorded **rejected** alternative, and the raw-porcelain detection fix (#573) is worth a clause in the same place since it is a decision-relevant implementation fact, not trivia.

## Acceptance
- [ ] ADR 0019 decision point 4 names the shipped hatch (flag + native input), the anti-unlock invariant, and the dead-owner recovery order (flag, then the manual `rm`, then the modelled hatch in task-strict-attach-dead-owner-hatch).
- [ ] The rejected stale-window row and the accepted explicit-hatch row stay consistent with what shipped.
- [ ] No ADR status change (0019 is still Proposed); wording-only, and `validate` + prettier green.
