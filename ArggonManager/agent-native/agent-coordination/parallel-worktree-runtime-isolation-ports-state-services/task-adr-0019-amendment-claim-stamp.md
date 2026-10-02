---
type: task
status: in_progress
id: task-adr-0019-amendment-claim-stamp
title: "Amend ADR 0019 with the claim-stamp/detection layer (claim concurrency decision, per engineering.md's ADR list)"
assignee: Arggon
branch: feat/task-adr-0019-amendment-claim-stamp
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, docs]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T03:24:49.901Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr-0019-amendment-claim-stamp
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-adr-0019-amendment-claim-stamp.md
  Leaves live only under a story. id is the filename stem: task-adr-0019-amendment-claim-stamp.
  CLI `arggon create task adr-0019-amendment-claim-stamp` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Amend ADR 0019 with the claim-stamp/detection layer (claim concurrency decision, per engineering.md's ADR list)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-01 @Coordinator
Filed from the #568 review: engineering.md lists 'Claim/concurrency model' as ADR-worthy, and ADR 0019 (Proposed) is this story's parent decision record — the claim stamp (git-dir arggon-claim.json), attach-time foreign-write detection, and the strict-worktree-writes escalation are a durable concurrency-semantics layer that belongs there as a short amendment (Decision: the stamp/detection as a layer beside layer 1; Consequences: additive preparation.claim receipt, behavioral per ADR 0016, no cleanup lifecycle because git owns the directory). Acceptance: amendment section in ADR 0019 consistent with convention.md/agents.md; cross-linked from the #568 item.
