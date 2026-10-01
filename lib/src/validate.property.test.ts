/**
 * Property: generated dependency graphs terminate, and the cycle VERDICT and
 * the reported cycles are canonical regardless of traversal order.
 *
 * The kernel under test is `validate.ts` (`runValidate` → `checkDependencies`),
 * the one dependency-graph pass the CLI, the MCP adapter and the native plugin
 * all read through. Properties complement the example-based `deps.test.ts`
 * suite (two-item cycle, three-item cycle, self-dependency, unknown id, clean
 * DAG), which stays authoritative for those concrete contracts.
 *
 * INVARIANTS (asserted per generated graph):
 *   1. TERMINATION: `runValidate` returns for every generated graph, including
 *      dense self-referential ones (the bounded node count keeps the pass
 *      linear, and the run is asserted to complete, not to be interrupted).
 *   2. THE VERDICT IS ORDER INDEPENDENT: "this graph has a cycle" holds for
 *      every traversal order (a DFS finds a back edge iff the digraph is
 *      cyclic, so the acyclic/cyclic verdict cannot depend on the walk).
 *   3. COMPLETENESS: a graph built with a guaranteed ring always reports at
 *      least one cycle; NO FALSE POSITIVES: a generated DAG reports no
 *      `DEPENDENCY_CYCLE` error — and, because the surrounding skeleton is a
 *      fully valid tree, no validate error at all.
 *   4. EVERY REPORTED CYCLE IS REAL: the cycle a message names is a closed walk
 *      over the generated edges (never a phantom), reported at most once, and a
 *      self-loop is never reported as a cycle (the same pass reports it once as
 *      `SELF_DEPENDENCY`).
 *   5. CANONICAL ANCHORING: each chain starts at the lexicographically smallest
 *      member of its own cycle and the issue is anchored on that item's file —
 *      what makes the reported path deterministic.
 *   6. CANONICAL CHAIN TEXT: each chain is the SIMPLE cycle (every member
 *      exactly once) rotated to its smallest member and closed on it, so a
 *      given cycle prints the byte-identical message under every traversal
 *      order. A member set can realize SEVERAL distinct directed cycles — a
 *      >=4-member set is not limited to two opposite orientations — so the
 *      assertion admits every orientation the generated edges realize over the
 *      observed member set (anchored at the set's smallest member, exactly the
 *      shapes the pass prints) and fails on anything outside that family.
 *
 * CONTRACT (task-cycle-set-canonical): for a graph with SEVERAL cycles, the
 * reported cycle SET is the single DFS's FOREST SELECTION — the back edges its
 * own forest closes, deduplicated by member set — and that selection is
 * deliberately traversal-order dependent. Only which cycles are NAMED varies:
 * the verdict is order independent (invariant 2) and each named cycle renders
 * byte-identically (invariant 6). Consumers must rely on the verdict and the
 * per-cycle chains, never on which cycles a report names (documented in
 * docs/convention.md §Dependencies (v3)). The two ambiguous-set
 * counterexamples — the run-65 divergence corpus and the 4-member
 * two-distinct-cycles graph — are pinned as deterministic fixtures below.
 *
 * MEASURED (not asserted): how often the generated graphs actually name a
 * different cycle SET across the traversal orders (counted per run and printed
 * at the end).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { newItemPath, TRACKER_DIR_NAME } from "./paths.js";
import { runValidate } from "./validate.js";
import { fc, checkProperty } from "../../test/property-runner.js";

const tmpDirs: string[] = [];

/** Generated graphs whose reported cycle set differed per traversal order. */
let divergentCycleSets = 0;

afterAll(() => {
  if (divergentCycleSets > 0) {
    console.log(
      `[property] dependency-cycle divergence across traversal orders: ` +
        `${divergentCycleSets} graph(s) named a different cycle SET — ` +
        `single-DFS forest selection, the documented contract ` +
        `(task-cycle-set-canonical): verdict and per-cycle chain text stay order independent`,
    );
  }
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tmpDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

type Item = { id: string; parent?: string; type: string; dependsOn?: string[] };

/** One valid v5 work item. */
function writeItem(path: string, item: Item): void {
  mkdirSync(dirname(path), { recursive: true });
  const lines = ["---", `type: ${item.type}`, "status: todo", `id: ${item.id}`];
  if (item.parent) lines.push(`parent: ${item.parent}`);
  lines.push("labels: []");
  const dependsOn = item.dependsOn ?? [];
  if (dependsOn.length > 0) lines.push(`depends_on: [${dependsOn.join(", ")}]`);
  lines.push('created: "2026-09-03"', 'updated: "2026-09-03"', "---", "", `# ${item.id}`, "");
  writeFileSync(path, lines.join("\n"), "utf8");
}

const CYCLE_PREFIX = "dependency cycle: ";
const STORY_RELPATH = `${TRACKER_DIR_NAME}/gen-init/gen-epic/gen-story`;

/**
 * Materialize one tracker for a generated graph under a given edge-list and
 * file-write order, and return the validate messages sorted (the report ORDER
 * follows the traversal; the CONTENT must not).
 */
function validateMessages(root: string, items: Item[], writeOrder: number[]): string[] {
  const tasksDir = join(root, TRACKER_DIR_NAME);
  mkdirSync(tasksDir, { recursive: true });
  writeFileSync(join(tasksDir, ".convention.yml"), "version: 5\n", "utf8");
  const initiative = newItemPath({ tasksDir, type: "initiative", id: "gen-init" });
  const epic = newItemPath({
    tasksDir,
    type: "epic",
    id: "gen-epic",
    parentContainerDir: dirname(initiative),
  });
  const story = newItemPath({
    tasksDir,
    type: "story",
    id: "gen-story",
    parentContainerDir: dirname(epic),
  });
  writeItem(initiative, { id: "gen-init", type: "initiative" });
  writeItem(epic, { id: "gen-epic", type: "epic", parent: "gen-init" });
  writeItem(story, { id: "gen-story", type: "story", parent: "gen-epic" });
  for (const index of writeOrder) {
    const item = items[index]!;
    writeItem(
      newItemPath({ tasksDir, type: "task", id: item.id, parentContainerDir: dirname(story) }),
      { id: item.id, type: "task", parent: "gen-story", dependsOn: item.dependsOn },
    );
  }
  const result = runValidate({ cwd: root });
  expect(result.layout).toBe("arggon-manager");
  return result.errors.map((issue) => `${issue.code} ${issue.path} ${issue.message}`).sort();
}

function cycleChains(messages: readonly string[]): string[] {
  return messages
    .filter((message) => message.startsWith("DEPENDENCY_CYCLE"))
    .map((message) => message.slice(message.indexOf(CYCLE_PREFIX) + CYCLE_PREFIX.length));
}

/** The cycles a report names, as sorted member sets: the canonical form. */
function cycleSets(messages: readonly string[]): string[] {
  return cycleChains(messages)
    .map((chain) => [...new Set(chain.split(" -> "))].sort().join(","))
    .sort();
}

const MAX_NODES = 8;
/** Leaf ids carry the `task-` prefix `checkItemShape` enforces. */
const taskId = (index: number): string => `task-gen-${index}`;
/** A guaranteed ring, so "this graph has a cycle" holds by construction. */
const RING: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
];

/** The generated leaves for one edge corpus. `keep` filters the edge pairs. */
function leaves(
  edges: ReadonlyArray<readonly [number, number]>,
  keep: (from: number, to: number) => boolean,
): Item[] {
  const chosen = [...edges, ...RING].filter(([from, to]) => keep(from, to));
  return Array.from({ length: MAX_NODES }, (_, index) => ({
    id: taskId(index),
    type: "task",
    dependsOn: [...new Set(chosen.filter(([from]) => from === index).map(([, to]) => taskId(to)))],
  }));
}

const edgeCorpus = fc.array(
  fc.tuple(fc.integer({ min: 0, max: MAX_NODES - 1 }), fc.integer({ min: 0, max: MAX_NODES - 1 })),
  { maxLength: 16 },
);

/** Rotation of an index list: a different file-write order for the same graph. */
function rotate(length: number, by: number): number[] {
  return Array.from({ length }, (_, index) => (index + by) % length);
}

/** Rotate each edge list: the same edge SET, a different DFS traversal order. */
function rotateEdges(items: Item[]): Item[] {
  return items.map((item) => {
    const dependsOn = item.dependsOn ?? [];
    return { ...item, dependsOn: [...dependsOn.slice(1), ...dependsOn.slice(0, 1)] };
  });
}

/** All orderings of a list (bounded: at most the 7 non-anchor members of a cycle set). */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let at = 0; at < items.length; at++) {
    const rest = [...items.slice(0, at), ...items.slice(at + 1)];
    for (const tail of permutations(rest)) out.push([items[at]!, ...tail]);
  }
  return out;
}

/**
 * The four traversal orders of the SAME graph: two edge-list orders (reversed,
 * rotated) and two file-write orders. The DFS start order follows the file
 * walk, which is filesystem-dependent, so only the data-derived order is
 * perturbed deliberately — the write order is perturbed as well because it
 * moves the files in the directory.
 */
function fourOrderings(items: Item[]): Array<{ items: Item[]; write: number[] }> {
  return [
    { items, write: rotate(MAX_NODES, 0) },
    {
      items: items.map((item) => ({
        ...item,
        dependsOn: [...(item.dependsOn ?? [])].reverse(),
      })),
      write: rotate(MAX_NODES, 0),
    },
    { items: rotateEdges(items), write: rotate(MAX_NODES, 1) },
    { items, write: rotate(MAX_NODES, 1) },
  ];
}

/** Every reported chain is a real closed walk over the edges (no phantoms). */
function expectRealCycles(messages: readonly string[], edgeSet: ReadonlySet<string>): void {
  for (const chain of cycleChains(messages)) {
    const members = [...new Set(chain.split(" -> "))];
    for (let at = 0; at < members.length; at++) {
      expect(
        edgeSet.has(`${members[at]}->${members[(at + 1) % members.length]}`),
        `not a real closed walk over the generated edges: ${chain}`,
      ).toBe(true);
    }
  }
}

describe("dependency graph (property)", () => {
  it("reports a real, canonically anchored cycle for a cyclic graph in every order", () => {
    checkProperty(
      "dependency cycles",
      fc.property(edgeCorpus, (edges) => {
        const items = leaves(edges, () => true);
        const orderings = fourOrderings(items);

        // (1) Every order completes and yields a message list …
        const reported = orderings.map((ordering) =>
          validateMessages(tmpDir("arggon-prop-deps-"), ordering.items, ordering.write),
        );
        // (3) COMPLETENESS: the ring guarantees a cycle, so every order must
        // report at least one — and (2) the verdict is order independent.
        for (const messages of reported) expect(cycleSets(messages).length).toBeGreaterThan(0);

        // The edge set under test: also the realness oracle for (4) below.
        const edgeSet = new Set<string>();
        for (const item of items)
          for (const dep of item.dependsOn ?? []) edgeSet.add(`${item.id}->${dep}`);

        // (6) CANONICAL CHAIN TEXT, hard assertion: a given cycle prints the
        // byte-identical chain under every traversal order, and every chain
        // named for a member set is one of the SIMPLE directed cycles those
        // edges realize over exactly that set, anchored at its smallest
        // member. A member set can carry SEVERAL distinct directed cycles (a
        // >=4-member set is not limited to two opposite orientations — the
        // 4-member fixture below names two non-reverse ones), so the
        // admissible family is every realizable orientation, not just the
        // reversed one (task-cycle-set-canonical): admitting only the reverse
        // let elevated-run soaks fail the PROPERTY on graphs whose product
        // behavior was exactly as specified.
        const textBySet = new Map<string, Set<string>>();
        for (const messages of reported) {
          for (const chain of cycleChains(messages)) {
            const setKey = [...new Set(chain.split(" -> "))].sort().join(",");
            const texts = textBySet.get(setKey) ?? new Set<string>();
            texts.add(chain);
            textBySet.set(setKey, texts);
          }
        }
        for (const [setKey, texts] of textBySet) {
          const members = setKey.split(",");
          const anchor = members[0]!;
          const admissible = new Set<string>();
          for (const permutation of permutations(members.slice(1))) {
            const walk = [anchor, ...permutation];
            const closed = walk.every((node, at) =>
              edgeSet.has(`${node}->${walk[(at + 1) % walk.length]}`),
            );
            if (closed) admissible.add([...walk, anchor].join(" -> "));
          }
          for (const chain of texts) {
            expect(
              admissible.has(chain),
              `chain text is not a real simple cycle over its member set: ${chain} ` +
                `(admissible: ${[...admissible].join(" | ")})`,
            ).toBe(true);
          }
        }
        // The guaranteed ring pins the VERDICT (above), not a named chain:
        // WHICH cycle a DFS closes is its forest selection — the documented
        // contract (header) — so no specific chain is required to appear in
        // every order.

        // Measured deviation: WHICH cycle is named may differ per traversal
        // order (single-DFS cycle selection; see the file header).
        if (new Set(reported.map((messages) => cycleSets(messages).join("|"))).size > 1) {
          divergentCycleSets++;
        }
        // Everything else is order independent: the non-cycle findings (unknown
        // ids, self-dependencies) are per item.
        const others = reported.map((messages) =>
          messages.filter((message) => !message.startsWith("DEPENDENCY_CYCLE")),
        );
        for (const messages of others) expect(messages).toEqual(others[0]!);

        for (const messages of reported) {
          const sets = cycleSets(messages);
          // (4) Each cycle is reported at most once (the pass dedups on the
          // canonical member set).
          expect(new Set(sets).size).toBe(sets.length);
          for (const chain of cycleChains(messages)) {
            const nodes = chain.split(" -> ");
            const members = [...new Set(nodes)];
            expect(members.length).toBeGreaterThan(1);
            // (5) Canonical anchoring: the chain starts at its smallest member.
            expect(members[0]).toBe([...members].sort()[0]);
            // (4) The cycle is a real closed walk over the generated edges.
            for (let at = 0; at < members.length; at++) {
              expect(edgeSet.has(`${members[at]}->${members[(at + 1) % members.length]}`)).toBe(
                true,
              );
            }
            // (5) The issue is anchored on that item's file.
            expect(
              messages.some(
                (message) =>
                  message.startsWith("DEPENDENCY_CYCLE") &&
                  message.includes(`${STORY_RELPATH}/${members[0]}.md`) &&
                  message.includes(`${CYCLE_PREFIX}${chain}`),
              ),
            ).toBe(true);
            // The chain SHAPE (hard, the canary for the old malformed rotation
            // is gone with the fix): a simple closed cycle — every member
            // exactly once, closing back on the anchor.
            expect(nodes).toEqual([...members, members[0]!]);
          }
          // (4) A self-loop is reported once as SELF_DEPENDENCY, never as a cycle.
          for (const message of messages) {
            if (!message.startsWith("SELF_DEPENDENCY")) continue;
            const id = message.slice(message.indexOf("item '") + "item '".length).split("'")[0]!;
            expect(cycleChains(messages)).not.toContain(`${id} -> ${id}`);
          }
        }
      }),
    );
  });

  it("never reports a cycle for a generated DAG", () => {
    checkProperty(
      "dependency acyclic",
      fc.property(edgeCorpus, (edges) => {
        // Strictly backward edges (the ring collapses to its backward half): a
        // DAG by construction, whatever the corpus.
        const items = leaves(edges, (from, to) => to < from);
        // (3) NO FALSE POSITIVES: a DAG plus a valid skeleton must be completely
        // clean — a single reported issue here would be a false positive.
        expect(validateMessages(tmpDir("arggon-prop-dag-"), items, rotate(MAX_NODES, 0))).toEqual(
          [],
        );
      }),
    );
  });

  // task-cycle-set-canonical fixture (the run-65 divergence corpus): a graph
  // with SEVERAL cycles whose named SET moves with the traversal order.
  // Brute-forced over every possible file-walk order: only the three real
  // cycles below can ever be named; the identity edge lists always name the
  // {0,1,7} triangle, while the reversed edge list always names both 2-cycles
  // (the rotated list may close the triangle on top) — different orders
  // provably emphasize different cycles of the same graph.
  it("pins the run-65 corpus: the named SET moves inside the real-cycle family, spine stays", () => {
    const edges: ReadonlyArray<readonly [number, number]> = [
      [0, 7],
      [7, 1],
      [3, 2],
      [3, 2],
      [5, 7],
      [5, 1],
      [1, 1],
      [7, 0],
    ];
    const items = leaves(edges, () => true);
    const reported = fourOrderings(items).map((ordering) =>
      validateMessages(tmpDir("arggon-fix-run65-"), ordering.items, ordering.write),
    );

    // The verdict and the non-cycle findings (the corpus's 1 -> 1 self-loop)
    // are order independent …
    for (const messages of reported) {
      expect(cycleSets(messages).length).toBeGreaterThan(0);
      expect(messages.some((message) => message.startsWith("SELF_DEPENDENCY"))).toBe(true);
    }
    const others = reported.map((messages) =>
      messages.filter((message) => !message.startsWith("DEPENDENCY_CYCLE")),
    );
    for (const messages of others) expect(messages).toEqual(others[0]!);

    // … the triangle {0,1,7} is named by both identity edge lists in every
    // walk order, and the reversed edge list always names both 2-cycles — so
    // different orders provably emphasize different cycles …
    const triangle = "task-gen-0 -> task-gen-7 -> task-gen-1 -> task-gen-0";
    const twoCycle01 = "task-gen-0 -> task-gen-1 -> task-gen-0";
    const twoCycle07 = "task-gen-0 -> task-gen-7 -> task-gen-0";
    for (const [at, messages] of reported.entries()) {
      if (at === 1 || at === 2) continue; // reversed/rotated edge lists
      expect(cycleChains(messages), `order ${at} lost the triangle spine`).toContain(triangle);
    }
    expect(cycleChains(reported[1]!)).toContain(twoCycle01);
    expect(cycleChains(reported[1]!)).toContain(twoCycle07);

    // … and whatever each order names stays inside the corpus's real-cycle
    // family — selection varies, the cycles never stop being real.
    const family = new Set([triangle, twoCycle01, twoCycle07]);
    const edgeSet = new Set<string>();
    for (const item of items)
      for (const dep of item.dependsOn ?? []) edgeSet.add(`${item.id}->${dep}`);
    for (const messages of reported) {
      expectRealCycles(messages, edgeSet);
      for (const chain of cycleChains(messages)) {
        expect(family.has(chain), `unexpected selection outside the corpus family: ${chain}`).toBe(
          true,
        );
      }
    }
  });

  // task-cycle-set-canonical fixture: a 4-member cycle set carrying TWO
  // distinct directed cycles that are NOT reverses of each other. Brute-forced
  // over every possible file-walk order: the identity edge list closes
  // 0->1->2->3->0 and the rotated edge list closes 0->2->1->3->0 in EVERY walk
  // order, so one member set legitimately prints two non-reverse orientations —
  // exactly the shape the previous reversed-only chain-text assertion rejected,
  // which made elevated property soaks fail on correct product behavior.
  it("pins the 4-member corpus: one member set admits two non-reverse orientations", () => {
    const edges: ReadonlyArray<readonly [number, number]> = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2],
      [2, 1],
      [1, 3],
    ];
    const items = leaves(edges, () => true);
    const orderings = fourOrderings(items).map((ordering) =>
      validateMessages(tmpDir("arggon-fix-four-"), ordering.items, ordering.write),
    );
    const [identity, , rotated] = orderings;

    const first = "task-gen-0 -> task-gen-1 -> task-gen-2 -> task-gen-3 -> task-gen-0";
    const second = "task-gen-0 -> task-gen-2 -> task-gen-1 -> task-gen-3 -> task-gen-0";
    expect(cycleChains(identity!)).toContain(first);
    expect(cycleChains(identity!)).not.toContain(second);
    expect(cycleChains(rotated!)).toContain(second);
    expect(cycleChains(rotated!)).not.toContain(first);

    // Both chains cover ONE member set and neither is the other's reverse:
    // the set admits k = 2 distinct orientations (enumerating every simple
    // cycle over {0,1,2,3} yields exactly these two), so admitting only the
    // reversed orientation is structurally too narrow.
    const setOf = (chain: string): string => [...new Set(chain.split(" -> "))].sort().join(",");
    expect(setOf(first)).toBe(setOf(second));
    const firstWalk = first.split(" -> ");
    const reverseOfFirst = [firstWalk[0]!, ...firstWalk.slice(1, -1).reverse(), firstWalk[0]!].join(
      " -> ",
    );
    expect(second).not.toBe(reverseOfFirst);

    const edgeSet = new Set<string>();
    for (const item of items)
      for (const dep of item.dependsOn ?? []) edgeSet.add(`${item.id}->${dep}`);
    for (const messages of [identity, rotated]) {
      expect(messages).toBeDefined();
      expectRealCycles(messages!, edgeSet);
    }
  });
});
