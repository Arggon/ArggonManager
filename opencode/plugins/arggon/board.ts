/**
 * ArggonManager board/status data for the TUI plugin (W5, `task-native-tui`).
 *
 * Display-only, kernel-backed: `boardSnapshot()` reads the tracker through the
 * same library entry the CLI, the stdio MCP server and the native tools use
 * (`findTasksDir` → `loadItems` → kernel readiness/next ranking), so the TUI
 * never forks rule logic (ADR 0011 §4). The module performs **no writes** and
 * never throws: a missing/corrupt tracker degrades to an empty snapshot with a
 * human reason, and the panel keeps rendering.
 *
 * Dependency shape (ADR 0013): the only static import is the kernel package.
 * This module is part of the vendored plugin graph — `npm run build:plugin`
 * inlines `@arggondev/lib` into the committed single-file bundle, and the bundled
 * named exports are what `tui.tsx` consumes (`./index.ts` in an adopter tree,
 * the source module in this repo). It must stay free of OpenCode/TUI imports
 * and of any npm dependency; node builtins only.
 */
import {
  findTasksDir,
  isClaimable,
  isReady,
  itemsById,
  loadItems,
  openDependencies,
  repoRootFromTasks,
  runNext,
  sanitizeHumanError,
  sanitizeHumanTextUncapped,
  type ItemType,
  type Status,
} from "@arggondev/lib";

/** Panel name shared between the slot contribution and the keymap command. */
export const ARGON_BOARD_PANEL = "arggon.board";

/** One-letter type badge per v0 type (I/E/S/T/B). */
export const BOARD_TYPE_BADGES: Record<ItemType, string> = {
  initiative: "I",
  epic: "E",
  story: "S",
  task: "T",
  bug: "B",
};

/** Status glyphs for the tree lines (pure display, never data). */
export const BOARD_STATUS_MARKS: Record<Status, string> = {
  todo: "·",
  in_progress: "▸",
  blocked: "!",
  done: "✓",
  cancelled: "✗",
};

/** Display order of the status counters (v0 enum order). */
export const BOARD_STATUS_ORDER: readonly Status[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
];

/** Snapshot of one item, flattened for display (no kernel internals leak). */
export type BoardItem = {
  id: string;
  type: ItemType;
  title: string;
  status: Status;
  parent: string | null;
  assignee: string | null;
  priority: string | null;
  /** Frontmatter `blocked_reason`, when the status is `blocked`. */
  blockedReason: string | null;
  dependsOn: string[];
  /** Open (non-terminal) dependency ids — the kernel rule, not a copy. */
  openDeps: string[];
  /** The session's active item (branch/env correlation). */
  active: boolean;
};

/** Read-only view of the tracker the TUI renders. */
export type BoardSnapshot = {
  /** Tracker root (repo root containing `ArggonManager/`), null when absent. */
  root: string | null;
  items: BoardItem[];
  counts: Record<Status, number>;
  activeId: string | null;
  /** Kernel `next` suggestion id (null when the pool is empty/absent). */
  nextId: string | null;
  /** Human reason when no tracker could be read; null on success. */
  error: string | null;
};

/** Input for `activeBoardId`: branch (`feat/<id>`, `fix/<id>`) and env override. */
export type BoardActiveInput = {
  branch?: string | null;
  /** `ARGON_ITEM` override (the same one the server plugin honors). */
  envItem?: string | null;
};

/** Tracker root of `cwd`, or null when there is no tracker to read. */
export function boardRoot(cwd: string): string | null {
  try {
    return repoRootFromTasks(findTasksDir(cwd));
  } catch {
    return null;
  }
}

/** Empty snapshot carrying a human reason the panel renders. */
export function emptyBoardSnapshot(reason: string): BoardSnapshot {
  return {
    root: null,
    items: [],
    counts: emptyCounts(),
    activeId: null,
    nextId: null,
    error: reason,
  };
}

function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Resolve the session's active item id: `ARGON_ITEM` override first, then the
 * convention branch (`feat/<id>` / `fix/<id>`), exactly like the server
 * plugin's VCS fallback. Pure: unknown ids never resolve.
 */
export function activeBoardId(
  items: readonly BoardItem[],
  input: BoardActiveInput = {},
): string | null {
  const known = new Set(items.map((item) => item.id));
  const env = (input.envItem ?? "").trim();
  if (env !== "" && known.has(env)) return env;
  const branch = (input.branch ?? "").trim();
  const match = /^(?:feat|fix)\/(.+)$/.exec(branch);
  const candidate = match?.[1] ?? "";
  return candidate !== "" && known.has(candidate) ? candidate : null;
}

/**
 * Read the tracker into a display snapshot. **Never throws and never writes**:
 * the tracker detection has its own reason ("no tracker"), and any read failure
 * — including a corrupt tracker whose duplicate ids make `itemsById` throw
 * (`Duplicate id '…'`) — degrades to an empty snapshot carrying a sanitized
 * human reason, so the panel keeps rendering (P1 review fix).
 */
export function boardSnapshot(cwd: string, input: BoardActiveInput = {}): BoardSnapshot {
  let tasksDir: string;
  try {
    tasksDir = findTasksDir(cwd);
  } catch {
    return emptyBoardSnapshot("no ArggonManager tracker found here");
  }
  try {
    const root = repoRootFromTasks(tasksDir);
    const kernelItems = loadItems(tasksDir);
    // Duplicate ids throw here; the guard above turns that into an error
    // snapshot instead of a plugin-slot crash.
    const byId = itemsById(kernelItems) as Map<string, { status: Status }>;
    const items: BoardItem[] = kernelItems
      .map((item) => ({
        id: item.id,
        type: item.type,
        title: sanitizeHumanTextUncapped(item.title ?? item.id),
        status: item.status,
        parent: item.parent ?? null,
        assignee: item.assignee ?? null,
        priority: item.priority ?? null,
        blockedReason: item.blockedReason ?? null,
        dependsOn: [...item.dependsOn],
        openDeps: openDependencies(item, byId),
        active: false,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const activeId = activeBoardId(items, input);
    for (const item of items) item.active = item.id === activeId;

    let nextId: string | null = null;
    try {
      nextId = runNext({ cwd }).suggestion?.item.id ?? null;
    } catch {
      nextId = null;
    }

    return {
      root,
      items,
      counts: countBoardStatuses(items),
      activeId,
      nextId,
      error: null,
    };
  } catch (error) {
    // Repo-controlled bytes (ids/paths) land in the message: escape them the
    // same way the CLI's human error channel does, and keep it one bounded line.
    return emptyBoardSnapshot(sanitizeHumanError(`tracker unreadable: ${detail(error)}`));
  }
}

function emptyCounts(): Record<Status, number> {
  return { todo: 0, in_progress: 0, blocked: 0, done: 0, cancelled: 0 };
}

/** Item counts per status (pure). */
export function countBoardStatuses(items: readonly BoardItem[]): Record<Status, number> {
  const counts = emptyCounts();
  for (const item of items) counts[item.status] += 1;
  return counts;
}

/** One flattened tree entry: the item plus its nesting depth. Pure. */
export type BoardTreeEntry = { item: BoardItem; depth: number };

/**
 * Depth-first, id-sorted flattening of the parent tree. Roots are items whose
 * parent is absent/unknown (a malformed tree renders as roots instead of
 * disappearing); a cycle guard makes the walk total. Pure.
 */
export function boardTreeEntries(items: readonly BoardItem[]): BoardTreeEntry[] {
  const known = new Set(items.map((item) => item.id));
  const children = new Map<string, BoardItem[]>();
  const roots: BoardItem[] = [];
  for (const item of items) {
    const parent = item.parent;
    if (parent === null || parent === "" || !known.has(parent)) {
      roots.push(item);
      continue;
    }
    const bucket = children.get(parent) ?? [];
    bucket.push(item);
    children.set(parent, bucket);
  }
  const byId = (a: BoardItem, b: BoardItem): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  roots.sort(byId);
  for (const bucket of children.values()) bucket.sort(byId);

  const entries: BoardTreeEntry[] = [];
  const visited = new Set<string>();
  const walk = (item: BoardItem, depth: number): void => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    entries.push({ item, depth });
    for (const child of children.get(item.id) ?? []) walk(child, depth + 1);
  };
  for (const root of roots) walk(root, 0);
  // Total walk: a cycle whose members have known parents is unreachable from
  // any root — render those remaining items as roots instead of losing them.
  for (const item of [...items].sort(byId)) {
    if (!visited.has(item.id)) walk(item, 0);
  }
  return entries;
}

/** Clip one line to `width` visible columns, marking a cut with an ellipsis. */
export function clipBoardLine(text: string, width: number): string {
  if (width <= 0) return "";
  if (text.length <= width) return text;
  return text.slice(0, Math.max(width - 1, 0)) + "…";
}

/** Header line: tracker, item total and the kernel `next` suggestion. */
export function boardHeaderLine(snapshot: BoardSnapshot): string {
  if (snapshot.error !== null) return `arggon board · ${snapshot.error}`;
  const total = snapshot.items.length;
  const next =
    snapshot.nextId !== null ? ` · next: ${sanitizeHumanTextUncapped(snapshot.nextId)}` : "";
  return `arggon board · ${total} item(s)${next}`;
}

/** Counters line: `todo 12 · in_progress 3 · …` (zero counts included). */
export function boardCountsLine(snapshot: BoardSnapshot): string {
  return BOARD_STATUS_ORDER.map((status) => `${status} ${snapshot.counts[status]}`).join(" · ");
}

/** One tree line for an entry: indent, active marker, status mark, badge, id, title. */
export function boardItemLine(entry: BoardTreeEntry): string {
  const { item, depth } = entry;
  const indent = "  ".repeat(Math.min(depth, 8));
  const active = item.active ? "▶" : " ";
  const mark = BOARD_STATUS_MARKS[item.status];
  const badge = BOARD_TYPE_BADGES[item.type];
  // Ids/assignees/blocked reasons are repo-controlled frontmatter bytes: escape
  // them before rendering so a hostile item cannot emit ANSI/OSC through the
  // panel.
  const blocked =
    item.openDeps.length > 0 ? ` ⌫${sanitizeHumanTextUncapped(item.openDeps.join(","))}` : "";
  const assignee = item.assignee !== null ? ` @${sanitizeHumanTextUncapped(item.assignee)}` : "";
  const reason =
    item.blockedReason !== null && item.blockedReason !== ""
      ? ` · blocked: ${sanitizeHumanTextUncapped(item.blockedReason)}`
      : "";
  return (
    `${indent}${active}${mark} ${badge} ${sanitizeHumanTextUncapped(item.id)}${blocked}${assignee}` +
    ` — ${sanitizeHumanTextUncapped(item.title)}${reason}`
  );
}

/** Plain-text panel body (no ANSI): header, counters, tree. Pure. */
export function boardTreeLines(
  snapshot: BoardSnapshot,
  options: { width?: number; limit?: number } = {},
): string[] {
  const width = options.width ?? 0;
  const limit = options.limit ?? 200;
  const clip = (line: string): string => (width > 0 ? clipBoardLine(line, width) : line);
  const lines = [clip(boardHeaderLine(snapshot))];
  if (snapshot.error !== null) return lines;
  lines.push(clip(boardCountsLine(snapshot)));
  const entries = boardTreeEntries(snapshot.items);
  for (const entry of entries.slice(0, Math.max(limit, 0))) lines.push(clip(boardItemLine(entry)));
  const hidden = entries.length - Math.min(entries.length, Math.max(limit, 0));
  if (hidden > 0) lines.push(clip(`… ${hidden} more item(s)`));
  return lines;
}

/**
 * Short status line for the sidebar contribution: the active item when the
 * session resolves one, else the tracker's ready signal. Pure.
 *
 * The ready count uses the kernel's own definition — `isClaimable(type)` +
 * `todo` + unclaimed + `isReady` (deps terminal) — instead of a copied
 * predicate, so it cannot drift from the kernel. `next` narrows the pool to
 * leaf work, so the count can exceed what `/arggon-next` would suggest.
 */
export function sidebarStatusLine(snapshot: BoardSnapshot, width = 0): string {
  const clip = (line: string): string => (width > 0 ? clipBoardLine(line, width) : line);
  if (snapshot.error !== null) return clip("arggon · no tracker");
  const active = snapshot.items.find((item) => item.id === snapshot.activeId);
  if (active !== undefined) {
    return clip(`arggon ▶ ${sanitizeHumanTextUncapped(active.id)} ${active.status}`);
  }
  const byId = new Map(snapshot.items.map((item) => [item.id, { status: item.status }] as const));
  const ready = snapshot.items.filter(
    (item) =>
      isClaimable(item.type) &&
      item.status === "todo" &&
      item.assignee === null &&
      isReady(item, byId),
  ).length;
  const next =
    snapshot.nextId !== null ? ` · next ${sanitizeHumanTextUncapped(snapshot.nextId)}` : "";
  return clip(`arggon · ${ready} ready${next}`);
}
