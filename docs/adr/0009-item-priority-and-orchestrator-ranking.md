# 0009 Item priority and orchestrator ranking

- Status: Accepted (2026-09-17 — adopted explicitly by product decision; exploration priority-model-008)
- Date: 2026-09-17
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)

## Context

Priorities existed only as a label convention (`labels: [p2]` — 41 of 190 items) with no schema meaning, no validation, no filter, and no path into `arggon next`'s ranking, which ordered the ready pool purely by transitive downstream weight (ADR 0006 next-first). Requirement: every item type must carry a priority, the orchestrator assigns it, and suggestions must respect it.

Design tension: priority (orchestrator judgment — how important?) and downstream weight (structural fact — how much does this unblock?) are orthogonal. Mature trackers (Jira, Linear) keep judgment priority separate from flow ordering; our downstream weight is the flow ordering, so the two must compose.

## Decision

1. **Convention v4 field**: `priority: p0|p1|p2|p3` — optional on all five item types, absent = unprioritized (never defaulted). `PRIORITY_INVALID` on unknown values. `priority` leaves the reserved-key set. Accepted additively on v3 trees.
2. **Tooling**: `create --priority` / `update --priority` (clear `--priority ""`); `priority` additive in show/list/create/update/contract payloads and the board; filter field `priority:` with `priority:none` (the orchestrator's unprioritized worklist); `arggon priority migrate` moves the legacy pN labels into the field (highest wins, idempotent, never auto-commits).
3. **Ranking (priority-major)**: `next` ranks the ready pool by priority (p0 best; unprioritized orders with the p3 tier), then downstream weight within a priority, then lexicographic id. The `reason` states the priority and keeps the unblocks count visible.

## Consequences

- The orchestrator's judgment now drives suggestions; the structural flow signal (downstream weight) remains as the intra-priority ordering and stays printed in every reason, so the cost of a misprioritization is readable at a glance.
- **Named risk**: priority-major subordinates flow to judgment — a P1 that unblocks nothing outranks a P3 that unblocks ten. Mitigation: P0 is documented as "drop everything"; `next` surfaces the suppressed unblocks count; fixing priorities is a cheap `update`.
- Schema v4: additive field, accepted on v3 trees; docs/convention.md carries the v4 section.

## Alternatives considered

Full analysis in [exploration priority-model-008](../explorations/exploration-priority-model-008.md):

- **Labels-only** — the status quo; a `p2` label is a semantically void string and never reached the ranking.
- **Weighted score** (`priorityWeight + downstreamWeight`) — blends the axes but with magic constants and suggestions that are hard to explain to agents.
- **Configurable ranking** (`x-next.ranking:` knob) — adds a policy lever against the repo principle of one clear default.
- **Downstream-weight-first (status quo)** — ignores the requirement; judgment never reaches suggestions.
