---
type: task
status: in_progress
id: task-next-priority-ranking
title: "next: priority-major orchestrator ranking (reason + MCP lockstep, ADR 0009)"
assignee: Arggon
parent: story-next
labels: [p2]
created: "2026-09-17"
updated: "2026-09-17"
claimed_at: "2026-09-17T16:29:50.452Z"
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
