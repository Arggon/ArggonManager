---
type: task
status: done
id: task-next-priority-ranking
title: "next: priority-major orchestrator ranking (reason + MCP lockstep, ADR 0009)"
assignee: Arggon
branch: feat/task-next-priority-ranking
parent: story-next
labels: [p2]
created: "2026-09-17"
updated: "2026-09-17"
depends_on: [task-priority-field-schema]
---
<!--
  Placement (v0): tasks/scale-adoption/agent-loop/story-next/task-next-priority-ranking.md
  Leaves live only under a story. id is the filename stem: task-next-priority-ranking.
  CLI `arggon create task next-priority-ranking` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# next: priority-major orchestrator ranking (reason + MCP lockstep, ADR 0009)

## Context

Exploration priority-model-008 (approved 2026-09-17, decision i): `next` ranks the ready pool by downstream weight only — the orchestrator's priority judgment never reaches the suggestion. This item makes the ranking PRIORITY-MAJOR: priority (p0 first; unprioritized ranks with p3, displayed as unset), then downstream weight within a priority, then lexicographic. Depends on task-priority-field-schema (the field). ADR 0009 required: the ranking behavior change + schema v4 record, with the rejected alternatives (weighted score, policy knob) and the named risk (flow subordinated to judgment — the reason string surfaces unblocks so the cost of misprioritization is visible).

## Acceptance

- [ ] `next` ready pool ranks: priority (p0<p1<p2<p3, unprioritized=p3-tier) -> downstream weight desc -> lexicographic; `--ready` and blocked-pool semantics unchanged
- [ ] `reason` states the priority (e.g. leading "priority p1; unblocks 3" — exact wording yours, deterministic) and unprioritized reads sensibly
- [ ] MCP `arggon_next`: description updated to the new ranking rule in lockstep (parity test green) + suggestion payload carries priority additively
- [ ] ADR 0009 (docs/adr/0009-item-priority-and-orchestrator-ranking.md): schema v4 + ranking composition, alternatives rejected (weighted score, x-next.ranking knob), risk named
- [ ] Tests: ordering across priorities, intra-priority weight, unprioritized tier, ties, --ready, reason content, MCP parity
- [ ] Docs: README next section; skills sync only if the generated region text changes (it renders descriptions -> yes it will: run skills:sync)
- [ ] Gates: validate ok, suite green, lint/build clean, doctor 0 modified / 0 drifted

### 2026-09-17 @Arggon
REVIEW (coordinator) — APPROVED, merging PR #318.

Provenance: implemented by the coordinator directly (subagent dispatches were being cut by provider rate limits; per established fallback). Priority-major ranking in next.ts (priorityTier: unprioritized orders with p3), reason states the priority and keeps unblocks visible, MCP arggon_next description updated in lockstep, ADR 0009 records schema v4 + ranking with rejected alternatives. Also carries the test-expectation fixes lost with the pruned task-priority-field-schema worktree (second commit).

Verified: full diff read; suite 1047/1047 (66 files; existing fixtures carry no priorities so legacy ordering is unchanged — covered by the untouched downstream-weight describe); lint/build clean; validate ok; doctor 0 modified / 0 drifted; skills:sync run. Live probe on a fixture: t-p1 (zero unblocks) suggested over t-p3-heavy with reason 'priority p1 first, ranking: priority first (unprioritized with p3), downstream weight …'; new tests cover p0-drops-everything, weight-within-priority, unprioritized tier, and full-tie lexicographic determinism.
