---
type: task
status: done
id: task-next-dependency-ranking
title: next --json ranks ready work by dependency weight (downstream unblocking)
assignee: Arggon
branch: feat/task-next-dependency-ranking
parent: story-cli-ergonomics
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-cli-ergonomics/task-next-dependency-ranking.md
  Leaves live only under a story. id is the filename stem: task-next-dependency-ranking.
  CLI `arggon create task next-dependency-ranking` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# next --json ranks ready work by dependency weight (downstream unblocking)

## Context

Candidate #2 of [product discovery](docs/explorations/exploration-product-discovery-002.md): `next` ignores graph shape — lexicographic-first suggestions make agents pick arbitrary ready work instead of unblocking the most downstream items. Beads' core differentiator is enforced ready-work computation (steve-yegge.medium.com, 2026-09-15). Effort S; principles: architecture-first, token-context (one right answer saves round-trips).

## Acceptance

- [x] `next` ranks ready items by dependency weight (how many downstream items this unblocks; deeper/loaded subtrees first), deterministic tie-break documented
- [x] Ranking rationale surfaces in the suggestion reason (bounded — one line)
- [x] Table-driven tests (blocked chains, parallel ready items, no-deps trees); docs/agents.md or README one line; --json payload unchanged or additively extended

## Notes

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. Reusing buildBlockedByIndex instead of forking a second graph walk is the architecture-first call, the closure is cycle-safe, the tie-break is documented in three places (docstring, README, reason line), and unblocks:N is additive to the payload. Known simplification (transitive dependents regardless of claimability) is documented — right trade for Effort S. Merge follows.
