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
 *
 * DOCUMENTED DEVIATION (measured, not hidden): the chain ROTATION runs on the
 * stack slice that already contains the closing node, so a cycle entered at a
 * non-min member is printed with a member duplicated and a different traversal
 * of the same graph prints a different string — and, for a graph with several
 * cycles, a different traversal may close a different back edge and name a
 * different subset of them. Both are pinned/measured here and filed as
 * bug-dependency-cycle-chain-rotation-duplicates-a-node; the property still
 * asserts the load-bearing part unconditionally (the verdict, and that every
 * cycle named is real, anchored and deduped).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { newItemPath, TRACKER_DIR_NAME } from "./paths.js";
import { runValidate } from "./validate.js";
import { fc, checkProperty } from "../../test/property-runner.js";

const tmpDirs: string[] = [];

/** Generated graphs whose reported cycle set or chain text differed per order. */
let divergentCycleSets = 0;
let divergentChainTexts = 0;

afterAll(() => {
  if (divergentCycleSets > 0 || divergentChainTexts > 0) {
    console.log(
      `[property] dependency-cycle divergence across traversal orders: ` +
        `${divergentCycleSets} graph(s) named a different cycle SET, ` +
        `${divergentChainTexts} printed a different chain TEXT ` +
        `— see bug-dependency-cycle-chain-rotation-duplicates-a-node`,
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

/**
 * True when `nodes` is a rotation of `members` with ONE member repeated right
 * after itself — the exact shape today's rotation produces (the rotation is
 * applied to the stack slice that already contains the closing node, so a
 * member is duplicated and the chain no longer closes). Pinned for
 * bug-dependency-cycle-chain-rotation-duplicates-a-node; delete with the fix.
 */
function isRotationWithOneDuplicate(nodes: readonly string[], members: readonly string[]): boolean {
  if (nodes.length !== members.length + 1) return false;
  for (let start = 0; start < members.length; start++) {
    const rotation = [...members.slice(start), ...members.slice(0, start)];
    for (let at = 0; at < rotation.length; at++) {
      const candidate = [...rotation.slice(0, at + 1), rotation[at]!, ...rotation.slice(at + 1)];
      if (candidate.join(" -> ") === nodes.join(" -> ")) return true;
    }
  }
  return false;
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

describe("dependency graph (property)", () => {
  it("reports a real, canonically anchored cycle for a cyclic graph in every order", () => {
    checkProperty(
      "dependency cycles",
      fc.property(edgeCorpus, (edges) => {
        const items = leaves(edges, () => true);
        // Four traversal orders of the SAME graph: two edge-list orders and two
        // file-write orders. The DFS start order follows the file walk, which is
        // filesystem-dependent, so only the data-derived order is perturbed
        // deliberately — the write order is perturbed as well because it moves
        // the files in the directory.
        const orderings: Array<{ items: Item[]; write: number[] }> = [
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

        // (1) Every order completes and yields a message list …
        const reported = orderings.map((ordering) =>
          validateMessages(tmpDir("arggon-prop-deps-"), ordering.items, ordering.write),
        );
        // (3) COMPLETENESS: the ring guarantees a cycle, so every order must
        // report at least one — and (2) the verdict is order independent.
        for (const messages of reported) expect(cycleSets(messages).length).toBeGreaterThan(0);

        // Documented deviation: WHICH cycle is named, and how it is printed,
        // may differ per traversal order (see the file header + the bug).
        if (new Set(reported.map((messages) => cycleSets(messages).join("|"))).size > 1) {
          divergentCycleSets++;
        }
        if (new Set(reported.map((messages) => cycleChains(messages).join("|"))).size > 1) {
          divergentChainTexts++;
        }
        // Everything else is order independent: the non-cycle findings (unknown
        // ids, self-dependencies) are per item.
        const others = reported.map((messages) =>
          messages.filter((message) => !message.startsWith("DEPENDENCY_CYCLE")),
        );
        for (const messages of others) expect(messages).toEqual(others[0]!);

        const edgeSet = new Set<string>();
        for (const item of items)
          for (const dep of item.dependsOn ?? []) edgeSet.add(`${item.id}->${dep}`);

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
            // The chain SHAPE: a simple closed cycle (the contract), or today's
            // malformed rotation, pinned for the open bug. A third shape fails.
            if (isRotationWithOneDuplicate(nodes, members)) {
              expect(nodes.length).toBe(members.length + 1);
            } else {
              expect(nodes).toEqual([...members, members[0]!]);
            }
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
});
