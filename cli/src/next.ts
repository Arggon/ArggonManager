import { isClaimable } from "./status.js";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";

export type NextOptions = {
  cwd: string;
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
};

export type NextResult = {
  root: string;
  suggestion: NextSuggestion | null;
};

/**
 * Suggest the next claimable item: claimable type (story/task/bug) in
 * `todo` with no assignee, lexicographic by id. Skips claimed items
 * (in_progress + assignee — including other owners'), non-claimable
 * types, and non-todo statuses. Pure data; the CLI prints.
 */
export function runNext(opts: NextOptions): NextResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const items = loadItems(tasksDir);
  const byId = itemsById(items);

  const pool = items
    .filter(
      (item) =>
        isClaimable(item.type) && item.status === "todo" && (item.assignee ?? null) === null,
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

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
  const reason =
    `unclaimed todo ${item.type}${where}; lowest id among ${pool.length} candidate(s) ` +
    `(skipped claimed, non-claimable, and non-todo items)`;

  return {
    root,
    suggestion: { item, parentChain, parentChainDisplay, reason, poolSize: pool.length },
  };
}
