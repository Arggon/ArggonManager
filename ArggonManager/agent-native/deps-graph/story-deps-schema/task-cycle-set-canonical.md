---
type: task
status: todo
id: task-cycle-set-canonical
title: Canonicalize the reported dependency-cycle SET across traversal orders (or explicitly admit DFS-forest selection)
parent: story-deps-schema
labels: [kernel, property-based]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/deps-graph/story-deps-schema/task-cycle-set-canonical.md
  Leaves live only under a story. id is the filename stem: task-cycle-set-canonical.
  CLI `arggon create task cycle-set-canonical` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Canonicalize the reported dependency-cycle SET across traversal orders (or explicitly admit DFS-forest selection)

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the PR #506 review (bug-dependency-cycle-chain-rotation-duplicates-a-node — chain TEXT canonicalization is done there; this item is the remaining, weaker claim).

## Context
For a graph with SEVERAL cycles, a DFS reports the back edges its own forest closes, so the SET of cycles named can differ between traversal orders (the property measures this separately as "named a different cycle SET"). The acyclic/cyclic VERDICT is order independent; only the reported selection varies. Additionally, the text-identity property added in PR #506 admits only the REVERSED orientation for a member set that admits two opposite directed cycles — a >=4-member set can carry >2 distinct directed cycles (e.g. edges {a->b, b->c, c->d, d->a, a->c, c->b, b->d} yields a->b->c->d->a and a->c->b->d->a, non-reverse), so elevated ARGGON_PROPERTY_RUNS could spuriously fail the PROPERTY (never the product).

## Acceptance
- [ ] Decide the contract explicitly: report every cycle, canonicalize a cycle basis, or document DFS-forest selection as the contract (convention/engineering note in the same PR).
- [ ] The property admits ANY consistent selection over the same member set (k orientations, not just reversed) so soaks at 2000+ runs cannot spuriously fail; the per-cycle chain text stays byte-identical across traversal orders.
- [ ] Ambiguous-set counterexamples pinned as fixtures: edge corpus [[0,7],[7,1],[3,2],[3,2],[5,7],[5,1],[1,1],[7,0]] (run 65 divergence) and the 4-member two-distinct-cycles graph above.
- [ ] If validate output changes: fixtures + docs updated in the same PR; deps cycle tests stay green.
