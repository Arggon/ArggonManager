---
type: bug
status: todo
id: bug-dependency-cycle-chain-rotation-duplicates-a-node
title: Cycle chain rotation duplicates a node
parent: story-deps-schema
labels: [testing, kernel, property-based]
priority: p2
created: "2026-09-29"
updated: "2026-09-29"
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

### 2026-10-01 @ses_f0b410d35ffe26SgXzzzBBraX4
Fixed on fix/bug-dependency-cycle-chain-rotation-duplicates-a-node — PR #506 (open, not merged).

Root cause + fix: the rotation ran on the closed walk (stack slice + repeated `dep`), so a cycle entered at a non-min member split its entry node across the rotation halves (dup + never closes). Now the SIMPLE cycle (the slice itself) is rotated to its smallest member and the anchor is re-appended: `[...cycle.slice(at), ...cycle.slice(0, at), anchorId]`. Dedup key moved from the entry-dependent multiset to the sorted simple member set. Property: chain text flipped from measured deviation to hard invariant (byte-identical per cycle across 4 traversal orders; only a reversed orientation of an ambiguous member set is admitted — cycle SELECTION stays measured, out of scope). `isRotationWithOneDuplicate` canary deleted; shape assertion now unconditional. Example test added: 3-cycle entered at non-min member prints exactly `task-b -> task-c -> task-d -> task-b` anchored at task-b.md.

Evidence:
- Gates: npm test 109 files / 1937 tests green; lint, build, check:plugin (bundle regen committed separately), tracker validate ok:true.
- Property replay: ARGGON_PROPERTY_SEED=20260928 ARGGON_PROPERTY_RUNS=25 npm run test:property → 5 files / 12 tests green; soaks at 500 and 2000 runs green.
- Smoke fixture (/tmp/opencode/cycle-smoke, 4 tasks, cycle {b,c,d} entered at c via a->c): validate --json from source AND dist both print "DEPENDENCY_CYCLE …/task-b.md | dependency cycle: task-b -> task-c -> task-d -> task-b" (pre-fix shape would be "task-b -> task-c -> task-c -> task-d").
- Lesson recorded: a first-draft hard assertion "the guaranteed ring chain appears in every order" was DISPROVEN by soak counterexample [[0,7],[7,1],[3,2],[3,2],[5,7],[5,1],[1,1],[7,0]] (seed 20260928, run 65/500) — which cycle a DFS names is selection, not text canonicalization; that assertion was dropped, textBySet kept.

Finding for the coordinator: the remaining measured divergence (different traversal orders name a different SUBSET of cycles for multi-cycle graphs; the soak counter fires regularly) is real and now only counted/logged. Recommend filing it as its own item under story-deps-schema if canonical cycle reporting is wanted — deliberately not attempted here per scope.

### handoff 2026-10-01 @ses_f0b410d35ffe26SgXzzzBBraX4 (session: ses_f0b410d35ffe26SgXzzzBBraX4) — next: Review + merge PR #506 (fix + property hardening + example test + regen bundle); item goes done on merge.
- branch: main
- open questions: File a follow-up item for canonical cycle-SET reporting across traversal orders?
