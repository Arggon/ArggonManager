/**
 * ArggonManager board/status data for the TUI plugin (W5, `task-native-tui`).
 *
 * Display-only, kernel-backed: `boardSnapshot()` reads the tracker through the
 * same library entry the CLI, the stdio MCP server and the native tools use
 * (`findTasksDir` → `loadItems` → kernel readiness/next ranking), so the TUI
 * never forks rule logic (ADR 0011 §4). `boardItemDetail()` reuses the kernel's
 * bounded read path (`runShow`) for the inline detail block. The module
 * performs **no writes** and never throws: a missing/corrupt tracker degrades
 * to an empty snapshot (or an error detail) with a human reason, and the panel
 * keeps rendering.
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
  itemsById,
  loadItems,
  openDependencyIds,
  readyTodoCount,
  repoRootFromTasks,
  runNext,
  runShow,
  sanitizeHumanError,
  sanitizeHumanTextUncapped,
  sortById,
  statusCounts,
  treeEntries,
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
    counts: statusCounts([]),
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
    const items: BoardItem[] = sortById(
      kernelItems.map((item) => ({
        id: item.id,
        type: item.type,
        title: sanitizeHumanTextUncapped(item.title ?? item.id),
        status: item.status,
        parent: item.parent ?? null,
        assignee: item.assignee ?? null,
        priority: item.priority ?? null,
        blockedReason: item.blockedReason ?? null,
        dependsOn: [...item.dependsOn],
        openDeps: openDependencyIds(item.dependsOn, byId),
        active: false,
      })),
    );

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

/**
 * Item counts per status (pure), through the shared view-model: every v0
 * status is present, zero-filled.
 */
export function countBoardStatuses(items: readonly BoardItem[]): Record<Status, number> {
  return statusCounts(items);
}

/** One flattened tree entry: the item plus its nesting depth. Pure. */
export type BoardTreeEntry = { item: BoardItem; depth: number };

/**
 * Depth-first, id-sorted flattening of the parent tree, through the shared
 * view-model (`treeEntries`, task-ui-shared-viewmodel). Roots are items whose
 * parent is absent/unknown (a malformed tree renders as roots instead of
 * disappearing); a cycle guard makes the walk total. Pure.
 */
export function boardTreeEntries(items: readonly BoardItem[]): BoardTreeEntry[] {
  return treeEntries(items);
}

/** Selection cursor over the flattened tree (pure state, index into the tree). */
export type BoardSelection = {
  /** Index in `boardTreeEntries` order; -1 when there is nothing to select. */
  index: number;
  /** Selected item id, null when the tree is empty. */
  id: string | null;
};

/** Movement tokens the panel keymap maps onto the selection. Pure. */
export type BoardSelectionMove = "up" | "down" | "page-up" | "page-down" | "first" | "last";

/**
 * Rows one PgUp/PgDn step moves. The host passes no height with the panel props
 * (`{name, sessionID, width, presentation, focused, …}`), so the page size is
 * this fixed, documented constant instead of a guess at the terminal height.
 */
export const BOARD_SELECTION_PAGE = 10;

/** Empty selection (no rows): every move stays empty, never throws. */
export function emptyBoardSelection(): BoardSelection {
  return { index: -1, id: null };
}

/** Clamp an index into the tree and materialize the selection (pure). */
function selectionAt(
  entries: readonly BoardTreeEntry[],
  index: number,
): BoardSelection {
  if (entries.length === 0) return emptyBoardSelection();
  const clamped = Math.min(Math.max(index, 0), entries.length - 1);
  return { index: clamped, id: entries[clamped]!.item.id };
}

/**
 * Resolve a selection against a freshly read tree (`r` reload): the same id
 * wins when the item still exists, otherwise the previous index is clamped to
 * the new tree, and an empty tree clears the selection. Pure.
 */
export function resolveBoardSelection(
  snapshot: BoardSnapshot,
  previous: BoardSelection,
): BoardSelection {
  const entries = boardTreeEntries(snapshot.items);
  if (entries.length === 0) return emptyBoardSelection();
  if (previous.id !== null) {
    const index = entries.findIndex((entry) => entry.item.id === previous.id);
    if (index >= 0) return { index, id: previous.id };
  }
  return selectionAt(entries, previous.index);
}

/** Move the selection by one token, clamped at both edges. Pure, total. */
export function moveBoardSelection(
  snapshot: BoardSnapshot,
  selection: BoardSelection,
  move: BoardSelectionMove,
): BoardSelection {
  const entries = boardTreeEntries(snapshot.items);
  if (entries.length === 0) return emptyBoardSelection();
  // -1 means "before the first line", so a first `j` lands on index 0.
  const current = selection.index < 0 ? -1 : Math.min(selection.index, entries.length - 1);
  switch (move) {
    case "first":
      return selectionAt(entries, 0);
    case "last":
      return selectionAt(entries, entries.length - 1);
    case "page-up":
      return selectionAt(entries, current - BOARD_SELECTION_PAGE);
    case "page-down":
      return selectionAt(entries, current + BOARD_SELECTION_PAGE);
    case "up":
      return selectionAt(entries, current - 1);
    case "down":
      return selectionAt(entries, current + 1);
  }
}

/**
 * Select an item id (the `n`/`a` jumps). Returns null when the id is absent
 * from the tree — the caller decides whether that is a no-op or a toast; pure.
 */
export function selectBoardItem(
  snapshot: BoardSnapshot,
  id: string | null,
): BoardSelection | null {
  const wanted = (id ?? "").trim();
  if (wanted === "") return null;
  const entries = boardTreeEntries(snapshot.items);
  const index = entries.findIndex((entry) => entry.item.id === wanted);
  return index < 0 ? null : { index, id: wanted };
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

/** Cursor cell marking the selected tree line (a fixed one-column gutter). */
export const BOARD_SELECTION_MARK = "❯";

/**
 * One tree line for an entry: selection cursor, indent, active marker, status
 * mark, badge, id, title. Every line carries the cursor cell (space when
 * unselected) so the tree never shifts when the selection moves.
 */
export function boardItemLine(
  entry: BoardTreeEntry,
  options: { selected?: boolean } = {},
): string {
  const { item, depth } = entry;
  const cursor = options.selected === true ? BOARD_SELECTION_MARK : " ";
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
    `${cursor}${indent}${active}${mark} ${badge} ${sanitizeHumanTextUncapped(item.id)}${blocked}${assignee}` +
    ` — ${sanitizeHumanTextUncapped(item.title)}${reason}`
  );
}

/** Rows shown in one inline detail block (body + acceptance share the budget). */
export const BOARD_DETAIL_MAX_ROWS = 16;

/** Raw characters per detail row, clipped before width clipping (hostile body). */
export const BOARD_DETAIL_MAX_LINE_CHARS = 200;

/**
 * Bounded, sanitized item read for the panel's inline detail block. Structured
 * rather than pre-rendered so the block (`boardDetailLines`) and its tests stay
 * pure; the id/title/path and every row are already sanitized here.
 */
export type BoardItemDetail = {
  id: string;
  /** Sanitized title, null when the read failed. */
  title: string | null;
  /** Sanitized absolute item path, null when the read failed. */
  path: string | null;
  /** Acceptance rows (`[ ]`/`[x]`), bounded by the row budget. */
  acceptance: string[];
  /** Prose rows with acceptance rows, comments and the leading H1 removed. */
  body: string[];
  /** Checked / total acceptance rows over the WHOLE checklist (not the slice). */
  acceptanceDone: number;
  acceptanceTotal: number;
  /** True when the row budget dropped content. */
  truncated: boolean;
  /** Sanitized single-line reason when the item could not be read; else null. */
  error: string | null;
};

/** `- [ ] text` / `- [x] text` markdown checklist row (kernel acceptance shape). */
const BOARD_ACCEPTANCE_ROW = /^\s*[-*]\s+\[([ xX])\]\s?(.*)$/;

/**
 * Split the item prose into acceptance rows and the remaining body rows. The
 * item template's HTML placement comment and the leading H1 (already shown as
 * `id — title` in the header) are authoring metadata, not content; blank runs
 * are collapsed so the row budget carries signal, not air. Pure.
 */
function splitBoardDetailRows(prose: string): { acceptance: string[]; body: string[] } {
  const acceptance: string[] = [];
  const body: string[] = [];
  for (const raw of prose.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/)) {
    const row = raw.replace(/\t/g, "  ").trimEnd();
    const check = BOARD_ACCEPTANCE_ROW.exec(row);
    if (check) {
      const mark = (check[1] ?? " ").toLowerCase() === "x" ? "x" : " ";
      const text = (check[2] ?? "").trimEnd();
      acceptance.push(text === "" ? `[${mark}]` : `[${mark}] ${text}`);
      continue;
    }
    if (body.length === 0 && acceptance.length === 0 && /^#\s+/.test(row)) continue;
    if (row.trim() === "") {
      if (body.length === 0 || body[body.length - 1] === "") continue;
      body.push("");
      continue;
    }
    body.push(row);
  }
  while (body.length > 0 && body[body.length - 1] === "") body.pop();
  return { acceptance, body };
}

/**
 * Read one item for the inline detail block through the kernel's bounded read
 * path (`runShow`: frontmatter + prose, comments excluded). Never throws and
 * never writes: a missing id, a corrupt tracker or any read failure degrades to
 * an error detail the panel renders. `rows` overrides the row budget (tests).
 */
export function boardItemDetail(
  cwd: string,
  id: string,
  options: { rows?: number } = {},
): BoardItemDetail {
  const requested = id.trim();
  const failed = (error: string): BoardItemDetail => ({
    id: requested,
    title: null,
    path: null,
    acceptance: [],
    body: [],
    acceptanceDone: 0,
    acceptanceTotal: 0,
    truncated: false,
    error: sanitizeHumanError(error),
  });
  if (requested === "") return failed("detail unavailable: no selected item");
  try {
    const shown = runShow({ cwd, id: requested });
    const { acceptance, body } = splitBoardDetailRows(shown.prose);
    const budget = Math.max(options.rows ?? BOARD_DETAIL_MAX_ROWS, 0);
    const shownAcceptance = acceptance.slice(0, budget);
    const shownBody = body.slice(0, Math.max(budget - shownAcceptance.length, 0));
    // Repo-controlled bytes: escape controls, then bound the raw length before
    // the panel's width clip (a hostile body cannot flood or forge a row).
    const row = (value: string): string =>
      clipBoardLine(sanitizeHumanTextUncapped(value), BOARD_DETAIL_MAX_LINE_CHARS);
    return {
      id: requested,
      title: sanitizeHumanTextUncapped(shown.item.title ?? requested),
      path: sanitizeHumanTextUncapped(shown.path),
      acceptance: shownAcceptance.map(row),
      body: shownBody.map(row),
      acceptanceDone: acceptance.filter((entry) => entry.startsWith("[x]")).length,
      acceptanceTotal: acceptance.length,
      truncated: acceptance.length + body.length > budget,
      error: null,
    };
  } catch (error) {
    return failed(`detail unavailable: ${detail(error)}`);
  }
}

/** Render the bounded, sanitized detail block (no ANSI, no writes). Pure. */
export function boardDetailLines(
  detail: BoardItemDetail,
  options: { width?: number } = {},
): string[] {
  const width = options.width ?? 0;
  const clip = (line: string): string => (width > 0 ? clipBoardLine(line, width) : line);
  if (detail.error !== null) {
    return [clip(`  ┌ argon detail · ${detail.id}`), clip(`  └ ${detail.error}`)];
  }
  const lines = [clip(`  ┌ argon detail · ${detail.id} — ${detail.title ?? detail.id}`)];
  // Blank body rows keep the prose rhythm without trailing whitespace.
  const row = (value: string): string => (value === "" ? "  │" : `  │ ${value}`);
  for (const entry of detail.acceptance) lines.push(clip(row(entry)));
  for (const entry of detail.body) lines.push(clip(row(entry)));
  if (detail.truncated) lines.push(clip("  │ … more row(s) omitted"));
  const acceptance =
    detail.acceptanceTotal > 0
      ? `${detail.acceptanceDone}/${detail.acceptanceTotal} acceptance`
      : "no acceptance rows";
  const path = detail.path !== null ? ` · ${detail.path}` : "";
  lines.push(clip(`  └ ${acceptance}${path} · esc returns`));
  return lines;
}

/** Panel render options: width/entry cap plus the live selection and detail. */
export type BoardTreeOptions = {
  width?: number;
  limit?: number;
  /** Selection cursor; null/absent when the panel has no selection. */
  selection?: BoardSelection | null;
  /** Detail block to embed directly under its item's tree line. */
  detail?: BoardItemDetail | null;
};

/**
 * Plain-text panel body (no ANSI): header, counters, tree and — under the
 * selected line — the bounded detail block. The tree window follows the
 * selection so a jump never targets an invisible line; the tail cap keeps the
 * `… N more item(s)` behavior (a head marker appears only when the window slid).
 * Pure.
 */
export function boardTreeLines(
  snapshot: BoardSnapshot,
  options: BoardTreeOptions = {},
): string[] {
  const width = options.width ?? 0;
  const limit = options.limit ?? 200;
  const clip = (line: string): string => (width > 0 ? clipBoardLine(line, width) : line);
  const lines = [clip(boardHeaderLine(snapshot))];
  if (snapshot.error !== null) return lines;
  lines.push(clip(boardCountsLine(snapshot)));
  const entries = boardTreeEntries(snapshot.items);
  const cap = Math.max(limit, 0);
  const selected = options.selection?.index ?? -1;
  // Window follows the selection minimally (the CLI TUI's followScroll rule):
  // start 0 until the cursor passes the cap, then slide just enough.
  const start =
    cap > 0 && selected >= cap
      ? Math.min(selected - cap + 1, Math.max(entries.length - cap, 0))
      : 0;
  if (start > 0) lines.push(clip(`… ${start} earlier item(s)`));
  const visible = entries.slice(start, start + cap);
  visible.forEach((entry, offset) => {
    const index = start + offset;
    lines.push(clip(boardItemLine(entry, { selected: index === selected })));
    if (options.detail != null && options.detail.id === entry.item.id) {
      for (const row of boardDetailLines(options.detail)) lines.push(clip(row));
    }
  });
  const hidden = entries.length - start - visible.length;
  if (hidden > 0) lines.push(clip(`… ${hidden} more item(s)`));
  return lines;
}

/**
 * Short status line for the sidebar contribution: the active item when the
 * session resolves one, else the tracker's ready signal. Pure.
 *
 * The ready count is the kernel's own definition — `isClaimable(type)` +
 * `todo` + unclaimed + `isReady` (deps terminal) — shared through the
 * view-model (`readyTodoCount`), so it cannot drift from the kernel. `next`
 * narrows the pool to leaf work, so the count can exceed what `/arggon-next`
 * would suggest.
 */
export function sidebarStatusLine(snapshot: BoardSnapshot, width = 0): string {
  const clip = (line: string): string => (width > 0 ? clipBoardLine(line, width) : line);
  if (snapshot.error !== null) return clip("arggon · no tracker");
  const active = snapshot.items.find((item) => item.id === snapshot.activeId);
  if (active !== undefined) {
    return clip(`arggon ▶ ${sanitizeHumanTextUncapped(active.id)} ${active.status}`);
  }
  // Kernel readiness (isClaimable + isReady), shared through the view-model.
  const ready = readyTodoCount(snapshot.items);
  const next =
    snapshot.nextId !== null ? ` · next ${sanitizeHumanTextUncapped(snapshot.nextId)}` : "";
  return clip(`arggon · ${ready} ready${next}`);
}
