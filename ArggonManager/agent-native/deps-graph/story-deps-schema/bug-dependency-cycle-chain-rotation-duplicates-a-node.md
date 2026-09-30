---
type: bug
status: in_progress
id: bug-dependency-cycle-chain-rotation-duplicates-a-node
title: Cycle chain rotation duplicates a node
assignee: Arggon
branch: fix/bug-dependency-cycle-chain-rotation-duplicates-a-node
parent: story-deps-schema
labels: [testing, kernel, property-based]
priority: p2
created: "2026-09-29"
updated: "2026-09-30"
claimed_at: "2026-09-30T23:56:05.641Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-dependency-cycle-chain-rotation-duplicates-a-node
---
<!--
  Placement (v0): ArggonManager/agent-native/deps-graph/story-deps-schema/bug-dependency-cycle-chain-rotation-duplicates-a-node.md
  Leaves live only under a story. id is the filename stem: bug-dependency-cycle-chain-rotation-duplicates-a-node.
  CLI `arggon create bug dependency-cycle-chain-rotation-duplicates-a-node` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Cycle chain rotation duplicates a node

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-29 @Arggon
Found by the kernel property suite added in `task-fast-check-invariant-properties`
(`lib/src/validate.property.test.ts`): the canonical cycle rotation is applied to
the cycle array that ALREADY contains the closing node, so when the DFS enters a
cycle at a member that is not the lexicographically smallest, the reported chain
repeats a member and does not close — and the same cycle prints a DIFFERENT string
depending on the traversal order.

## Evidence

Same graph, same cycle `{task-gen-2, task-gen-6, task-gen-7}`, two generated
traversal orders of the `depends_on` edge lists:

```
DEPENDENCY_CYCLE …/task-gen-2.md dependency cycle: task-gen-2 -> task-gen-6 -> task-gen-6 -> task-gen-7
DEPENDENCY_CYCLE …/task-gen-2.md dependency cycle: task-gen-2 -> task-gen-6 -> task-gen-7 -> task-gen-7
```

Neither is a valid cycle chain: the first repeats `task-gen-6` and never closes,
the second repeats `task-gen-7` and never closes. The anchor IS canonical today
(smallest member first, issue path = that item's file); only the chain text is
wrong.

Minimal hand-built repro (3 leaves, `task-gen-0 -> task-gen-2`,
`task-gen-1 <-> task-gen-2`): the reported chain is
`task-gen-1 -> task-gen-2 -> task-gen-2 -> task-gen-3` for a 3-cycle entered at a
non-min member.

Replay: `ARGGON_PROPERTY_SEED=20260928 ARGGON_PROPERTY_RUNS=25 npm run test:property`
(the run log prints `dependency-cycle divergence across traversal orders: … printed
a different chain TEXT`). Minimized counterexample edge corpus:
`[[1,4],[2,6],[6,7],[4,5],[4,6],[3,6],[7,2],[1,7]]`.

## Root cause

`lib/src/validate.ts` → `checkDependencies`:

```ts
const cycle = [...stack.slice(stack.indexOf(dep)), dep]; // e.g. [2, 3, 1, 2] — already closed
const anchorId = cycle.reduce((a, b) => (a < b ? a : b));
const at = cycle.indexOf(anchorId);
const chain = [...cycle.slice(at), ...cycle.slice(0, at)]; // splits the CLOSING node in half
```

`cycle` ends with the repeated entry node, so the rotation splits that node across
the two halves and the result neither closes nor stays simple.

## Acceptance

- [ ] Rotate the SIMPLE cycle (drop the repeated closing node) and re-append the
      anchor, so the chain is `a -> b -> … -> a` with every member exactly once.
- [ ] Re-check the dedup key: it is built from the repeated-node multiset
      (`[...cycle].sort().join("\0")`); keep deduping on the simple member set so
      the "report each distinct cycle once" contract still holds.
- [ ] The message for a given cycle is byte-identical under every traversal order
      of the same graph (the property asserts this; today it is pinned as a known
      deviation).
- [ ] Example-based test: a 3-item cycle entered at a non-min member prints one
      canonical chain, and the existing `cli/src/deps.test.ts` cycle tests stay
      green.
- [ ] Delete the `isRotationWithOneDuplicate` canary in
      `lib/src/validate.property.test.ts` with the fix — it exists only to pin
      today's malformed shape.

## Related, weaker claim (decide separately, not in this fix)

For a graph with SEVERAL cycles, a DFS reports the back edges its own forest
closes, so the SET of cycles named can also differ between traversal orders (the
property counts this separately: "named a different cycle SET"). The
acyclic/cyclic VERDICT is order independent — a DFS finds a back edge iff the
digraph is cyclic — and that is what the property asserts unconditionally. Making
the reported cycle SET itself canonical is a stronger contract (report every
cycle, or canonicalize the whole cycle basis) and deserves its own item if wanted.
