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

- [x] ADR 0019 carries the claim/concurrency layer as a decision beside layers 1/2, with the anti-unlock invariant and the dead-owner recovery named as part of the decision. Evidence: `docs/adr/0019-worktree-runtime-isolation.md` decision point 4 (+ its `Amendment (2026-10-02, PR #568)` note), header amendment line; purely additive (+49 lines, 0 deletions).
- [x] Consequences recorded: the layer stays dependency-free and platform-agnostic (a JSON file in a directory git owns, one porcelain read + one `stat` per dirty path, 10-name cap, no cleanup surface), the JSON contract grows additively (`claim` / `preparation.claim`, `schemaVersion` unchanged, default path byte-identical), and the CLI-assignee vs native-session-id asymmetry is recorded as accepted, not papered over.
- [x] Alternatives that lost are recorded with their reasons: a lockfile the CLI and native tools both honor, commit-log-based detection, strict-by-default, and stale-window auto-takeover (deferred to task-strict-attach-dead-owner-hatch).
- [x] Consistent with convention.md + agents.md, which document the same contracts (the convention key paragraph now cross-links ADR 0019 decision point 4; agents.md §Single-writer ownership is unchanged and consistent), and cross-linked from the task-single-writer-worktree-enforcement item.
- [x] Docs-only change: no code, no plugin bundle regen; `npm run arggon -- validate` ok:true.

## Notes

### 2026-10-02 @Coordinator
Filed from the #568 review: engineering.md lists 'Claim/concurrency model' as ADR-worthy, and ADR 0019 (Proposed) is this story's parent decision record — the claim stamp (git-dir arggon-claim.json), attach-time foreign-write detection, and the strict-worktree-writes escalation are a durable concurrency-semantics layer that belongs there as a short amendment (Decision: the stamp/detection as a layer beside layer 1; Consequences: additive preparation.claim receipt, behavioral per ADR 0016, no cleanup lifecycle because git owns the directory). Acceptance: amendment section in ADR 0019 consistent with convention.md/agents.md; cross-linked from the #568 item.
