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
  splitFilterTokens,
  unquoteFilterValue,
  type FilterPredicate,
} from "./filter.js";
import { isItemType, ITEM_TYPES, type ItemType } from "./ids.js";
import { downstreamWeight, isReady, openDependencies } from "./next.js";
import { isPriority, PRIORITIES, priorityRank } from "./priority.js";
import { isClaimable, isStatus, STATUSES, type Status } from "./status.js";

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

/**
 * DISPLAY next-rank order (task-tui-sort-ready-lens): ready items first, then
 * the ADR 0009 priority-major ordering (tier via `priorityTier`, unprioritized
 * with the p3 tier), then higher downstream weight — how many items become
 * ready once this one completes (`downstreamWeight`, the same atom `next`
 * ranks its pool with) — lexicographic id on ties. Deterministic. Composed
 * entirely from kernel atoms (`isReadyTodo`, `priorityTier`,
 * `downstreamWeight`); nothing here restates a kernel rule.
 *
 * This is the board surfaces' display order, deliberately not `runNext`'s
 * pool construction: `next` keeps its documented semantics (ready pool ranked
 * priority-major, blocked items appended in lexicographic order), while the
 * boards show EVERY item of a column in one total rank. Readiness is computed
 * against the full item set the caller passes — narrow the set only AFTER
 * ranking (a filtered-out dependency must not look unknown). Pure; copies.
 */
export function sortByNextRank<
  T extends {
    id: string;
    type: ItemType;
    status: Status;
    priority?: string | null;
    assignee?: string | null;
    dependsOn?: string[];
    depends_on?: string[];
  },
>(items: readonly T[]): T[] {
  const byId = buildStatusIndex(items);
  const blockedByIndex = buildBlockedByIndex(
    items.map((item) => ({ id: item.id, dependsOn: viewItemDependencies(item) })),
  );
  const ready = (item: T): boolean => isReadyTodo(item, byId);
  const tier = (item: T): number => priorityTier(item.priority);
  const weight = (item: T): number => downstreamWeight(item.id, blockedByIndex);
  const lexicographic = (a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return [...items].sort(
    (a, b) =>
      Number(ready(b)) - Number(ready(a)) ||
      tier(a) - tier(b) ||
      weight(b) - weight(a) ||
      lexicographic(a, b),
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
 * The ready-todo predicate: claimable, unclaimed `todo` whose dependencies are
 * all terminal — the kernel composition (`isClaimable` + the `todo`/`assignee`
 * field rules + kernel `isReady`) that the ready surfaces share
 * (task-tui-sort-ready-lens uses it for the board's ready-only lens). An
 * absent dependency field means no dependencies; both the kernel `dependsOn`
 * and the JSON-contract `depends_on` are accepted (see `ViewItem`). Pure.
 */
export function isReadyTodo<
  T extends {
    id: string;
    type: ItemType;
    status: Status;
    assignee?: string | null;
    dependsOn?: string[];
    depends_on?: string[];
  },
>(item: T, byId: ReadonlyMap<string, { status: Status }>): boolean {
  return (
    isClaimable(item.type) &&
    item.status === "todo" &&
    (item.assignee ?? null) === null &&
    isReady({ ...item, dependsOn: viewItemDependencies(item) }, byId)
  );
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
  return items.filter((item) => isReadyTodo(item, byId)).length;
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

/** Verdict of one display-filter expression: the kept items, or the refusal message. */
export type ViewFilterVerdict<T> = { ok: true; items: T[] } | { ok: false; error: string };

/**
 * One display-filter expression over already-loaded items — the interactive
 * surface of the filter language (the TUI board prompt, task-tui-filter-language):
 * the kernel grammar (`parseFilter`/`matchesPredicate`, ALL documented
 * predicates — the caller holds whole-tree contract items, so `parent:`,
 * `depends-on:` and `blocked-by:` work here) extended with free text: a token
 * without a `field:` prefix is a case-insensitive substring on id/title, ANDed
 * with the predicates (the same extension the HTML board lens documents). A
 * `!`-prefixed bare token is refused, like the board lens.
 *
 * Per-token parse through the kernel parser (`parseFilter(token)`), so quoting,
 * negation, unknown fields and empty values carry the kernel's exact error
 * messages; type/status/priority values are validated like `runList` (same
 * messages), and `assignee:@me` resolves through `opts.me` (pre-resolved) or
 * `opts.resolveMe` (lazy), runList's "@me is the caller's job" rule — an
 * unresolvable `@me` is a refusal, never a silent match-all.
 *
 * Unlike `parseFilter` this never throws: any refusal comes back as
 * `{ ok: false, error }` so an interactive prompt can show it inline. The
 * `blocked-by:`/`ancestor:` indexes are computed over the WHOLE input (same
 * rule as `applyViewLens`/`runList`); the input order is preserved (the caller
 * sorts). Empty/blank expressions match everything. Pure.
 */
export function applyViewFilter<T extends ViewItem>(
  items: readonly T[],
  expr: string,
  opts: { me?: string | null; resolveMe?: () => string | null } = {},
): ViewFilterVerdict<T> {
  const trimmed = expr.trim();
  if (trimmed === "") return { ok: true, items: [...items] };
  const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));
  let tokens: string[];
  try {
    tokens = splitFilterTokens(trimmed);
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
  const needles: string[] = [];
  const predicates: FilterPredicate[] = [];
  for (const token of tokens) {
    let negated = false;
    let rest = token;
    if (rest.startsWith("!")) {
      negated = true;
      rest = rest.slice(1);
    }
    if (rest.indexOf(":") <= 0) {
      // Free text (the board-lens extension): no field prefix (or a leading
      // colon, which no field name can produce). Negation is predicate-only.
      if (negated) {
        return {
          ok: false,
          error: `bad filter token "${token}" (negation applies to field:value predicates; free text matches id/title as-is)`,
        };
      }
      try {
        const text = unquoteFilterValue(rest, trimmed);
        if (!text) return { ok: false, error: `empty value in filter token "${token}"` };
        needles.push(text.toLowerCase());
      } catch (err) {
        return { ok: false, error: messageOf(err) };
      }
      continue;
    }
    // Predicate token: the kernel parser owns the grammar and the messages.
    try {
      predicates.push(...parseFilter(token));
    } catch (err) {
      return { ok: false, error: messageOf(err) };
    }
  }
  // Value validation, runList's rules and messages verbatim.
  for (const pred of predicates) {
    if (pred.field === "type" && !isItemType(pred.value)) {
      return {
        ok: false,
        error: `unknown type "${pred.value}". Allowed: ${ITEM_TYPES.join(", ")}`,
      };
    }
    if (pred.field === "status" && !isStatus(pred.value)) {
      return {
        ok: false,
        error: `unknown status "${pred.value}". Allowed: ${STATUSES.join(", ")}`,
      };
    }
    if (pred.field === "priority" && pred.value !== "none" && !isPriority(pred.value)) {
      return {
        ok: false,
        error: `unknown priority "${pred.value}". Allowed: ${PRIORITIES.join(", ")}, none`,
      };
    }
    if (pred.field === "assignee" && pred.value === "@me") {
      const login = opts.me !== undefined ? opts.me : (opts.resolveMe?.() ?? null);
      if (login === null || login === "") {
        return {
          ok: false,
          error:
            "could not resolve @me (set GITHUB_USER or GITHUB_ACTOR, or authenticate gh: gh api user)",
        };
      }
      pred.value = login;
    }
  }
  // The computed predicates see the WHOLE input (runList's rule): a filtered-out
  // dependency must not look unknown. One normalization pass shared by every
  // dependency reader (see applyViewLens).
  const kernelItems = items.map((item) => ({
    ...item,
    dependsOn: [...(item.dependsOn ?? item.depends_on ?? [])],
  }));
  const blockedByIndex = buildBlockedByIndex(kernelItems);
  const ancestorIndex = buildAncestorIndex(items);
  const kept = items.filter((item, index) => {
    const kernelItem = kernelItems[index]!;
    for (const pred of predicates) {
      if (!matchesPredicate(kernelItem, pred, blockedByIndex, ancestorIndex)) return false;
    }
    for (const needle of needles) {
      if (!matchesSubstringFilter(item, needle)) return false;
    }
    return true;
  });
  return { ok: true, items: kept };
}
