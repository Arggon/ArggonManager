/**
 * Shared board view-model (story-ui-foundation, task-ui-shared-viewmodel).
 *
 * The three board surfaces — the static/served HTML board (`cli/src/board.ts`),
 * the terminal kanban (`cli/src/tui.ts`) and the OpenCode panel
 * (`opencode/plugins/arggon/board.ts`) — render the same derived data: id
 * ordering, dependency-blocked marks, column counts, grouping and the parent
 * tree flattening. Those derivations used to be implemented once per surface
 * (the exploration-ui-improvements-012 "Foundation gaps" finding); this module
 * is the single source so the surfaces cannot drift as the v2 features
 * (filters, lenses, sorting, detail views) land.
 *
 * Contract:
 *
 * - **Pure and bounded (ADR 0006 spirit):** every function takes already-loaded
 *   item arrays. Nothing here reads files, spawns processes, throws for data it
 *   was not asked to validate, or mutates its inputs (`sort*`/`groupItemsBy`
 *   copy). A render loop that reuses a lookup builds it once with
 *   `buildStatusIndex` and passes it in.
 * - **Kernel-first:** the rules come from their kernel modules —
 *   `openDependencies`/`isReady` (dependency and readiness semantics),
 *   `isClaimable` (claimable types), `priorityRank` (ADR 0009 ordering) and
 *   `parseFilter`/`matchesPredicate` (the filter language). This module never
 *   restates them.
 * - **Shape-light:** each function binds only the fields it reads, so the
 *   kernel `WorkItem`, the JSON-contract `WorkItem` (snake-case `depends_on`)
 *   and the panel's `BoardItem` can all consume it. Functions that read
 *   dependencies take the id list explicitly (`openDependencyIds`,
 *   `hasOpenDependencies`); `applyViewLens`/`readyTodoCount` take the item and
 *   accept either dependency field (`dependsOn` ?? `depends_on`, see
 *   `ViewItem`), so a contract-shaped caller cannot silently lose the
 *   `depends-on:`/`blocked-by:` predicates or the `ready` lens.
 * - **No printing, no I/O, no new dependencies.**
 *
 * Purity and the derived results are pinned by `lib/src/view-model.test.ts`;
 * the surfaces' own suites (`cli/src/board.test.ts`, `cli/src/tui.test.ts`,
 * `opencode/plugins/arggon/board.test.ts`) pin that consuming this module is
 * behavior-preserving.
 */
import {
  buildAncestorIndex,
  buildBlockedByIndex,
  matchesPredicate,
  parseFilter,
} from "./filter.js";
import type { ItemType } from "./ids.js";
import { isReady, openDependencies } from "./next.js";
import { isPriority, priorityRank } from "./priority.js";
import { isClaimable, STATUSES, type Status } from "./status.js";

/**
 * Id → status lookup the dependency and readiness rules consume
 * (`openDependencies`/`isReady` take exactly this shape). Pure.
 */
export function buildStatusIndex<T extends { id: string; status: Status }>(
  items: readonly T[],
): Map<string, { status: Status }> {
  return new Map(
    items.map((item): [string, { status: Status }] => [item.id, { status: item.status }]),
  );
}

/**
 * Open (non-terminal) dependency ids of one item, in declaration order:
 * a dependency is open when it is not `done`/`cancelled`, and an unknown id
 * counts as open (validate reports it as `UNKNOWN_DEPENDENCY`). Thin composition
 * of the kernel rule, taking the id list so both `depends_on` (contract items)
 * and `dependsOn` (kernel/panel items) callers share one derivation. Pure.
 */
export function openDependencyIds(
  dependsOn: readonly string[],
  byId: ReadonlyMap<string, { status: Status }>,
): string[] {
  return openDependencies({ dependsOn: [...dependsOn] }, byId);
}

/** True when the item has at least one open dependency (see `openDependencyIds`). */
export function hasOpenDependencies(
  dependsOn: readonly string[],
  byId: ReadonlyMap<string, { status: Status }>,
): boolean {
  return openDependencyIds(dependsOn, byId).length > 0;
}

/** Lexicographic id order (the canonical item order every surface renders). Pure; copies. */
export function sortById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Priority tier for display ordering (ADR 0009): `p0` best … `p3`; an unset
 * priority — and any hand-edited invalid token, which validate flags as
 * `PRIORITY_INVALID` — orders with the `p3` tier, exactly like `next` ranks
 * its pool. Ties are resolved by id (`sortByPriority`). Pure.
 */
export function priorityTier(priority: string | null | undefined): number {
  return priority !== null && priority !== undefined && isPriority(priority)
    ? priorityRank(priority)
    : priorityRank("p3");
}

/** Priority-major order (ADR 0009), lexicographic id on ties. Pure; copies. */
export function sortByPriority<T extends { id: string; priority?: string | null }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      priorityTier(a.priority) - priorityTier(b.priority) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Case-insensitive substring match on id or title (empty filter matches all). Pure. */
export function matchesSubstringFilter(
  item: { id: string; title?: string | null },
  filter: string,
): boolean {
  if (filter === "") return true;
  const needle = filter.toLowerCase();
  return (
    item.id.toLowerCase().includes(needle) || (item.title ?? "").toLowerCase().includes(needle)
  );
}

/** Id-sorted, substring-filtered items (the cards a surface renders). Pure; copies. */
export function visibleItems<T extends { id: string; title?: string | null }>(
  items: readonly T[],
  filter: string,
): T[] {
  return sortById(items).filter((item) => matchesSubstringFilter(item, filter));
}

/** Visible items of one column/status, in id order. Pure; copies. */
export function itemsForStatus<T extends { id: string; title?: string | null; status: string }>(
  items: readonly T[],
  filter: string,
  status: string,
): T[] {
  return visibleItems(items, filter).filter((item) => item.status === status);
}

/** Item counts per status, every v0 status present (zero-filled). Pure. */
export function statusCounts<T extends { status: Status }>(
  items: readonly T[],
): Record<Status, number> {
  const counts = {} as Record<Status, number>;
  for (const status of STATUSES) counts[status] = 0;
  for (const item of items) counts[item.status] += 1;
  return counts;
}

/** One group of items: `key === null` is the "no group" bucket. */
export type ViewGroup<T> = { key: string | null; items: T[] };

/**
 * Bucket items by a key function, preserving input order inside each bucket
 * (`itemsForStatus`/`sortById` already ordered them). Keyed groups render in
 * ascending key order, the `null` ("no group") bucket last and only when at
 * least one keyed group exists — a fully key-less selection stays a single
 * unlabeled bucket, so a surface renders it exactly like an ungrouped list.
 * Pure; no key is ever invented.
 */
export function groupItemsBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string | null,
): Array<ViewGroup<T>> {
  const byKey = new Map<string | null, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(item);
    else byKey.set(key, [item]);
  }
  const keyed = [...byKey.keys()]
    .filter((key): key is string => key !== null)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((key) => ({ key, items: byKey.get(key)! }));
  const bare = byKey.get(null);
  if (!bare) return keyed;
  if (keyed.length === 0) return [{ key: null, items: bare }];
  return [...keyed, { key: null, items: bare }];
}

/** One flattened tree entry: the item plus its nesting depth. */
export type ViewTreeEntry<T> = { item: T; depth: number };

/**
 * Depth-first, id-sorted flattening of the parent tree. Roots are items whose
 * parent is absent/blank/unknown (a malformed tree renders as roots instead of
 * disappearing); a visited set makes the walk total, so a parent cycle whose
 * members never reach a root renders afterwards as roots rather than being
 * lost. Pure; copies (it sorts the buckets it builds, never the input).
 */
export function treeEntries<T extends { id: string; parent?: string | null }>(
  items: readonly T[],
): Array<ViewTreeEntry<T>> {
  const known = new Set(items.map((item) => item.id));
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const item of items) {
    const parent = item.parent ?? null;
    if (parent === null || parent === "" || !known.has(parent)) {
      roots.push(item);
      continue;
    }
    const bucket = children.get(parent) ?? [];
    bucket.push(item);
    children.set(parent, bucket);
  }
  const byId = (a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  roots.sort(byId);
  for (const bucket of children.values()) bucket.sort(byId);

  const entries: Array<ViewTreeEntry<T>> = [];
  const visited = new Set<string>();
  const walk = (item: T, depth: number): void => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    entries.push({ item, depth });
    for (const child of children.get(item.id) ?? []) walk(child, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  for (const item of [...items].sort(byId)) {
    if (!visited.has(item.id)) walk(item, 0);
  }
  return entries;
}

/**
 * Dependency ids of one item in either accepted shape: the kernel `dependsOn`
 * field, falling back to the JSON-contract alias `depends_on` only when that
 * field is absent. The precedence is deliberate — a kernel item carrying an
 * empty `dependsOn` means "no dependencies" and never falls through to the
 * alias. Always a fresh array. Module-private by design: the accepted shape is
 * the contract (`ViewItem`), not this accessor.
 */
function viewItemDependencies(item: {
  dependsOn?: readonly string[];
  depends_on?: readonly string[];
}): string[] {
  return [...(item.dependsOn ?? item.depends_on ?? [])];
}

/**
 * Count of claimable, unclaimed `todo` items whose dependencies are all
 * terminal — the kernel composition (`isClaimable` + `isReady`) the native
 * panel surfaces as "N ready". An absent dependency field means no
 * dependencies; both the kernel `dependsOn` and the JSON-contract `depends_on`
 * are accepted (see `ViewItem`). Pure.
 */
export function readyTodoCount<
  T extends {
    id: string;
    type: ItemType;
    status: Status;
    assignee?: string | null;
    dependsOn?: string[];
    depends_on?: string[];
  },
>(items: readonly T[]): number {
  const byId = buildStatusIndex(items);
  return items.filter(
    (item) =>
      isClaimable(item.type) &&
      item.status === "todo" &&
      (item.assignee ?? null) === null &&
      isReady({ ...item, dependsOn: viewItemDependencies(item) }, byId),
  ).length;
}

/**
 * Item shape the lens reads: the kernel `WorkItem` and the JSON-contract
 * `WorkItem` both satisfy it. Dependencies are accepted in either shape —
 * kernel `dependsOn` or JSON-contract `depends_on`, with `dependsOn` winning
 * when an item carries both — so passing contract-shaped items cannot
 * silently disable the `depends-on:`/`blocked-by:` predicates or the `ready`
 * lens. A caller keeping its own dependency accessor uses the same rule:
 * `item.dependsOn ?? item.depends_on ?? []`.
 */
export type ViewItem = {
  id: string;
  type: ItemType;
  status: Status;
  labels: string[];
  title?: string | null;
  assignee?: string | null;
  parent?: string | null;
  milestone?: string | null;
  priority?: string | null;
  /** Ids this item waits for (kernel field). */
  dependsOn?: string[];
  /** JSON-contract alias of `dependsOn` (snake_case); read only when `dependsOn` is absent. */
  depends_on?: string[];
};

/** Filter/lens/sort options for `applyViewLens`. All fields optional. */
export type ViewLens = {
  /** Kernel filter expression (`status:todo !label:security`); absent/empty matches all. */
  filter?: string;
  /** Keep only items whose dependencies are all terminal (the kernel readiness rule). */
  ready?: boolean;
  /** Keep only items in this status (column selection). */
  status?: Status;
  /** Ordering: `id` (default, lexicographic) or `priority` (ADR 0009). */
  sort?: "id" | "priority";
};

/**
 * Apply one display lens to already-loaded items: kernel filter expression,
 * status/readiness narrowing and id/priority ordering, in one pure pass. This
 * is the shared entry the v2 filter/sort work builds on; `@me` in a filter
 * value stays the caller's job to resolve (the kernel rule,
 * `runList` does the same), and a malformed expression throws the kernel's
 * `parseFilter` error unchanged.
 *
 * The `blocked-by:`/`ancestor:` predicates and the readiness rule are computed
 * over the WHOLE input (like `runList`): evaluating them on the already
 * narrowed set would make a filtered-out dependency look unknown — hence open.
 * Predicates are ANDed; the empty lens is `sortById(items)`. Cost is one pass
 * over the items plus the two index builds (O(items + dependency edges)); the
 * result is a fresh array, the input is untouched. Dependencies are read in
 * either accepted shape (see `ViewItem`): the readiness rule and the
 * `depends-on:`/`blocked-by:` predicates all consume the normalized
 * `dependsOn`, so contract-shaped items behave exactly like kernel-shaped
 * ones. Returned items are the input objects, never normalized copies. Pure.
 */
export function applyViewLens<T extends ViewItem>(items: readonly T[], lens: ViewLens = {}): T[] {
  const predicates =
    lens.filter === undefined || lens.filter.trim() === "" ? [] : parseFilter(lens.filter);
  // One normalization pass shared by every dependency reader below: the
  // blocked-by index, the `depends-on:`/`blocked-by:` predicates and the
  // readiness rule must see the same edges whatever shape the caller passed.
  const kernelItems = items.map((item) => ({ ...item, dependsOn: viewItemDependencies(item) }));
  const blockedByIndex = buildBlockedByIndex(kernelItems);
  const ancestorIndex = buildAncestorIndex(items);
  const statusById = buildStatusIndex(items);
  const kept = items.filter((item, index) => {
    if (lens.status !== undefined && item.status !== lens.status) return false;
    const kernelItem = kernelItems[index]!;
    if (lens.ready === true && !isReady(kernelItem, statusById)) return false;
    return predicates.every((pred) =>
      matchesPredicate(kernelItem, pred, blockedByIndex, ancestorIndex),
    );
  });
  return lens.sort === "priority" ? sortByPriority(kept) : sortById(kept);
}
