---
type: task
status: done
id: task-adr-0019-amendment-claim-stamp
title: "Amend ADR 0019 with the claim-stamp/detection layer (claim concurrency decision, per engineering.md's ADR list)"
assignee: Arggon
branch: feat/task-adr-0019-amendment-claim-stamp
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, docs]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
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

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
verdict: approve — the amendment is purely additive (49 insertions, 0 deletions) and does the job the review commissioned: decision point 4 records the claim/concurrency layer (stamp in the git dir, attach-time detection, report-only default with the strict escalation), the two invariants that are decision rather than implementation detail (a fired detection never re-stamps; recovery from a dead stamped session is explicit), consequences (dependency-free and platform-agnostic kernel, additive `claim`/`preparation.claim` with `schemaVersion` unchanged and a byte-identical default, the assignee-vs-session-id asymmetry accepted), and the four alternatives that lost with reasons (lockfile both surfaces honor, commit-log detection, strict-by-default, stale-window auto-takeover deferred to the hatch item). convention.md's claim-stamp bullet now cross-links decision point 4; agents.md needed no change and stays consistent. `validate` ok:true; CI green on the reconciled head (one rerun of a docs-only PR — `cli` hit the freshly-filed handoff/lib-dist import flake, tracked as bug-handoff-cli-spawn-lib-dist-import-race).

Merged: PR #571 squash -> main. Item done. Follow-up owed (coordinator-owned, not merge-blocking): after the hatch PR lands, refresh decision point 4's wording from "tracked in task-strict-attach-dead-owner-hatch" to the shipped flag `start --worktree --take-over-worktree`, and record the native-surface recovery gap (task-native-start-take-over-input).
