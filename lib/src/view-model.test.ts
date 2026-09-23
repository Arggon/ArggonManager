/**
 * Shared board view-model (task-ui-shared-viewmodel): every derived rule the
 * three board surfaces render is pinned here, including the cases the surfaces'
 * own golden tests cannot reach directly (the tree cycle guard, the no-group
 * bucket, the readiness/filter lenses).
 *
 * The module composes kernel rules (`openDependencies`, `isReady`,
 * `isClaimable`, `parseFilter`/`matchesPredicate`, `priorityRank`) — these tests
 * assert the resulting behavior, not a private re-implementation.
 */
import { describe, expect, it } from "vitest";
import type { WorkItem as ContractWorkItem } from "./types.js";
import {
  applyViewLens,
  buildStatusIndex,
  groupItemsBy,
  hasOpenDependencies,
  itemsForStatus,
  matchesSubstringFilter,
  openDependencyIds,
  priorityTier,
  readyTodoCount,
  sortById,
  sortByPriority,
  statusCounts,
  treeEntries,
  visibleItems,
  type ViewItem,
} from "./view-model.js";

function item(overrides: Partial<ViewItem> & Pick<ViewItem, "id">): ViewItem {
  return {
    type: "task",
    status: "todo",
    labels: [],
    title: null,
    assignee: null,
    parent: null,
    milestone: null,
    priority: null,
    ...overrides,
  };
}

/**
 * A full JSON-contract item as `toContractWorkItem` emits it: snake_case
 * `depends_on`, no `dependsOn` field — the shape the web board's serve path
 * carries (task-ui-viewmodel-contract-deps).
 */
function contractItem(
  overrides: Partial<ContractWorkItem> & Pick<ContractWorkItem, "id">,
): ContractWorkItem {
  return {
    type: "task",
    status: "todo",
    title: null,
    assignee: null,
    branch: null,
    parent: null,
    labels: [],
    priority: null,
    created: null,
    updated: null,
    path: `ArggonManager/arggon-manager/x/${overrides.id}.md`,
    blocked_reason: null,
    milestone: null,
    depends_on: [],
    claimed_at: null,
    worktree_path: null,
    issue: null,
    ...overrides,
  };
}

describe("sortById", () => {
  it("orders lexicographically by id without mutating the input", () => {
    const input = [item({ id: "task-b" }), item({ id: "task-a" }), item({ id: "bug-c" })];
    const sorted = sortById(input);
    expect(sorted.map((entry) => entry.id)).toEqual(["bug-c", "task-a", "task-b"]);
    expect(input.map((entry) => entry.id)).toEqual(["task-b", "task-a", "bug-c"]);
    expect(sorted).not.toBe(input);
  });
});

describe("priorityTier and sortByPriority", () => {
  it("ranks p0..p3 and orders the unprioritized (or invalid) with the p3 tier", () => {
    expect(priorityTier("p0")).toBe(0);
    expect(priorityTier("p1")).toBe(1);
    expect(priorityTier("p2")).toBe(2);
    expect(priorityTier("p3")).toBe(3);
    expect(priorityTier(null)).toBe(3);
    expect(priorityTier(undefined)).toBe(3);
    expect(priorityTier("p9")).toBe(3); // hand-edited invalid token: validate flags it
  });

  it("sorts priority-major with lexicographic id ties, without mutating the input", () => {
    const input = [
      item({ id: "task-a", priority: null }),
      item({ id: "task-d", priority: "p3" }),
      item({ id: "task-c", priority: "p1" }),
      item({ id: "task-b", priority: "p0" }),
      item({ id: "task-a2", priority: "p1" }),
    ];
    expect(sortByPriority(input).map((entry) => entry.id)).toEqual([
      "task-b",
      "task-a2",
      "task-c",
      "task-a",
      "task-d",
    ]);
    expect(input.map((entry) => entry.id)).toEqual([
      "task-a",
      "task-d",
      "task-c",
      "task-b",
      "task-a2",
    ]);
  });
});

describe("buildStatusIndex, openDependencyIds and hasOpenDependencies", () => {
  const byId = buildStatusIndex([
    item({ id: "task-done", status: "done" }),
    item({ id: "task-cancelled", status: "cancelled" }),
    item({ id: "task-active", status: "in_progress" }),
    item({ id: "task-blocked", status: "blocked" }),
    item({ id: "task-todo", status: "todo" }),
  ]);

  it("maps every item id to its status", () => {
    expect(byId.get("task-active")).toEqual({ status: "in_progress" });
    expect(byId.get("missing")).toBeUndefined();
  });

  it("treats only done/cancelled as terminal and unknown ids as open, in declaration order", () => {
    expect(openDependencyIds(["task-active", "task-done"], byId)).toEqual(["task-active"]);
    expect(openDependencyIds(["task-cancelled"], byId)).toEqual([]);
    expect(openDependencyIds(["task-blocked", "task-todo"], byId)).toEqual([
      "task-blocked",
      "task-todo",
    ]);
    expect(openDependencyIds(["gone-z"], byId)).toEqual(["gone-z"]);
    expect(openDependencyIds([], byId)).toEqual([]);
  });

  it("reports the boolean dependency-blocked mark", () => {
    expect(hasOpenDependencies(["task-active"], byId)).toBe(true);
    expect(hasOpenDependencies(["task-done", "task-cancelled"], byId)).toBe(false);
    expect(hasOpenDependencies([], byId)).toBe(false);
  });
});

describe("substring filtering", () => {
  const items = [
    item({ id: "bug-beta", title: "Login 500 on empty password" }),
    item({ id: "task-alpha", title: "Add rate limiting" }),
    item({ id: "story-gamma" }),
  ];

  it("matches id or title case-insensitively; the empty filter matches all", () => {
    expect(matchesSubstringFilter(items[0]!, "")).toBe(true);
    expect(matchesSubstringFilter(items[0]!, "BUG")).toBe(true);
    expect(matchesSubstringFilter(items[1]!, "rate")).toBe(true);
    expect(matchesSubstringFilter(items[2]!, "gamma")).toBe(true);
    expect(matchesSubstringFilter(items[2]!, "nope")).toBe(false);
  });

  it("visibleItems sorts by id and applies the substring filter (copy)", () => {
    expect(visibleItems(items, "login").map((entry) => entry.id)).toEqual(["bug-beta"]);
    expect(visibleItems(items, "bug").map((entry) => entry.id)).toEqual(["bug-beta"]);
    const all = visibleItems(items, "");
    expect(all.map((entry) => entry.id)).toEqual(["bug-beta", "story-gamma", "task-alpha"]);
    expect(items.map((entry) => entry.id)).toEqual(["bug-beta", "task-alpha", "story-gamma"]);
    expect(all).not.toBe(items);
  });

  it("itemsForStatus keeps one column of the visible items, id-sorted", () => {
    const mixed = [
      item({ id: "task-b", status: "todo" }),
      item({ id: "task-a", status: "done" }),
      item({ id: "task-c", status: "done" }),
    ];
    expect(itemsForStatus(mixed, "", "done").map((entry) => entry.id)).toEqual([
      "task-a",
      "task-c",
    ]);
    expect(itemsForStatus(mixed, "c", "done").map((entry) => entry.id)).toEqual(["task-c"]);
    expect(itemsForStatus(mixed, "", "blocked")).toEqual([]);
  });
});

describe("statusCounts", () => {
  it("returns every v0 status zero-filled and counts the items", () => {
    const counts = statusCounts([
      item({ id: "task-a", status: "todo" }),
      item({ id: "task-b", status: "todo" }),
      item({ id: "task-c", status: "in_progress" }),
      item({ id: "task-d", status: "blocked" }),
      item({ id: "task-e", status: "done" }),
      item({ id: "task-f", status: "cancelled" }),
    ]);
    expect(counts).toEqual({
      todo: 2,
      in_progress: 1,
      blocked: 1,
      done: 1,
      cancelled: 1,
    });
    expect(statusCounts([])).toEqual({
      todo: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
      cancelled: 0,
    });
  });
});

describe("groupItemsBy", () => {
  it("sorts keyed groups ascending and renders the no-group bucket last only when mixed", () => {
    const items = [
      item({ id: "task-z", parent: "story-b" }),
      item({ id: "task-a", parent: "story-a" }),
      item({ id: "task-b", parent: "story-a" }),
      item({ id: "task-c" }),
    ];
    const groups = groupItemsBy(items, (entry) => entry.parent ?? null);
    expect(groups.map((group) => group.key)).toEqual(["story-a", "story-b", null]);
    expect(groups[0]!.items.map((entry) => entry.id)).toEqual(["task-a", "task-b"]);
    expect(groups[1]!.items.map((entry) => entry.id)).toEqual(["task-z"]);
    expect(groups[2]!.items.map((entry) => entry.id)).toEqual(["task-c"]);
  });

  it("keeps a fully key-less selection as one unlabeled bucket (ungrouped rendering)", () => {
    const items = [item({ id: "task-b" }), item({ id: "task-a" })];
    expect(groupItemsBy(items, () => null)).toEqual([{ key: null, items }]);
    expect(groupItemsBy([], () => null)).toEqual([]);
  });

  it("drops the no-group bucket when every item has a key", () => {
    const items = [item({ id: "task-a", milestone: "2026-12-31" })];
    const groups = groupItemsBy(items, (entry) => entry.milestone ?? null);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe("2026-12-31");
    expect(groups[0]!.items.map((entry) => entry.id)).toEqual(["task-a"]);
  });

  it("preserves the input order inside each bucket without mutating the input", () => {
    const bucket = [item({ id: "task-b" }), item({ id: "task-a" })];
    const groups = groupItemsBy(bucket, (entry) => entry.parent ?? null);
    expect(groups[0]!.items.map((entry) => entry.id)).toEqual(["task-b", "task-a"]);
    expect(groups[0]!.items).not.toBe(bucket);
  });
});

describe("treeEntries", () => {
  it("flattens depth-first with id-sorted siblings and depths", () => {
    const items = [
      item({ id: "launch", parent: null }),
      item({ id: "core", parent: "launch" }),
      item({ id: "story-a", parent: "core" }),
      item({ id: "bug-three", parent: "story-a" }),
      item({ id: "task-one", parent: "story-a" }),
      item({ id: "task-two", parent: "story-a" }),
    ];
    expect(treeEntries(items).map((entry) => [entry.item.id, entry.depth])).toEqual([
      ["launch", 0],
      ["core", 1],
      ["story-a", 2],
      ["bug-three", 3],
      ["task-one", 3],
      ["task-two", 3],
    ]);
  });

  it("renders orphans (absent/blank/unknown parent) as roots", () => {
    const items = [
      item({ id: "b", parent: "missing" }),
      item({ id: "a", parent: "b" }),
      item({ id: "blank", parent: "" }),
      item({ id: "no-parent" }),
    ];
    expect(treeEntries(items).map((entry) => [entry.item.id, entry.depth])).toEqual([
      ["b", 0],
      ["a", 1],
      ["blank", 0],
      ["no-parent", 0],
    ]);
  });

  it("guards parent cycles: each item renders exactly once, remaining cycle roots last", () => {
    const items = [
      item({ id: "cycle-1", parent: "cycle-2" }),
      item({ id: "cycle-2", parent: "cycle-1" }),
      item({ id: "self", parent: "self" }),
      item({ id: "root" }),
    ];
    const entries = treeEntries(items);
    expect(entries.map((entry) => [entry.item.id, entry.depth])).toEqual([
      ["root", 0],
      ["cycle-1", 0],
      ["cycle-2", 1],
      ["self", 0],
    ]);
    // A total walk never drops an item (or loops): every id renders exactly once.
    expect(entries.map((entry) => entry.item.id).length).toBe(items.length);
    expect(new Set(entries.map((entry) => entry.item.id)).size).toBe(items.length);
  });

  it("does not mutate the input array", () => {
    const items = [item({ id: "task-b" }), item({ id: "task-a" })];
    treeEntries(items);
    expect(items.map((entry) => entry.id)).toEqual(["task-b", "task-a"]);
  });
});

describe("readyTodoCount", () => {
  it("counts claimable, unclaimed, todo items whose dependencies are terminal (absent means none)", () => {
    const items = [
      item({ id: "story-a", type: "story" }),
      item({ id: "task-ready", dependsOn: [] }),
      item({ id: "task-contract-shaped" }), // no dependsOn field at all
      item({ id: "task-waits", dependsOn: ["task-ready"] }),
      item({ id: "task-done-dep", dependsOn: ["done-x"] }),
      item({ id: "done-x", status: "done" }),
      item({ id: "task-claimed", assignee: "Arggon" }),
      item({ id: "task-active", status: "in_progress" }),
      item({ id: "epic-a", type: "epic" }),
      item({ id: "task-unknown-dep", dependsOn: ["gone-z"] }),
    ];
    // story-a, task-ready, task-contract-shaped and task-done-dep are ready;
    // task-waits/unknown-dep are blocked, the rest are not claimable+unclaimed+todo.
    expect(readyTodoCount(items)).toBe(4);
    expect(readyTodoCount([])).toBe(0);
  });
});

describe("applyViewLens", () => {
  const base = [
    item({
      id: "task-a",
      status: "todo",
      labels: ["security"],
      priority: "p2",
      title: "Harden login",
      dependsOn: ["task-blocker"],
    }),
    item({ id: "task-b", status: "todo", priority: "p0", title: "Ship it" }),
    item({ id: "task-blocker", status: "in_progress" }),
    item({ id: "bug-c", type: "bug", status: "done", labels: [] }),
    item({ id: "story-d", type: "story", status: "todo", parent: "epic-x" }),
    item({ id: "epic-x", type: "epic", status: "in_progress" }),
  ];

  it("applies the empty lens as a plain id sort (copy)", () => {
    expect(applyViewLens(base).map((entry) => entry.id)).toEqual([
      "bug-c",
      "epic-x",
      "story-d",
      "task-a",
      "task-b",
      "task-blocker",
    ]);
  });

  it("applies kernel filter expressions (AND, negation, priority:none)", () => {
    expect(applyViewLens(base, { filter: "status:todo" }).map((entry) => entry.id)).toEqual([
      "story-d",
      "task-a",
      "task-b",
    ]);
    expect(
      applyViewLens(base, { filter: "type:task label:security" }).map((entry) => entry.id),
    ).toEqual(["task-a"]);
    expect(applyViewLens(base, { filter: "!status:todo" }).map((entry) => entry.id)).toEqual([
      "bug-c",
      "epic-x",
      "task-blocker",
    ]);
    expect(applyViewLens(base, { filter: "priority:none" }).map((entry) => entry.id)).toEqual([
      "bug-c",
      "epic-x",
      "story-d",
      "task-blocker",
    ]);
  });

  it("supports the computed blocked-by: and ancestor: predicates", () => {
    expect(applyViewLens(base, { filter: "blocked-by:task-blocker" }).map((e) => e.id)).toEqual([
      "task-a",
    ]);
    expect(applyViewLens(base, { filter: "ancestor:epic-x" }).map((e) => e.id)).toEqual([
      "story-d",
    ]);
  });

  it("throws the kernel parse error on a malformed expression", () => {
    expect(() => applyViewLens(base, { filter: "unknown:value" })).toThrow(
      /unknown filter field "unknown"/,
    );
    expect(() => applyViewLens(base, { filter: "status" })).toThrow(/bad filter token/);
  });

  it("narrows by status and readiness across the whole input", () => {
    // task-blocker (in_progress) is filtered out by the status lens, but the
    // readiness rule still sees it as an open dependency of task-a.
    expect(applyViewLens(base, { status: "todo", ready: true }).map((entry) => entry.id)).toEqual([
      "story-d",
      "task-b",
    ]);
    // A done dependency outside the status lens still counts as terminal.
    const doneDep = [...base, item({ id: "task-terminal", dependsOn: ["bug-c"] })];
    expect(
      applyViewLens(doneDep, { status: "todo", ready: true }).map((entry) => entry.id),
    ).toContain("task-terminal");
  });

  it("sorts by priority rank with id ties, and does not mutate the input", () => {
    expect(
      applyViewLens(base, { status: "todo", sort: "priority" }).map((entry) => entry.id),
    ).toEqual(["task-b", "task-a", "story-d"]);
    expect(base.map((entry) => entry.id)).toEqual([
      "task-a",
      "task-b",
      "task-blocker",
      "bug-c",
      "story-d",
      "epic-x",
    ]);
  });
});

describe("contract-shaped items (depends_on)", () => {
  it("readyTodoCount counts depends_on edges exactly like dependsOn", () => {
    const kernelShape = [
      item({ id: "done-x", status: "done" }),
      item({ id: "open-y", status: "in_progress" }),
      item({ id: "task-ready", dependsOn: ["done-x"] }),
      item({ id: "task-waits", dependsOn: ["open-y"] }),
      item({ id: "task-unknown-dep", dependsOn: ["gone-z"] }),
    ];
    const contractShape = [
      contractItem({ id: "done-x", status: "done" }),
      contractItem({ id: "open-y", status: "in_progress" }),
      contractItem({ id: "task-ready", depends_on: ["done-x"] }),
      contractItem({ id: "task-waits", depends_on: ["open-y"] }),
      contractItem({ id: "task-unknown-dep", depends_on: ["gone-z"] }),
    ];
    expect(readyTodoCount(contractShape)).toBe(readyTodoCount(kernelShape));
    expect(readyTodoCount(contractShape)).toBe(1);
  });

  it("applyViewLens resolves blocked-by: and depends-on: from depends_on", () => {
    const items = [
      contractItem({ id: "task-dependent", depends_on: ["task-blocker"] }),
      contractItem({ id: "task-free" }),
      contractItem({ id: "task-blocker", status: "in_progress" }),
    ];
    expect(applyViewLens(items, { filter: "blocked-by:task-blocker" }).map((e) => e.id)).toEqual([
      "task-dependent",
    ]);
    expect(applyViewLens(items, { filter: "depends-on:task-blocker" }).map((e) => e.id)).toEqual([
      "task-dependent",
    ]);
    // A contract item with no dependency edge is never pulled in.
    expect(applyViewLens(items, { filter: "blocked-by:task-free" })).toEqual([]);
  });

  it("the ready lens narrows depends_on blockers exactly like dependsOn", () => {
    const contractShape = [
      contractItem({ id: "task-blocked", depends_on: ["task-open"] }),
      contractItem({ id: "task-open", status: "in_progress" }),
      contractItem({ id: "task-terminal", depends_on: ["task-done"] }),
      contractItem({ id: "task-done", status: "done" }),
    ];
    const kernelShape = [
      item({ id: "task-blocked", dependsOn: ["task-open"] }),
      item({ id: "task-open", status: "in_progress" }),
      item({ id: "task-terminal", dependsOn: ["task-done"] }),
      item({ id: "task-done", status: "done" }),
    ];
    expect(applyViewLens(contractShape, { status: "todo", ready: true }).map((e) => e.id)).toEqual([
      "task-terminal",
    ]);
    expect(applyViewLens(kernelShape, { status: "todo", ready: true }).map((e) => e.id)).toEqual([
      "task-terminal",
    ]);
  });

  it("resolves edges across mixed shapes in one array (kernel and contract items)", () => {
    const items = [
      contractItem({ id: "task-dependent", depends_on: ["task-blocker"] }),
      item({ id: "task-blocker", status: "in_progress" }),
      item({ id: "task-kernel-dependent", dependsOn: ["task-contract-blocker"] }),
      contractItem({ id: "task-contract-blocker", status: "in_progress" }),
    ];
    expect(applyViewLens(items, { filter: "blocked-by:task-blocker" }).map((e) => e.id)).toEqual([
      "task-dependent",
    ]);
    expect(
      applyViewLens(items, { filter: "blocked-by:task-contract-blocker" }).map((e) => e.id),
    ).toEqual(["task-kernel-dependent"]);
    expect(readyTodoCount(items)).toBe(0);
  });

  it("lets kernel dependsOn win over depends_on when an item carries both", () => {
    const hybrid = {
      ...contractItem({ id: "task-hybrid" }),
      dependsOn: [] as string[],
      depends_on: ["task-open"],
    };
    const items = [hybrid, contractItem({ id: "task-open", status: "in_progress" })];
    expect(applyViewLens(items, { filter: "blocked-by:task-open" })).toEqual([]);
    expect(applyViewLens(items, { status: "todo", ready: true }).map((e) => e.id)).toEqual([
      "task-hybrid",
    ]);
  });

  it("returns the input objects untouched (no normalization leaks into the result)", () => {
    const items = [
      contractItem({ id: "task-a", depends_on: ["task-b"] }),
      contractItem({ id: "task-b", status: "done" }),
    ];
    const lensed = applyViewLens(items, { filter: "depends-on:task-b" });
    expect(lensed).toEqual([items[0]]);
    expect(lensed[0]).toBe(items[0]);
    expect(applyViewLens(items)).toEqual(items);
    expect(applyViewLens(items)[0]).toBe(items[0]);
    expect("dependsOn" in items[0]!).toBe(false);
    expect(items[0]!.depends_on).toEqual(["task-b"]);
  });
});
