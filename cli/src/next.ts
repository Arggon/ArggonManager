import { isClaimable } from "./status.js";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { buildBlockedByIndex } from "./filter.js";

export type NextOptions = {
  cwd: string;
  /** Limit the candidate pool to ready items (all depends_on terminal). */
  ready?: boolean;
};

export type NextSuggestion = {
  /** The suggested kernel item. */
  item: WorkItem;
  /** Parent chain root-first (ids). */
  parentChain: string[];
  /** Human-readable chain with titles (`id (title)`). */
  parentChainDisplay: string[];
  /** Why this item was chosen. */
  reason: string;
  /** Candidates in the pool (for the reason count). */
  poolSize: number;
  /**
   * Open (non-terminal) dependency ids of the suggested item — additive
   * per spec-deps-001 §5. Empty when the item is ready. Dependencies are
   * advisory: this never gates an update, it only explains the ranking.
   */
  blockedBy: string[];
  /**
   * Additive (v0): transitive downstream weight of the suggested item — the
   * number of items that list it (directly or transitively) in depends_on
   * and would therefore become claimable once it completes. 0 when nothing
   * depends on it. Cycle-safe.
   */
  unblocks: number;
};

export type NextResult = {
  root: string;
  suggestion: NextSuggestion | null;
};

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["done", "cancelled"]);

/**
 * Ids in `item.depends_on` that are not terminal (`done`/`cancelled`).
 * Unknown dep ids count as open (validate flags them separately as
 * UNKNOWN_DEPENDENCY). Pure.
 */
export function openDependencies(
  item: Pick<WorkItem, "dependsOn">,
  byId: ReadonlyMap<string, Pick<WorkItem, "status">>,
): string[] {
  return item.dependsOn.filter((depId) => {
    const dep = byId.get(depId);
    return !dep || !TERMINAL_STATUSES.has(dep.status);
  });
}

/**
 * Ready = unclaimed claimable todo whose depends_on are all terminal.
 * Readiness only ever gates suggestions and queries — never `update`.
 */
export function isReady(
  item: Pick<WorkItem, "dependsOn" | "status" | "type" | "assignee">,
  byId: ReadonlyMap<string, Pick<WorkItem, "status">>,
): boolean {
  return openDependencies(item, byId).length === 0;
}

/**
 * Transitive downstream weight: how many items become claimable/ready once
 * `id` completes — i.e. the size of the transitive dependents closure in
 * the inverse depends_on graph. Cycle-safe (visited set); pure.
 */
export function downstreamWeight(
  id: string,
  blockedByIndex: ReadonlyMap<string, readonly string[]>,
): number {
  const seen = new Set<string>([id]);
  const stack = [id];
  let count = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const dependent of blockedByIndex.get(current) ?? []) {
      if (seen.has(dependent)) continue;
      seen.add(dependent);
      count += 1;
      stack.push(dependent);
    }
  }
  return count;
}

/**
 * Suggest the next claimable item: claimable type (story/task/bug) in
 * `todo` with no assignee. Ready items (all depends_on terminal) rank
 * first; among ready candidates, higher downstream weight wins — the
 * number of items that become claimable transitively once the item
 * completes (deepest/loaded subtrees first) — with the existing
 * lexicographic id order as the deterministic tie-break. Blocked items
 * (suggested only when nothing is ready) keep the lexicographic order.
 * With `--ready` the pool is limited to ready items only. Skips claimed
 * items (in_progress + assignee — including other owners'), non-claimable
 * types, and non-todo statuses. Pure data; the CLI prints.
 */
export function runNext(opts: NextOptions): NextResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const items = loadItems(tasksDir);
  const byId = itemsById(items);
  const blockedByIndex = buildBlockedByIndex(items);

  const lexicographic = (a: WorkItem, b: WorkItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const todos = items
    .filter(
      (item) =>
        isClaimable(item.type) && item.status === "todo" && (item.assignee ?? null) === null,
    )
    .sort(lexicographic);
  const ready = todos.filter((item) => openDependencies(item, byId).length === 0);
  const blocked = todos.filter((item) => openDependencies(item, byId).length > 0);
  // Rank ready candidates by downstream weight (desc); ties fall back to
  // the existing lexicographic order — deterministic.
  const rankedReady = ready
    .map((item) => ({ item, weight: downstreamWeight(item.id, blockedByIndex) }))
    .sort((a, b) => b.weight - a.weight || lexicographic(a.item, b.item))
    .map((entry) => entry.item);
  const pool = opts.ready ? rankedReady : [...rankedReady, ...blocked];

  if (pool.length === 0) return { root, suggestion: null };

  const item = pool[0]!;
  const chain: WorkItem[] = [];
  const seen = new Set<string>([item.id]);
  let parentId = item.parent ?? null;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    chain.unshift(parent);
    parentId = parent.parent ?? null;
  }
  const parentChain = chain.map((p) => p.id);
  const parentChainDisplay = chain.map((p) => `${p.id} (${p.title ?? p.id})`);
  const where = parentChainDisplay.length > 0 ? ` under ${parentChainDisplay.join(" > ")}` : "";
  const blockedBy = openDependencies(item, byId);
  const unblocks = downstreamWeight(item.id, blockedByIndex);
  const blockedNote =
    blockedBy.length > 0
      ? `no ready candidate ranks above it; blocked by ${blockedBy.join(", ")} (open dependencies); `
      : "";
  const weightNote =
    blockedBy.length === 0 && unblocks > 0
      ? `unblocks ${unblocks} item${unblocks === 1 ? "" : "s"} downstream; `
      : "";
  const readyNote = opts.ready
    ? `; --ready limits the pool to items whose depends_on are all terminal`
    : "";
  const reason =
    `unclaimed todo ${item.type}${where}; ${weightNote}${blockedNote}` +
    `highest downstream weight first among ${pool.length} candidate(s), lexicographic id on ties ` +
    `(skipped claimed, non-claimable, and non-todo items${readyNote})`;

  return {
    root,
    suggestion: {
      item,
      parentChain,
      parentChainDisplay,
      reason,
      poolSize: pool.length,
      blockedBy,
      unblocks,
    },
  };
}
