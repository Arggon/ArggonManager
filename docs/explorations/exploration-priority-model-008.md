---
exploration_id: priority-model-008
title: "Priority model: first-class priority on all item types + orchestrator ranking"
status: open
created: 2026-09-17
---

# Exploration: Priority model (priority-model-008)

Requirements (user, 2026-09-17): (1) initiatives, epics, stories, tasks and
bugs must be able to carry a priority; (2) the orchestrator assigns those
priorities and suggests work based on them. Investigated in code 2026-09-17:
`cli/src/next.ts`, `cli/src/filter.ts`, `cli/src/convention.ts`,
`cli/src/mcp-server.ts`, `docs/convention.md`, and the tracker itself.

## Current mechanics (facts)

- Priorities exist today as a LABEL CONVENTION: `labels: [p2]` etc. Labels are
  a generic kebab-case list (docs/convention.md: kebab ASCII, unique) — `p2`
  has no schema meaning. Usage: 41 of 190 items carry a pN label (23 p2,
  15 p3, 3 p1); 149 are empty. Labels are filterable (`label:p2`).
- `arggon next` (ADR 0006 next-first) ranks the ready pool by TRANSITIVE
  DOWNSTREAM WEIGHT (how many items become claimable once this one closes),
  descending, lexicographic tiebreak. Priority plays no role. The MCP
  `arggon_next` description hardcodes this ranking rule (parity-tested).
- Filter language fields: status, type, assignee, label, parent, depends-on,
  blocked-by, ancestor — no priority.
- Schema evolution: tree `version:` in `tasks/.convention.yml` (v0–3); v2 added
  branch patterns, v3 added `x-tracker`/`x-generated`. A new non-namespaced
  frontmatter key on all item types is a convention change (validate semantics,
  create/update flags, JSON payloads, docs).
- Precedent framing: mature trackers (Jira, Linear) keep JUDGMENT priority
  (field: Critical/High/…) separate from FLOW ordering (rank/swap-to-top). Our
  downstream weight IS the flow ordering; this requirement adds the judgment
  axis. The two should compose, not compete.

## The core design question

Priority (orchestrator judgment: how important?) and downstream weight
(structural fact: how much does this unblock?) are orthogonal. The ranking
question is how to compose them:

- **(i) Priority-major**: sort ready pool by priority (p0 → p3, unprioritized
  ranks with p3), then downstream weight, then lexicographic. Predictable,
  explainable, matches the requirement literally. Cost: a P1 that unblocks
  nothing always outranks a P3 that unblocks ten — the flow signal becomes
  intra-priority only. Mitigation: P0 is documented as "drop everything";
  mis-prioritization is the orchestrator's to fix.
- **(ii) Weighted score**: `score = priorityWeight + downstreamWeight` (e.g.
  p0=1000, p1=100, p2=10, p3=1). Blends both axes; but magic constants, results
  feel arbitrary across priorities, and the reason string gets harder to
  explain to an agent.
- **(iii) Configurable** (`x-next.ranking:` in convention.yml: keep
  downstream-first | priority-first | balanced): respects adopter diversity but
  adds a policy knob — against the repo principle "one clear default over
  team-policy ambiguity".

## Options for the field itself

- **(a) Dedicated frontmatter field** `priority: p0|p1|p2|p3` (optional;
  absent = unprioritized) on ALL five types. Schema change: convention.md v4
  section, validate rule (unknown value = error), `create --priority` /
  `update --priority` (mirrors `--labels` parity), additive `priority` in
  show/list/next JSON payloads, new filter field `priority:` (with
  `priority:none` matching unset — the orchestrator's unprioritized worklist),
  board chip, `report` optional grouping. Typed, sortable, validated, carries
  the orchestrator's signature.
- **(b) Labels-only**: teach next/filter to interpret `label:pN`. Zero schema
  change, but a `p2` label remains semantically void (any string passes), no
  validation, no ordering guarantee, and requirement 1 says items "must be
  capable of having a priority" — a convention inside a generic list is the
  status quo that already failed to reach `next`.
- **(c) Dedicated field + one-shot migration**: (a) plus `arggon priority
  migrate [--dry-run]` moving existing `pN` labels into the field (41 items;
  labels stay for non-priority uses — no double representation).

## Orchestrator flow (requirement 2)

Assignment is orchestrator JUDGMENT; the tool stays mechanical and makes the
state visible:

1. `create --priority p1` / `update <id> --priority p2` (and `--priority ""`/
   absent to clear). Validation: enum only.
2. The orchestrator's worklist for unassigned priorities:
   `arggon list --filter "status:todo priority:none"` (new field + `none`).
3. `next` ranks by the chosen composition and its `reason` states the priority
   (agents parse the reason; the MCP description updates in lockstep — parity
   test enforces it).
4. Containers (initiative/epic/story) carry priorities as PLANNING signals —
   they rank in `next --include-stories` by the same rule; children do NOT
   auto-inherit (explicit over implicit; the parent chain is already shown in
   the suggestion).

## Recommendation

**(c) + ranking (i), staged in two items:**

1. **Item A — priority field**: schema v4 (`priority` optional on all types,
   enum p0–p3, absent = unprioritized), validate rule, `--priority` on
   create/update, `priority:` filter field (+`none`), additive payloads,
   `arggon priority migrate [--dry-run]` (moves pN labels → field), board chip,
   docs. `next` untouched in this item.
2. **Item B — orchestrator ranking**: next ranks ready pool priority-major,
   downstream weight within a priority, lexicographic within ties; reason
   mentions priority; MCP `arggon_next` description + payload in lockstep;
   ADR (ranking behavior change + schema v4 record).

Reject (b) (already failed to reach the ranking), (ii) (unexplainable scores),
(iii) (policy knob against engineering.md Goals #2). Risk to name in the ADR:
priority-major subordinates flow to judgment — the orchestrator owns keeping
priorities honest; `next`'s reason surfaces the unblocks count so the cost of a
prioritization mistake is visible in every suggestion.

## Decision

<!-- ADR placeholder: docs/adr/0009-item-priority-and-orchestrator-ranking.md once decided. -->
