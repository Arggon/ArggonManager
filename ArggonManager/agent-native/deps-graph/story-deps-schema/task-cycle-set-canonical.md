---
type: task
status: done
id: task-cycle-set-canonical
title: Canonicalize the reported dependency-cycle SET across traversal orders (or explicitly admit DFS-forest selection)
assignee: Arggon
branch: feat/task-cycle-set-canonical
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

- [x] Decide the contract explicitly: report every cycle, canonicalize a cycle basis, or document DFS-forest selection as the contract (convention/engineering note in the same PR).
- [x] The property admits ANY consistent selection over the same member set (k orientations, not just reversed) so soaks at 2000+ runs cannot spuriously fail; the per-cycle chain text stays byte-identical across traversal orders.
- [x] Ambiguous-set counterexamples pinned as fixtures: edge corpus [[0,7],[7,1],[3,2],[3,2],[5,7],[5,1],[1,1],[7,0]] (run 65 divergence) and the 4-member two-distinct-cycles graph above.
- [x] If validate output changes: fixtures + docs updated in the same PR; deps cycle tests stay green.

### 2026-10-01 @ses_f087fbfecffetE1W3D2QkOLuJX
## 2026-10-01 @Arggon — contract decision + gate evidence (PR to follow)

**Decision: DFS-forest selection is the contract** (recommended option taken). The acyclic/cyclic verdict and each per-cycle chain text are order independent (already asserted); which subset of a graph's cycles a single DFS names is its forest selection and is deliberately traversal-order dependent. Rationale: a canonical cycle basis would change validate output for every consumer (and error-table/docs) to fix a purely presentational ambiguity, while the verdict consumers act on is already stable. Documented normatively in docs/convention.md §Dependencies (v3), same PR. No product code change → no bundle regen (check:plugin green, no diff).

**Property fix:** the invariant-6 assertion no longer admits only the reversed orientation. For each observed member set it enumerates every simple directed cycle those generated edges realize over exactly that set (anchored at the smallest member) and requires every observed chain to be in that family — k orientations, not 2. `permutations()` helper is bounded (≤7! worst case).

**Fixtures (deterministic — brute-forced over all 40320 file-walk orders, so readdir order cannot flake them):**
1. run-65 corpus [[0,7],[7,1],[3,2],[3,2],[5,7],[5,1],[1,1],[7,0]]: only the 3 real cycles can ever be named; identity edge lists always name the {0,1,7} triangle; reversed edge list always names both 2-cycles; family containment per order; verdict + SELF_DEPENDENCY order independent.
2. 4-member graph {0->1,1->2,2->3,3->0,0->2,2->1,1->3}: member set {0,1,2,3} admits exactly two distinct cycles 0->1->2->3->0 and 0->2->1->3->0 — non-reverse. Identity edge list closes the first, rotated closes the second, in EVERY walk order → under the old reversed-only rule this corpus failed the property deterministically (product behavior was correct; the assertion was too narrow). This fixture is the regression pin.

**Gates (worktree ../ArggonManager-task-cycle-set-canonical, branch feat/task-cycle-set-canonical):**
- `ARGGON_PROPERTY_SEED=20261001 ARGGON_PROPERTY_RUNS=2000 npm run test:property` → 5 files / 14 tests passed; measured divergence counter: 150/2000 graphs named a different cycle SET — all green under the new admission.
- `npm test` → 112 files / 1982 tests passed. `npm run lint` → 0. `npm run build` → ok. `npm run check:plugin` → ok (bundle byte-identical). `npm run arggon -- validate` → ok (0 warnings, v5).

**Analysis artifacts:** /tmp/opencode/cycle-analysis2.mjs (faithful model of leaves()/checkDependencies incl. dedup + self-loop drop; permuted walk orders).

### handoff 2026-10-01 @ses_f087fbfecffetE1W3D2QkOLuJX (session: ses_f087fbfecffetE1W3D2QkOLuJX) — next: Review PR (DFS-forest contract + property admission + 2 fixtures); merge is the coordinator's call.
- branch: feat/task-cycle-set-canonical
- open questions: None blocking; canonical cycle-basis contract was rejected as out of proportion (see evidence comment).
- [ ] Decide the contract explicitly: report every cycle, canonicalize a cycle basis, or document DFS-forest selection as the contract (convention/engineering note in the same PR).
- [ ] The property admits ANY consistent selection over the same member set (k orientations, not just reversed) so soaks at 2000+ runs cannot spuriously fail; the per-cycle chain text stays byte-identical across traversal orders.
- [ ] Ambiguous-set counterexamples pinned as fixtures: edge corpus [[0,7],[7,1],[3,2],[3,2],[5,7],[5,1],[1,1],[7,0]] (run 65 divergence) and the 4-member two-distinct-cycles graph above.
- [ ] If validate output changes: fixtures + docs updated in the same PR; deps cycle tests stay green.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Final verdict: approve — reviewer pass complete with independent verification: the reviewer modeled checkDependencies and ran ALL 40320 walk orders, confirming the 4-member fixture deterministically fails the old reversed-only rule (real regression pin), no phantom admission in the widened family (bounded <=7!, anchored at the same reduce-based anchor the product computes), run-65 claims permutation-universal-true, convention.md paragraph clause-by-clause accurate vs the #506 code. Contract decision ENDORSED (DFS-forest selection documented; no product change). Merging after the stale-branch reconcile.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Merged: PR #528 squash -> main (reviewer independently verified all 40320 walk orders; property widened to k orientations, 2000-run soak green; convention.md carries the normative DFS-forest-selection paragraph). Item done.
