/**
 * Terminal UI kanban (`arggon board --tui`) — story-tui-board / task-tui-board /
 * task-tui-detail-pane.
 *
 * Read-only interactive view over the same kernel read path as `list --json`
 * and the HTML board (loadItems -> toContractWorkItem). Dependency-light per
 * ADR 0001: raw ANSI escapes (clear/home, SGR colors, alternate screen), no
 * TUI framework, zero new npm dependencies.
 *
 * Hygiene split (task-tui-board / task-tui-detail-pane): every pure piece lives
 * here as an exported function — `renderTui` (board frame -> string),
 * `renderTuiDetail` + `buildTuiDetailLines` (detail pane frame + content),
 * `renderTuiScreen` (the loop's dispatcher), `handleKey` (keypress reducer for
 * both modes), `clampTuiState` (board selection bounds), `followTuiScroll` +
 * `clampTuiDetailScroll` (the two scroll windows), `wrapTuiLine`,
 * `tuiAcceptanceRows`, `tuiDependencySummary`, `tuiBodyRows` +
 * `tuiDetailBodyRows` (frame geometry), `loadTuiItems` (shared data path,
 * detail bodies included), `createTuiKeyDecoder` (the stateful stdin
 * splitter, bug-tui-split-escape-sequences), `formatTuiClock` (the footer
 * freshness stamp), `fsWatchTuiWatcher` (the default tracker watcher,
 * task-tui-live-refresh), `tuiViewItems` / `applyTuiSort` / `nextTuiSort`
 * (the sort + ready-only lens, task-tui-sort-ready-lens), `tuiLensFilter` /
 * `tuiViewOptions` (the filter prompt over the kernel filter language and the
 * `x-views` saved views, task-tui-filter-language) and `tuiActionVerdict` /
 * `tuiLegalMoves` / `handleActionKey` (the claim/move action flows,
 * task-tui-actions-parity). `runTuiBoard` wires raw mode, keypress events,
 * resize and the debounced tree watcher to the pure pieces; its ONLY write is
 * the one kernel `runUpdate` call per finished action flow — never force,
 * never steal (spec-tui-actions-014).
 */
import { watch } from "node:fs";
import {
  STATUSES,
  applyViewFilter,
  buildStatusIndex,
  canTransition,
  findTasksDir,
  hasOpenDependencies,
  isClaimable,
  isReadyTodo,
  itemsForStatus,
  loadItems,
  matchesSubstringFilter,
  readConventionConfig,
  repoRootFromTasks,
  resolveCurrentLogin,
  runUpdate,
  sanitizeHumanTextUncapped,
  sortById,
  sortByNextRank,
  sortByPriority,
  statusCounts,
  toContractWorkItem,
  visibleItems,
  type ContractWorkItem as WorkItem,
} from "@arggondev/lib";

/** Default geometry when the terminal size cannot be queried. */
export const TUI_DEFAULT_WIDTH = 80;
export const TUI_DEFAULT_HEIGHT = 24;

/** Board card order, cycled with `s` (task-tui-sort-ready-lens). */
export type TuiSort = "id" | "priority" | "next";

/** The sort cycle order: id -> priority -> next -> id. */
export const TUI_SORTS: readonly TuiSort[] = ["id", "priority", "next"];

/** The next sort in the cycle (`s` key). Pure. */
export function nextTuiSort(sort: TuiSort): TuiSort {
  const index = TUI_SORTS.indexOf(sort);
  return TUI_SORTS[(index + 1) % TUI_SORTS.length]!;
}

/**
 * Narrow-terminal threshold for the detail pane (task-tui-detail-pane). At or
 * above this width the pane packs related fields on one line (`type: … ·
 * status: …`); below it the packed lines wrap mid-pair and read as noise, so
 * the pane falls back to a stacked layout: one field per line, values wrapped
 * (never clipped) to the terminal width.
 */
export const TUI_DETAIL_NARROW_WIDTH = 40;

/**
 * Source body lines the detail pane renders before marking the rest truncated.
 * The pane is a read view, not an editor: the cap keeps a hostile or
 * comment-heavy body (this repo's items grow ~226 B per comment, forever)
 * from making every frame render the whole file. The marker line names the
 * cap and the omitted count, so nothing is silently dropped.
 */
export const TUI_DETAIL_MAX_BODY_LINES = 400;

/**
 * Hard cap on rendered detail lines (title + fields + acceptance + body,
 * after wrapping). Bounds the per-keypress render cost independently of the
 * body sizes on disk; when hit, a marker line says so.
 */
export const TUI_DETAIL_MAX_LINES = 1000;

/** One-letter type badge per v0 type (I/E/S/T/B). */
export const TYPE_BADGES: Record<WorkItem["type"], string> = {
  initiative: "I",
  epic: "E",
  story: "S",
  task: "T",
  bug: "B",
};

/**
 * Body source for the detail pane (task-tui-detail-pane). The kernel read path
 * that feeds the board (`loadItems`) already parses every file, body included;
 * `loadTuiItems` keeps the body beside the contract item instead of paying a
 * second file read when Enter opens the pane. Read-only: nothing here is ever
 * written back.
 */
export type TuiDetailSource = {
  /** Item id (filename stem). */
  id: string;
  /** Raw markdown body (frontmatter excluded; comments included). */
  body: string;
};

/**
 * Detail-pane mode state (task-tui-detail-pane): which item is open and the
 * pane's scroll window. Board state (column/card/scroll/filter) is untouched
 * while a pane is open, so Esc/Enter returns to exactly the same board.
 */
export type TuiDetailState = {
  /** Id of the item being read. */
  id: string;
  /**
   * Index of the first content line drawn, in wrapped display lines. Clamped
   * per render against the real line count (clampTuiDetailScroll), so a stale
   * value or a resize still renders a valid window.
   */
  scroll: number;
};

/**
 * One action flow (task-tui-actions-parity): the selected item, the pending
 * write and the prompt stage. The reducer builds it purely; the loop executes
 * it exactly once at the `apply` stage through the kernel `runUpdate` and then
 * clears it. `esc` cancels from any stage with nothing written.
 */
export type TuiActionState = {
  /** Item id the flow acts on. */
  id: string;
  type: WorkItem["type"];
  /** Status the item had when the flow opened (the kernel re-checks at apply). */
  from: WorkItem["status"];
  /** Claim holder at flow open (null = unclaimed). */
  claimedBy: string | null;
  /** True when the flow started from `c` (claim wording in the messages). */
  claim: boolean;
  stage: "move" | "reason" | "assignee" | "confirm" | "apply";
  /** Target status (in_progress for a claim). */
  status: WorkItem["status"];
  /** Decided assignee (null = the write carries none). */
  assignee: string | null;
  /** Decided blocked reason (blocked moves only). */
  blockedReason: string | null;
  /** Cursor over the legal-target menu (move stage). */
  cursor: number;
  /** Input draft for the reason/assignee prompts. */
  draft: string;
  /** Inline refusal inside the flow (e.g. an empty reason). */
  error: string | null;
};

/**
 * An active saved view (task-tui-filter-language): the `x-views` view name and
 * the resolved expression it stands for. The expression rides in the state so
 * the pure renderer and reducer never need the convention file; the loop
 * refreshes it per sync like every other tracker read.
 */
export type TuiView = {
  /** View name in the tracker `.convention.yml` `x-views` map. */
  name: string;
  /** The view's filter expression. */
  expr: string;
};

/**
 * One saved view as the keymap sees it (task-tui-filter-language): the view
 * pre-validated against the loaded tree (`applyViewFilter`). An invalid view
 * (a malformed expression, an unknown enum value, an unresolvable `@me`) is
 * refused with its `error` as an inline hint instead of crashing the frame or
 * silently matching nothing.
 */
export type TuiViewOption = TuiView & {
  ok: boolean;
  /** Refusal message when `ok` is false. */
  error?: string;
};

/** Verdict of the search prompt draft, computed by the loop against the tree. */
export type TuiFilterVerdict = { ok: true } | { ok: false; error: string };

export type TuiState = {
  width: number;
  height: number;
  /** Index into STATUSES. */
  column: number;
  /** Index within the selected column's filtered items. */
  card: number;
  /**
   * Scroll window: index of the first card drawn in the selected column
   * (bug-tui-selection-offscreen). Always clamped so the selected card is
   * visible, the window never pages past the end and no empty rows are shown
   * while the column has items; see `followTuiScroll`.
   */
  scroll: number;
  /** Active search filter (free text + kernel predicates; see tuiLensFilter). */
  filter: string;
  /** Whether the `/` search prompt is open. */
  searching: boolean;
  /**
   * Inline refusal for the prompt draft (task-tui-filter-language): shown at
   * the prompt until the draft changes or Esc/Enter resolves it. An invalid
   * expression never replaces the active filter.
   */
  filterError: string | null;
  /**
   * Active saved view (`v` cycles the tracker `x-views`, task-tui-filter-language).
   * Its expression ANDs with the manual filter (like `list --view` + `--filter`).
   */
  view: TuiView | null;
  /**
   * Card order within each column (task-tui-sort-ready-lens): `s` cycles
   * `id` -> `priority` -> `next` (ready first, ADR 0009 tier, downstream
   * weight, id on ties).
   */
  sort: TuiSort;
  /**
   * Ready-only lens (task-tui-sort-ready-lens): `l` shows only pullable work
   * — claimable unclaimed todo with terminal dependencies (the kernel
   * `isReadyTodo` rule) — hiding everything else in every column.
   */
  readyOnly: boolean;
  /** Transient footer line (e.g. "(no item selected)" after Enter). */
  message: string | null;
  /**
   * Epoch ms of the tracker read behind the rendered frame — the footer
   * freshness stamp (`updated HH:MM:SS`, task-tui-live-refresh). `null` before
   * the first read (tests build states without a clock); the loop stamps every
   * re-read, keypress- or watcher-triggered alike.
   */
  updatedAt: number | null;
  /**
   * Open detail pane (`null` = the board is the view) — task-tui-detail-pane.
   * Read-only: the pane has no update path, it only reads the loaded items.
   */
  detail: TuiDetailState | null;
  /**
   * Help overlay (`?`, task-tui-help-vim-keys): a modal frame listing every
   * key grouped by purpose. `esc` (or `?` again) closes it; the board state
   * behind it is untouched.
   */
  help: boolean;
  /**
   * Open action flow (`c` claim / `m` move, task-tui-actions-parity).
   * `null` = the board is view-only. Modal: no board key reaches the board
   * while a flow is open, and `esc` cancels with nothing written.
   */
  action: TuiActionState | null;
  /** Set by `q` / Ctrl-C; the loop exits when true. */
  quit: boolean;
};

export function initialTuiState(
  width: number = TUI_DEFAULT_WIDTH,
  height: number = TUI_DEFAULT_HEIGHT,
): TuiState {
  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
    column: 0,
    card: 0,
    scroll: 0,
    filter: "",
    searching: false,
    filterError: null,
    view: null,
    sort: "id",
    readyOnly: false,
    message: null,
    updatedAt: null,
    detail: null,
    help: false,
    action: null,
    quit: false,
  };
}

/**
 * Items feeding the TUI: same kernel read path as the HTML board, sorted
 * lexicographically by id (same rule as renderBoardHtml / list), through the
 * shared view-model — plus the raw bodies the detail pane reads
 * (task-tui-detail-pane), keyed by id. Both come from the same `loadItems`
 * pass, so the board and the pane can never disagree about an item. The
 * resolved tracker dir travels along so the loop can watch it
 * (task-tui-live-refresh) without a second `findTasksDir` walk.
 */
export function loadTuiItems(cwd: string): {
  root: string;
  tasksDir: string;
  items: WorkItem[];
  details: Map<string, TuiDetailSource>;
} {
  const tasksDir = findTasksDir(cwd);
  const root = repoRootFromTasks(tasksDir);
  const kernelItems = sortById(loadItems(tasksDir));
  const items = kernelItems.map((item) => toContractWorkItem(item, root));
  const details = new Map<string, TuiDetailSource>(
    kernelItems.map((item) => [item.id, { id: item.id, body: item.body }]),
  );
  return { root, tasksDir, items, details };
}

/**
 * The tracker's saved views (`x-views` in `.convention.yml`), name-sorted for
 * deterministic `v` cycling, each pre-validated against the loaded tree with
 * the display filter (task-tui-filter-language). A missing or malformed
 * convention file degrades to no views (the board stays usable — the same
 * transparent degradation as the watcher); an individual invalid expression
 * comes back as `ok: false` with the kernel's error so `v` can show it inline
 * instead of crashing or silently matching nothing. `@me` resolves lazily
 * through `resolveMe` (the caller memoizes; the kernel rule).
 */
export function tuiViewOptions(
  root: string,
  items: WorkItem[],
  resolveMe?: () => string | null,
): TuiViewOption[] {
  let views: Record<string, string>;
  try {
    ({ views } = readConventionConfig(root));
  } catch {
    return []; // no/malformed convention: no views, everything else unchanged
  }
  return Object.keys(views)
    .sort()
    .map((name) => {
      const expr = views[name]!;
      const verdict = applyViewFilter(items, expr, { resolveMe });
      return verdict.ok
        ? { name, expr, ok: true }
        : { name, expr, ok: false, error: verdict.error };
    });
}

/**
 * Local `HH:MM:SS` for the footer freshness stamp (task-tui-live-refresh).
 * Non-finite input renders as `--:--:--` so a broken clock degrades the stamp,
 * never the frame.
 */
export function formatTuiClock(ms: number): string {
  if (!Number.isFinite(ms)) return "--:--:--";
  const date = new Date(ms);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Minimal watcher handle the loop needs (fs.watch's FSWatcher satisfies it). */
export type TuiTreeWatcher = { close(): void };

/**
 * Opens a watcher on the tracker dir; `onEvent` fires (possibly many times)
 * per file change burst and the loop debounces the re-read. Returns `null`
 * when watching is unavailable (platform or filesystem limitation) — the loop
 * then degrades transparently to per-keypress reads.
 */
export type TuiWatchFactory = (tasksDir: string, onEvent: () => void) => TuiTreeWatcher | null;

/**
 * How long a watcher burst must stay quiet before the loop re-reads the tree
 * (task-tui-live-refresh). Same value as `board --serve`'s reload debounce —
 * the pattern this reuses.
 */
export const TUI_REFRESH_DEBOUNCE_MS = 100;

/**
 * The default tracker watcher (task-tui-live-refresh): a recursive
 * `fs.watch` on the tracker dir. A watcher that cannot be opened returns
 * `null`; one that fails later (its `error` event) closes itself — either way
 * the loop falls back to per-keypress reads without ever crashing or exiting.
 * Watch callbacks are guarded: a failing callback must not kill the loop.
 */
export function fsWatchTuiWatcher(tasksDir: string, onEvent: () => void): TuiTreeWatcher | null {
  try {
    const watcher = watch(tasksDir, { recursive: true }, () => {
      try {
        onEvent();
      } catch {
        // A refresh failure is never fatal (the next event retries); the loop
        // keeps reading on keypresses regardless.
      }
    });
    watcher.on("error", () => {
      try {
        watcher.close();
      } catch {
        // Already closed.
      }
    });
    return watcher;
  } catch {
    return null; // recursive watch unavailable here: transparent degradation
  }
}

/** Case-insensitive substring match on id or title (empty filter matches all). */
export function tuiFilterMatches(item: WorkItem, filter: string): boolean {
  return matchesSubstringFilter(item, filter);
}

/** Filtered + lexicographically sorted items (the cards the TUI renders). */
export function visibleTuiItems(items: WorkItem[], filter: string): WorkItem[] {
  return visibleItems(items, filter);
}

/** Items of one column, filtered. */
export function tuiColumnItems(items: WorkItem[], filter: string, status: string): WorkItem[] {
  return itemsForStatus(items, filter, status);
}

/**
 * The display lens the board renders through (task-tui-sort-ready-lens plus
 * task-tui-filter-language): the manual filter expression, the active saved
 * view, the card order and the ready-only toggle. `TuiState` satisfies it
 * structurally; the pure helpers take it so tests can drive the lens without
 * a full state.
 */
export type TuiLens = {
  filter: string;
  view?: TuiView | null;
  sort: TuiSort;
  readyOnly: boolean;
};

/**
 * The lens' full filter expression: the active saved view ANDed with the
 * manual filter — the same semantics as `list --view <name> --filter <expr>`
 * (predicates and free-text needles AND; tokens stay whitespace-separated, so
 * concatenating the two expressions is exactly the conjunction).
 */
export function tuiLensFilter(lens: Pick<TuiLens, "filter" | "view">): string {
  return [lens.view?.expr ?? "", lens.filter]
    .map((expr) => expr.trim())
    .filter((expr) => expr !== "")
    .join(" ");
}

/**
 * The board's card set for one lens (task-tui-sort-ready-lens +
 * task-tui-filter-language): the filter expression — view AND manual — through
 * the kernel parser (`applyViewFilter`, computed indexes over the whole tree),
 * narrowed to pullable work when the ready-only lens is on. Readiness is the
 * kernel `isReadyTodo` rule computed over the WHOLE tree (a filtered-out
 * dependency must not look unknown — the `applyViewLens` rule), so a filter
 * cannot change what counts as ready. Id-ordered (the caller sorts further).
 */
function tuiLensItems(items: WorkItem[], lens: TuiLens): WorkItem[] {
  const sorted = sortById(items);
  const verdict = applyViewFilter(sorted, tuiLensFilter(lens));
  // A lens state that bypassed validation (never produced by the keymap) must
  // not crash the frame: it degrades to no filter, the prompt path is where
  // refusals surface.
  const visible = verdict.ok ? verdict.items : sorted;
  if (!lens.readyOnly) return visible;
  const byId = buildStatusIndex(items);
  return visible.filter((item) => isReadyTodo(item, byId));
}

/**
 * The cards the board renders for one lens, in the lens' sort order
 * (task-tui-sort-ready-lens): `id` (lexicographic), `priority` (ADR 0009
 * tier, id on ties) or `next` (ready first, tier, downstream weight, id).
 * The order applies per column: columns are status slices of this array, so
 * sorting the whole set once orders every column the same way.
 */
export function tuiViewItems(items: WorkItem[], lens: TuiLens): WorkItem[] {
  return applyTuiSort(tuiLensItems(items, lens), lens.sort);
}

/**
 * One sort applied on its own (public for tests): `id` restores the
 * canonical lexicographic order, `priority` and `next` delegate to the
 * kernel orderings. Pure; copies.
 */
export function applyTuiSort<T extends WorkItem>(items: readonly T[], sort: TuiSort): T[] {
  if (sort === "priority") return sortByPriority(items);
  if (sort === "next") return sortByNextRank(items);
  return sortById(items);
}

/**
 * True when the item has open dependencies (dep not done/cancelled; unknown
 * dep ids count as open — the shared view-model rule, ADR 0004).
 */
export function tuiDepBlocked(items: WorkItem[], item: WorkItem): boolean {
  if (item.depends_on.length === 0) return false;
  return hasOpenDependencies(item.depends_on, buildStatusIndex(items));
}

/**
 * Visible card count per status, aligned with STATUSES (for key clamping).
 * Reflects the full lens (task-tui-sort-ready-lens + task-tui-filter-language):
 * the saved view, the filter expression and the ready-only toggle — clamping
 * and rendering see the same card set.
 */
export function tuiColumnCounts(items: WorkItem[], lens: TuiLens): number[] {
  const counts = statusCounts(tuiLensItems(items, lens));
  return STATUSES.map((status) => counts[status]);
}

/**
 * Body rows available for cards: the frame spends one line on the header, one
 * on the column headers and one on the footer (renderTui's geometry).
 */
export function tuiBodyRows(height: number): number {
  const value = Math.floor(height);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value - 3);
}

/**
 * Content rows of the detail pane: its frame spends one line on the pane
 * header and one on the pane footer (renderTuiDetail's geometry).
 */
export function tuiDetailBodyRows(height: number): number {
  const value = Math.floor(height);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value - 2);
}

/**
 * Pane scroll window: index of the first content line drawn for `lines`
 * wrapped display lines in a `rows`-high viewport (task-tui-detail-pane). Same
 * invariants as `followTuiScroll` without a selection to follow: never
 * negative, never past the end (at most the last page is shown, so PgDn/End
 * cannot overshoot) and 0 while the content fits or is empty. Degenerate sizes
 * return 0.
 */
export function clampTuiDetailScroll(scroll: number, lines: number, rows: number): number {
  const total = Math.max(0, Math.floor(lines) || 0);
  const height = Math.max(0, Math.floor(rows) || 0);
  if (total === 0 || height === 0) return 0;
  const value = Math.floor(scroll);
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), Math.max(0, total - height));
}

/**
 * Scroll window start (index of the first card drawn in the selected column)
 * for `count` cards with a `rows`-high viewport, keeping `card` visible
 * (bug-tui-selection-offscreen). The window follows the selection minimally —
 * it only moves when the card would leave it — and is always valid:
 *
 * - never past the end (`scroll <= max(0, count - rows)`, so at most the last
 *   page is shown and `PgDn`/`End` cannot overshoot), and
 * - never empty while cards exist (`scroll` is pulled back so a full window is
 *   drawn whenever `count >= rows`).
 *
 * Degenerate sizes return 0. Pure: no clamping of the selection itself (the
 * caller owns `card`).
 */
export function followTuiScroll(card: number, scroll: number, count: number, rows: number): number {
  const total = Math.max(0, Math.floor(count) || 0);
  const height = Math.max(0, Math.floor(rows) || 0);
  if (total === 0 || height === 0) return 0;
  const maxScroll = Math.max(0, total - height);
  const selected = Math.min(Math.max(Math.floor(card) || 0, 0), total - 1);
  let next = Math.min(Math.max(Math.floor(scroll) || 0, 0), maxScroll);
  if (selected < next) next = selected;
  else if (selected >= next + height) next = Math.min(selected - height + 1, maxScroll);
  return next;
}

/**
 * Clamp the selection and the scroll window against real column sizes (used
 * after filters change, a resize or a tree re-read; either may otherwise point
 * past the end or render an empty page).
 */
export function clampTuiState(state: TuiState, counts: number[]): TuiState {
  const column = Math.min(Math.max(state.column, 0), Math.max(STATUSES.length - 1, 0));
  const count = counts[column] ?? 0;
  const card = count === 0 ? 0 : Math.min(Math.max(state.card, 0), count - 1);
  const scroll = followTuiScroll(card, state.scroll, count, tuiBodyRows(state.height));
  return { ...state, column, card, scroll };
}

/** Currently selected item, or null when its column is empty/filtered out. */
export function selectedTuiItem(items: WorkItem[], state: TuiState): WorkItem | null {
  // The same lens + sort the frame renders (task-tui-sort-ready-lens): the
  // card under the cursor must be the card the column draws.
  const columnItems = tuiViewItems(items, state).filter(
    (item) => item.status === STATUSES[state.column],
  );
  return columnItems[state.card] ?? null;
}

const ARROW_LEFT = "\x1b[D";
const ARROW_RIGHT = "\x1b[C";
const ARROW_UP = "\x1b[A";
const ARROW_DOWN = "\x1b[B";
const PAGE_UP = "\x1b[5~";
const PAGE_DOWN = "\x1b[6~";
/** Home variants: xterm (`\x1b[H`), vt220 (`\x1b[1~`), rxvt (`\x1b[7~`). */
const HOME_KEYS = new Set(["\x1b[H", "\x1b[1~", "\x1b[7~"]);
/** End variants: xterm (`\x1b[F`), vt220 (`\x1b[4~`), rxvt (`\x1b[8~`). */
const END_KEYS = new Set(["\x1b[F", "\x1b[4~", "\x1b[8~"]);
const CTRL_C = "\x03";
const ESC = "\x1b";
const ENTER = "\r";
const BACKSPACE = "\x7f";

/**
 * How long `runTuiBoard` waits for the rest of a split escape sequence before
 * flushing the buffered bytes as plain keys (bug-tui-split-escape-sequences).
 * The classic terminal-emulator esc-timeout tradeoff: long enough that a pty
 * bridge or a paste delivering `\x1b` and `[6~` in separate chunks still
 * reassembles, far short of human key spacing so a genuinely lone Esc press
 * registers immediately.
 */
export const TUI_ESCAPE_FLUSH_MS = 50;

/**
 * Stateful stdin key splitter (bug-tui-split-escape-sequences). The pure
 * `splitKeys` rule, carried across chunks: a CSI sequence that is incomplete
 * at the end of a chunk (`\x1b` alone, or `\x1b[6` without its final byte) is
 * held back instead of being consumed as an Esc keypress, and the next chunk
 * completes it. Three exits release the held bytes:
 *
 * - a continuation completes the sequence (`decode("~")` after `\x1b[6` =>
 *   one PgDn key),
 * - any other byte proves the ESC was on its own (the held ESC is emitted as
 *   a real Esc key first, then the new bytes are split), or
 * - `flush()` drains the hold as plain per-character keys when no
 *   continuation arrives (the loop wires this to the
 *   `TUI_ESCAPE_FLUSH_MS` timeout), so a genuinely lone Esc keeps its
 *   semantics.
 */
export type TuiKeyDecoder = {
  /** Feed one stdin chunk; returns the complete keystrokes it holds. */
  decode(chunk: string): string[];
  /** Drain a held-back incomplete sequence as plain per-character keys. */
  flush(): string[];
  /** The incomplete trailing sequence held for the next chunk ("" when none). */
  readonly pending: string;
};

export function createTuiKeyDecoder(): TuiKeyDecoder {
  let held = "";
  return {
    decode(chunk: string): string[] {
      const buffer = held + chunk;
      held = "";
      const keys: string[] = [];
      let i = 0;
      while (i < buffer.length) {
        if (buffer[i] === ESC && buffer[i + 1] === "[") {
          let end = i + 2;
          while (
            end < buffer.length &&
            buffer.charCodeAt(end) >= 0x20 &&
            buffer.charCodeAt(end) <= 0x3f
          ) {
            end += 1;
          }
          if (end >= buffer.length) {
            // Incomplete trailing CSI: hold it for the next chunk instead of
            // consuming the ESC as an Esc keypress.
            held = buffer.slice(i);
            return keys;
          }
          if (buffer.charCodeAt(end) >= 0x40 && buffer.charCodeAt(end) <= 0x7e) {
            keys.push(buffer.slice(i, end + 1));
            i = end + 1;
            continue;
          }
          // A control byte inside the run: not a CSI after all. Fall through
          // and emit the lone ESC (splitKeys' exact behavior for this input).
        } else if (buffer[i] === ESC && i + 1 >= buffer.length) {
          // Lone trailing ESC: it may grow a CSI sequence next chunk.
          held = buffer.slice(i);
          return keys;
        }
        keys.push(buffer[i]);
        i += 1;
      }
      return keys;
    },
    flush(): string[] {
      const rest = held;
      held = "";
      return splitKeys(rest);
    },
    get pending(): string {
      return held;
    },
  };
}

/**
 * Optional per-keypress context: the loop owns the data, the reducer stays
 * pure. `counts` are the visible card counts per status (tuiColumnCounts);
 * `selectedId` is the board card under the cursor (Enter opens its pane);
 * `detailLines` is the open pane's total display line count (without it the
 * pane reducer cannot clamp the window, so PgUp/PgDn fall back to unbounded
 * moves for pure tests). `views` are the pre-validated saved views
 * (tuiViewOptions; only computed for `v` presses) and `filterVerdict` the
 * prompt draft's verdict against the tree (only computed while searching);
 * without them `v` reports no views and Enter applies the draft unvalidated —
 * the pure-reducer test path.
 */
export type TuiKeyContext = {
  counts?: number[];
  selectedId?: string | null;
  detailLines?: number;
  /** The full selected item (`c`/`m` read it; null when its column is empty). */
  selected?: WorkItem | null;
  /** Prefill for assignee prompts: the loop's resolved login (may be null). */
  suggestedAssignee?: string | null;
  views?: readonly TuiViewOption[];
  filterVerdict?: TuiFilterVerdict;
};

/**
 * Pure keypress reducer (board, detail pane and action flow). Board: Enter
 * opens the read-only detail pane for the selected item (task-tui-detail-pane),
 * Esc clears the filter and the saved view, `s` cycles the card order and `l`
 * toggles the ready-only lens (task-tui-sort-ready-lens), `v` cycles the
 * tracker's saved views (task-tui-filter-language), `c` opens the claim flow
 * and `m` the legal-move flow (task-tui-actions-parity), card moves keep the
 * scroll window following the selection whenever `counts` carries the selected
 * column. The `/` prompt applies its draft through the loop's verdict: an
 * invalid expression stays at the prompt with the kernel's error inline.
 * Detail pane: Esc and Enter return to the board with every board field
 * untouched, ↑/↓ and PgUp/PgDn/Home/End scroll the pane, q quits. The action
 * flow is modal: the reducer only advances its stages, the loop performs the
 * single runUpdate at the `apply` stage. Never mutates the input state.
 */
export function handleKey(state: TuiState, key: string, ctx: TuiKeyContext = {}): TuiState {
  // Ctrl-C quits from anywhere: pane, search prompt, help overlay and action
  // flow included.
  if (key === CTRL_C) return { ...state, quit: true };
  // The help overlay is modal (task-tui-help-vim-keys): esc or ? closes it,
  // nothing else reaches the board.
  if (state.help) {
    if (key === ESC || key === "?") return { ...state, help: false };
    return state;
  }
  if (state.detail !== null) return handleDetailKey(state, key, ctx.detailLines ?? 0);
  // The action flow is modal (task-tui-actions-parity): no board key reaches
  // the board while it is open.
  if (state.action !== null) {
    return handleActionKey(state, key, ctx.suggestedAssignee ?? null);
  }

  const counts = ctx.counts ?? [];

  if (state.searching) {
    if (key === ESC) {
      // Cancel the prompt and clear the lens with it (task-tui-filter-language):
      // the draft dies, and the applied filter/view go too (Esc clears the
      // filter/view).
      return {
        ...state,
        searching: false,
        filter: "",
        view: null,
        filterError: null,
        message: null,
      };
    }
    if (key === ENTER || key === "\n") {
      // Apply the draft — unless the loop's verdict refused it: an invalid
      // expression stays at the prompt with the kernel's error inline, and
      // the previous lens stays active (never a crash, never a silent
      // match-nothing; task-tui-filter-language).
      if (ctx.filterVerdict !== undefined && !ctx.filterVerdict.ok) {
        return { ...state, filterError: ctx.filterVerdict.error };
      }
      return { ...state, searching: false, filterError: null };
    }
    if (key === BACKSPACE || key === "\b") {
      return { ...state, filter: state.filter.slice(0, -1), filterError: null };
    }
    if (key.length === 1 && key >= " ") {
      return { ...state, filter: state.filter + key, filterError: null };
    }
    return state;
  }

  switch (key) {
    case "q":
      return { ...state, quit: true };
    case "/":
      return { ...state, searching: true, message: null };
    case "s":
      // Cycle the card order (task-tui-sort-ready-lens): id -> priority ->
      // next -> id. The card index keeps its value; the post-key sync clamps
      // it against the re-sorted column.
      return { ...state, sort: nextTuiSort(state.sort), message: null };
    case "L":
      // Toggle the ready-only lens (task-tui-sort-ready-lens): pullable work
      // only. The post-key sync clamps the selection against the narrowed
      // columns. (Shift-L since task-tui-help-vim-keys: lowercase `l` is the
      // vim right motion.)
      return { ...state, readyOnly: !state.readyOnly, message: null };
    case "?":
      // Help overlay (task-tui-help-vim-keys): every key, grouped.
      return { ...state, help: true, message: null };
    case "c":
      // Claim the selected item (task-tui-actions-parity): the assignee prompt
      // opens only when the kernel rules allow the claim; the loop applies it
      // through runUpdate.
      return openClaimAction(state, ctx.selected ?? null, ctx.suggestedAssignee ?? null);
    case "m":
      // Move the selected item (task-tui-actions-parity): menu of kernel-legal
      // targets, prompts, confirmation — one runUpdate at the apply stage.
      return openMoveAction(state, ctx.selected ?? null);
    case "v":
      // Cycle the saved views (task-tui-filter-language): the view expression
      // ANDs with the manual filter; the post-key sync clamps the selection.
      return cycleTuiView(state, ctx.views ?? []);
    case "r":
      // Forced refresh (task-tui-live-refresh): the reducer stays pure — the
      // loop re-reads the tree after every key batch, so acknowledging the key
      // (and clearing a stale transient message) is all the state change
      // needed for the next frame to carry fresh data.
      return { ...state, message: null };
    case ESC:
      // Esc clears the lens (filter AND saved view, task-tui-filter-language)
      // and any transient message, keeps the rest of the view.
      return { ...state, filter: "", view: null, filterError: null, message: null };
    case ENTER:
    case "\n":
      if (ctx.selectedId) {
        // Enter reads the item instead of printing its path: the pane carries
        // the path, the body, the acceptance rows and the dependencies.
        return { ...state, detail: { id: ctx.selectedId, scroll: 0 }, message: null };
      }
      return { ...state, message: "(no item selected)" };
    case ARROW_LEFT:
    case "h":
      // Vim motions ride the same rules as the arrows
      // (task-tui-help-vim-keys): h/l columns, j/k cards.
      return moveColumn(state, -1, counts);
    case ARROW_RIGHT:
    case "l":
      return moveColumn(state, 1, counts);
    case ARROW_UP:
    case "k":
      return moveCard(state, -1, counts);
    case ARROW_DOWN:
    case "j":
      return moveCard(state, 1, counts);
    case PAGE_UP:
      return moveCard(state, -pageStep(state), counts);
    case PAGE_DOWN:
      return moveCard(state, pageStep(state), counts);
    case "g":
      // Vim first/last (task-tui-help-vim-keys), same as home/end.
      return selectCard(state, 0, counts);
    case "G":
      return selectCard(state, "last", counts);
    default:
      if (HOME_KEYS.has(key)) return selectCard(state, 0, counts);
      if (END_KEYS.has(key)) return selectCard(state, "last", counts);
      return state;
  }
}

/**
 * Detail-pane reducer (task-tui-detail-pane). Read-only: no key can write, and
 * no key touches the board fields, so returning to the board restores the
 * selection, the filter and the scroll window exactly. Esc and Enter both
 * close the pane; q/Ctrl-C quit the app; `/` and every other board key are
 * ignored inside the pane (it has no filter and no selection).
 */
function handleDetailKey(state: TuiState, key: string, lines: number): TuiState {
  const detail = state.detail;
  if (detail === null) return state;
  const rows = tuiDetailBodyRows(state.height);
  const scrollTo = (value: number): TuiState => ({
    ...state,
    detail: { ...detail, scroll: clampTuiDetailScroll(value, lines, rows) },
  });
  const page = Math.max(1, rows);

  switch (key) {
    case ESC:
    case ENTER:
    case "\n":
      return { ...state, detail: null };
    case "q":
      return { ...state, quit: true };
    case ARROW_UP:
    case "k":
      // Vim motions scroll the pane too (task-tui-help-vim-keys).
      return scrollTo(detail.scroll - 1);
    case ARROW_DOWN:
    case "j":
      return scrollTo(detail.scroll + 1);
    case PAGE_UP:
      return scrollTo(detail.scroll - page);
    case PAGE_DOWN:
      return scrollTo(detail.scroll + page);
    case "g":
      return scrollTo(0);
    case "G":
      return scrollTo(lines);
    default:
      if (HOME_KEYS.has(key)) return scrollTo(0);
      if (END_KEYS.has(key)) return scrollTo(lines);
      return state;
  }
}

/** Shape `tuiActionVerdict` reads: the fields a board card carries. */
export type TuiActionItem = {
  id: string;
  type: WorkItem["type"];
  status: WorkItem["status"];
  assignee?: string | null;
};

/** Edit the action flow can carry. `force` exists only to be refused. */
export type TuiActionEdit = {
  assignee?: string | null;
  blockedReason?: string | null;
  force?: boolean;
};

/** Action verdict: the board's `{ ok, reason }` drop-rule shape. */
export type TuiActionVerdict = { ok: boolean; reason: string };

/**
 * The embedded legality rule for TUI actions (task-tui-actions-parity): a
 * 1:1 mirror of the served board's `evaluateDrop` (cli/src/board.ts) — the
 * kernel TRANSITIONS table, the same-status refusal, the claim-conflict
 * refusal and the in_progress-requires-assignee claim rule — kept as a
 * deliberate mirror rather than an import so the parity suite pins THREE
 * implementations (TUI mirror, board mirror, kernel table + runUpdate) to
 * each other. `force` is refused on sight exactly like `evaluateDrop`: the
 * TUI never constructs a force edit (no key, prompt or flag could carry
 * one), so a future caller cannot smuggle a steal through either. The
 * kernel stays the second gate: `runUpdate` re-checks everything against
 * the disk truth at apply time. Pure.
 */
export function tuiActionVerdict(
  item: TuiActionItem,
  to: string,
  edit: TuiActionEdit = {},
): TuiActionVerdict {
  // The same transition table lib/src/status.ts ships, mirrored for the pure
  // reducer (evaluateDrop's precedent) — the parity suite asserts equality.
  const transitions: Record<string, readonly string[]> = {
    todo: ["in_progress", "cancelled"],
    in_progress: ["blocked", "done", "cancelled", "todo"],
    blocked: ["in_progress", "cancelled"],
    done: ["todo"],
    cancelled: ["todo"],
  };
  const claimable = ["story", "task", "bug"];
  if (edit.force) {
    return {
      ok: false,
      reason: "--force is CLI-only: TUI actions route through the update path without force",
    };
  }
  const allowed = transitions[item.status];
  if (!allowed) return { ok: false, reason: `unknown status '${item.status}'` };
  if (to === item.status) {
    return { ok: false, reason: `${item.id} is already in that column` };
  }
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `cannot transition ${item.status} -> ${to} (allowed: ${allowed.join(", ")})`,
    };
  }
  // Claim steal guard, 1:1 with evaluateDrop and runUpdate: a claimed
  // claimable item cannot be reassigned from the board.
  if (
    item.assignee &&
    claimable.includes(item.type) &&
    item.status === "in_progress" &&
    edit.assignee !== undefined &&
    edit.assignee !== item.assignee
  ) {
    return {
      ok: false,
      reason: `claim conflict: '${item.id}' is claimed by '${item.assignee}' (status in_progress). Unclaim first (arggon update ${item.id} --status todo) or coordinate.`,
    };
  }
  const effectiveAssignee = edit.assignee !== undefined ? edit.assignee : (item.assignee ?? null);
  if (to === "in_progress" && claimable.includes(item.type) && !effectiveAssignee) {
    return {
      ok: false,
      reason: `${item.type} '${item.id}' with status in_progress requires --assignee (claim first: arggon update ${item.id} --assignee <login>)`,
    };
  }
  return { ok: true, reason: "" };
}

/**
 * Legal move targets for the `m` menu (task-tui-actions-parity): the kernel
 * transition table minus the current status, in v0 status enum order. The
 * prompts the flow may still need (reason/assignee) are flow UI — a target
 * listed here is kernel-legal once its prompt answers.
 */
export function tuiLegalMoves(item: TuiActionItem): WorkItem["status"][] {
  return STATUSES.filter((status) => status !== item.status && canTransition(item.status, status));
}

/**
 * Open the claim flow for the selected item (`c`, task-tui-actions-parity):
 * claimable types only, unclaimed only, and the transition to in_progress
 * must be kernel-legal — refusals come back as footer messages and never
 * open a flow. `suggestedAssignee` prefills the prompt (the loop's resolved
 * login). Pure: returns the next state.
 */
function openClaimAction(
  state: TuiState,
  item: WorkItem | null,
  suggestedAssignee: string | null,
): TuiState {
  if (item === null) return { ...state, message: "(no item selected)" };
  if (!isClaimable(item.type)) {
    return {
      ...state,
      message: `${item.type} '${item.id}' is not claimable (story/task/bug only)`,
    };
  }
  // Never steal: a claimed item refuses with the claim-conflict wording
  // before any prompt opens (the kernel would refuse the reassignment too).
  if (item.assignee !== null && item.assignee !== undefined) {
    return {
      ...state,
      message: `claim conflict: '${item.id}' is claimed by '${item.assignee}'. Unclaim first (arggon update ${item.id} --status todo) or coordinate.`,
    };
  }
  const verdict = tuiActionVerdict(item, "in_progress", { assignee: suggestedAssignee });
  if (!verdict.ok) return { ...state, message: verdict.reason };
  return {
    ...state,
    message: null,
    action: {
      id: item.id,
      type: item.type,
      from: item.status,
      claimedBy: item.assignee ?? null,
      claim: true,
      stage: "assignee",
      status: "in_progress",
      assignee: null,
      blockedReason: null,
      cursor: 0,
      draft: suggestedAssignee ?? "",
      error: null,
    },
  };
}

/**
 * Open the move flow for the selected item (`m`, task-tui-actions-parity):
 * the menu lists kernel-legal targets only. Pure.
 */
function openMoveAction(state: TuiState, item: WorkItem | null): TuiState {
  if (item === null) return { ...state, message: "(no item selected)" };
  if (tuiLegalMoves(item).length === 0) {
    return { ...state, message: `no legal transition from '${item.status}'` };
  }
  return {
    ...state,
    message: null,
    action: {
      id: item.id,
      type: item.type,
      from: item.status,
      claimedBy: item.assignee ?? null,
      claim: false,
      stage: "move",
      status: item.status,
      assignee: null,
      blockedReason: null,
      cursor: 0,
      draft: "",
      error: null,
    },
  };
}

/**
 * Reducer branch for the modal action flow (task-tui-actions-parity): the
 * menu takes number keys, the prompts take text with Enter, the confirm takes
 * y; `esc` cancels from any stage with nothing written and `Ctrl-C` (handled
 * before this branch) always quits. The flow never mutates the board state
 * behind it. The `apply` stage is a pure hand-off: the loop sees it after the
 * reducer returns and performs the single `runUpdate` call.
 */
function handleActionKey(state: TuiState, key: string, suggestedAssignee: string | null): TuiState {
  const action = state.action;
  if (action === null) return state;

  if (key === ESC) return { ...state, action: null };
  if (action.stage === "move") {
    const moves = tuiLegalMoves({
      id: action.id,
      type: action.type,
      status: action.from,
      assignee: action.claimedBy,
    });
    const index = Number(key) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= moves.length) return state;
    const status = moves[index]!;
    // Stage transitions: blocked asks for its reason, an unclaimed claimable
    // moving to in_progress asks for the assignee (the kernel claim rule),
    // everything else goes straight to the confirmation.
    if (status === "blocked") {
      return {
        ...state,
        action: { ...action, stage: "reason", status, draft: "", error: null },
      };
    }
    if (status === "in_progress" && isClaimable(action.type) && action.claimedBy === null) {
      return {
        ...state,
        action: {
          ...action,
          stage: "assignee",
          status,
          draft: suggestedAssignee ?? "",
          error: null,
        },
      };
    }
    return { ...state, action: { ...action, stage: "confirm", status } };
  }
  if (action.stage === "reason" || action.stage === "assignee") {
    if (key === ENTER || key === "\n") {
      const value = action.draft.trim();
      if (action.stage === "reason" && value === "") {
        return {
          ...state,
          action: { ...action, error: "a blocked move needs a non-empty reason" },
        };
      }
      // An empty assignee keeps the prefill (the prompt's default answer).
      const assignee = action.stage === "assignee" ? value || null : action.assignee;
      return {
        ...state,
        action: {
          ...action,
          stage: "confirm",
          assignee,
          blockedReason: action.stage === "reason" ? value : action.blockedReason,
          error: null,
        },
      };
    }
    if (key === BACKSPACE || key === "\b") {
      return { ...state, action: { ...action, draft: action.draft.slice(0, -1), error: null } };
    }
    if (key.length === 1 && key >= " ") {
      return { ...state, action: { ...action, draft: action.draft + key, error: null } };
    }
    return state;
  }
  if (action.stage === "confirm") {
    if (key === "y" || key === "Y") {
      return { ...state, action: { ...action, stage: "apply", error: null } };
    }
    // Anything else cancels: nothing is written, the board is unchanged.
    return { ...state, action: null };
  }
  return state; // "apply": the loop owns the execution
}

/** Cards a PgUp/PgDn moves: one body page, at least one row. */
function pageStep(state: TuiState): number {
  return Math.max(1, tuiBodyRows(state.height));
}

/**
 * Cycle the saved views with `v` (task-tui-filter-language): no view → first
 * view → … → last view → no view. A view that failed validation (malformed
 * expression, unknown enum value, unresolvable `@me`) is refused with its
 * error as the transient message — the inline hint — and the previous lens
 * stays active. A stale active name (the convention file changed under it)
 * cycles from the first view. The card index keeps its value; the post-key
 * sync clamps it against the re-filtered columns.
 */
function cycleTuiView(state: TuiState, views: readonly TuiViewOption[]): TuiState {
  if (views.length === 0) {
    return { ...state, message: "(no saved views: x-views in the tracker .convention.yml)" };
  }
  const currentIndex =
    state.view === null ? -1 : views.findIndex((option) => option.name === state.view?.name);
  const next = views[currentIndex + 1];
  if (next === undefined) return { ...state, view: null, message: null };
  if (!next.ok) {
    return { ...state, message: `${next.name}: ${next.error ?? "invalid view expression"}` };
  }
  return { ...state, view: { name: next.name, expr: next.expr }, filterError: null, message: null };
}

function moveColumn(state: TuiState, delta: number, counts: number[]): TuiState {
  const column = Math.min(Math.max(state.column + delta, 0), STATUSES.length - 1);
  if (column === state.column) return state;
  const count = counts[column] ?? 0;
  const card = count === 0 ? 0 : Math.min(state.card, count - 1);
  const scroll = followTuiScroll(card, state.scroll, count, tuiBodyRows(state.height));
  return { ...state, column, card, scroll, message: null };
}

/**
 * Move the selected card by `delta` within its column, clamped at both edges
 * when the column count is known, and keep the scroll window following it.
 */
function moveCard(state: TuiState, delta: number, counts: number[]): TuiState {
  const count = counts[state.column];
  if (typeof count !== "number") {
    // Pure reducer without counts: preserve the unbounded card move.
    return { ...state, card: Math.max(state.card + delta, 0), message: null };
  }
  const last = Math.max(count - 1, 0);
  const card = Math.min(Math.max(state.card + delta, 0), last);
  const scroll = followTuiScroll(card, state.scroll, count, tuiBodyRows(state.height));
  return { ...state, card, scroll, message: null };
}

/** Jump to the first/last card of the column, window included. */
function selectCard(state: TuiState, position: 0 | "last", counts: number[]): TuiState {
  const count = counts[state.column];
  if (typeof count !== "number") {
    return { ...state, card: position === "last" ? state.card : 0, message: null };
  }
  const last = Math.max(count - 1, 0);
  const card = position === "last" ? last : Math.min(position, last);
  const scroll = followTuiScroll(card, state.scroll, count, tuiBodyRows(state.height));
  return { ...state, card, scroll, message: null };
}

/**
 * The footer line for an open action flow (task-tui-actions-parity): one
 * prompt per stage — the legal-target menu, the reason/assignee inputs (with
 * the inline refusal), the y/N confirmation naming the exact write. Pure;
 * every repo-controlled value is escaped like the rest of the frame.
 */
function tuiActionFooter(action: TuiActionState, position: string): string {
  const id = sanitizeHumanTextUncapped(action.id);
  const error = action.error === null ? "" : ` — ${sanitizeHumanTextUncapped(action.error)}`;
  if (action.stage === "move") {
    const moves = tuiLegalMoves({
      id: action.id,
      type: action.type,
      status: action.from,
      assignee: action.claimedBy,
    });
    const menu = moves.map((status, i) => `[${i + 1}] ${status}`).join(" ");
    return `${position} · move ${id} (${action.from}): ${menu} · number selects, esc cancels`;
  }
  if (action.stage === "reason") {
    return `${position} · blocked reason for ${id}: ${action.draft}█ — enter to set, esc cancels${error}`;
  }
  if (action.stage === "assignee") {
    return `${position} · ${action.claim ? "claim" : "assignee for"} ${id}: ${action.draft}█ — enter to apply, esc cancels${error}`;
  }
  if (action.stage === "confirm") {
    const assignee =
      action.assignee === null ? "" : ` (assignee ${sanitizeHumanTextUncapped(action.assignee)})`;
    const reason =
      action.blockedReason === null
        ? ""
        : ` (reason: ${sanitizeHumanTextUncapped(action.blockedReason)})`;
    return `${position} · apply ${id}: ${action.from} -> ${action.status}${assignee}${reason}? y applies · anything else cancels`;
  }
  return `${position} · applying ${id}…`;
}

/**
 * Sanitized footer text for a refused action (task-tui-actions-parity): the
 * kernel's error message, escaped like every repo-controlled value — a
 * hostile message cannot forge a footer line or emit a control sequence.
 */
function tuiActionError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return sanitizeHumanTextUncapped(message);
}

/** Clip a single-line string to n visible columns, marking a cut with an ellipsis. */
export function clipLine(text: string, n: number): string {
  if (n <= 0) return "";
  if (text.length <= n) return text;
  return text.slice(0, Math.max(n - 1, 0)) + "…";
}

function padEndTo(text: string, n: number): string {
  return text.length >= n ? text : text + " ".repeat(n - text.length);
}

function cardLine(item: WorkItem, selected: boolean, depBlocked: boolean): string {
  const marker = selected ? ">" : " ";
  const badge = TYPE_BADGES[item.type];
  // Ids/titles are repo-controlled (frontmatter + filename-derived ids): escape
  // them before the width clip so hostile bytes cannot emit ANSI/OSC sequences
  // or extend the frame (task-row-table-stdout-sanitize). The surrounding frame
  // escapes are the TUI's own trusted output.
  const title = sanitizeHumanTextUncapped(item.title ?? item.id);
  // task-board-dependency-visuals: dependency-blocked items carry a `⌫` tag
  // (open deps = deps not done/cancelled; same rule as the HTML board).
  const blockedTag = depBlocked ? " ⌫" : "";
  // task-tui-sort-ready-lens: the priority tier and the owner ride on the
  // card, so the board answers "what should I pull?" without opening the
  // pane. Repo-controlled values: escaped like every other field.
  const priorityTag = item.priority ? ` ${sanitizeHumanTextUncapped(item.priority)}` : "";
  const assigneeTag = item.assignee ? ` @${sanitizeHumanTextUncapped(item.assignee)}` : "";
  return `${marker} ${badge} ${sanitizeHumanTextUncapped(item.id)}${blockedTag}${priorityTag}${assigneeTag} ${title}`;
}

/**
 * Pure frame renderer: the whole terminal screen as one string (with a
 * leading clear+home and exactly `height` lines, each padded to `width` so
 * consecutive frames never ghost). Columns are the v0 statuses in enum
 * order, one card row per visible item; the selected column renders through
 * the scroll window (bug-tui-selection-offscreen) so the selected card is
 * always drawn. The footer leads with the position (`row 61/281`) and then
 * carries help / search prompt / last message. With `color: false` (tests) no
 * SGR sequences are emitted.
 */
export function renderTui(
  items: WorkItem[],
  state: TuiState,
  opts: { color?: boolean } = {},
): string {
  const color = opts.color !== false;
  const width = Math.max(1, Math.floor(state.width));
  const height = Math.max(1, Math.floor(state.height));
  const colWidth = Math.max(1, Math.floor(width / STATUSES.length));
  // One lens + sort pass feeds the cards AND the counts, so the header, the
  // column counts and the card rows always describe the same set
  // (task-tui-sort-ready-lens).
  const visible = tuiViewItems(items, state);
  const counts = tuiColumnCounts(items, state);
  const cardRows = tuiBodyRows(height);
  const selectedCount = counts[state.column] ?? 0;
  // The frame is always valid even with a stale state: the window is
  // re-derived from the selection on every render (followTuiScroll), so the
  // selected card is drawn whenever the column has one.
  const selectedCard =
    selectedCount === 0 ? 0 : Math.min(Math.max(state.card, 0), selectedCount - 1);
  const scroll = followTuiScroll(selectedCard, state.scroll, selectedCount, cardRows);

  const lines: string[] = [];

  // Header: title, totals, active sort + lens + saved view + filter.
  const total = visible.length;
  let header = `arggon board --tui · ${total} item(s) · sort: ${state.sort}`;
  if (state.readyOnly) header += " · ready-only";
  if (state.view !== null) {
    // File-sourced values: escaped like every other repo-controlled field.
    header += ` · view: ${sanitizeHumanTextUncapped(state.view.name)} (${sanitizeHumanTextUncapped(state.view.expr)})`;
  }
  if (state.filter !== "") header += ` · filter: ${state.filter}`;
  lines.push(padEndTo(clipLine(header, width), width));

  // Column headers: status (count); the selected column is highlighted.
  const headers = STATUSES.map((status, i) => {
    const text = padEndTo(clipLine(`${status} (${counts[i]})`, colWidth), colWidth);
    if (!color) return text;
    return i === state.column ? `\x1b[1;7m${text}\x1b[0m` : text;
  });
  lines.push(padEndTo(headers.join(""), width));

  // Card rows: one line per item, per column, up to the body height. Only the
  // selected column is windowed (bug-tui-selection-offscreen): it starts at
  // `scroll` so the selected card is always drawn; the other columns keep
  // rendering from their first card. The status index is built once per frame
  // for the dependency marks.
  const statusById = buildStatusIndex(items);
  const columnCards = STATUSES.map((status, i) => {
    const start = i === state.column ? scroll : 0;
    const cards = visible
      .filter((item) => item.status === status)
      .slice(start, start + cardRows)
      .map((item, j) => {
        const index = start + j;
        const isSelected = i === state.column && index === selectedCard;
        const line = padEndTo(
          clipLine(
            cardLine(item, isSelected, hasOpenDependencies(item.depends_on, statusById)),
            colWidth,
          ),
          colWidth,
        );
        if (!color) return line;
        return isSelected ? `\x1b[7m${line}\x1b[0m` : line;
      });
    // A column the lens empties stays informative (task-tui-filter-language):
    // its header count reads 0 and the first body row carries an empty mark
    // (dimmed with color on) instead of a blank strip. Visible width is
    // pre-padded before the SGR wrap (bug-tui-column-shift).
    if (cards.length === 0 && counts[i] === 0 && cardRows > 0) {
      const mark = padEndTo(clipLine("  (empty)", colWidth), colWidth);
      cards.push(color ? `\x1b[2m${mark}\x1b[0m` : mark);
    }
    return cards;
  });
  for (let row = 0; row < cardRows; row++) {
    let line = "";
    for (let c = 0; c < STATUSES.length; c++) {
      const cell = columnCards[c][row] ?? "";
      // Pad EVERY cell to the column width, selected column included: an
      // unpadded empty cell shifts all right-hand columns one colWidth left
      // (bug-tui-column-shift). padEndTo on an SGR-wrapped cell is a no-op
      // by string length; the visible width was pre-padded at construction.
      line += padEndTo(cell, colWidth);
    }
    lines.push(padEndTo(line, width));
  }

  // Footer: the position (selected row over the selected column's size)
  // always leads, then the freshness stamp of the rendered data
  // (task-tui-live-refresh), then the search prompt (with the draft's refusal
  // inline, task-tui-filter-language) > transient message > the active lens
  // with the matched totals > key help — so a narrow terminal clips the help
  // instead of the position.
  const position = `row ${selectedCount === 0 ? 0 : selectedCard + 1}/${selectedCount}`;
  const stamp = state.updatedAt === null ? "" : ` · updated ${formatTuiClock(state.updatedAt)}`;
  let footer: string;
  if (state.searching) {
    footer =
      state.filterError !== null
        ? `${position} · /${state.filter}█ — ${sanitizeHumanTextUncapped(state.filterError)}`
        : `${position} · /${state.filter}█ — enter to apply, esc to cancel`;
  } else if (state.action !== null) {
    // The modal action flow owns the footer (task-tui-actions-parity): the
    // stage prompt (with the inline refusal when present) replaces message
    // and help. Item ids/statuses are repo-controlled: escaped.
    footer = tuiActionFooter(state.action, position);
  } else if (state.message !== null) {
    // Transient messages are repo-controlled text (an old path message, the
    // "(no item selected)" hint): escape before rendering.
    footer = `${position} · ${sanitizeHumanTextUncapped(state.message)}`;
  } else {
    // The active lens rides the footer with the matched totals
    // (task-tui-filter-language): view, filter, K/M over the loaded tree.
    const lensBits: string[] = [];
    if (state.view !== null) lensBits.push(`view: ${sanitizeHumanTextUncapped(state.view.name)}`);
    if (state.filter !== "") lensBits.push(`filter: ${state.filter}`);
    if (lensBits.length > 0) lensBits.push(`${visible.length}/${items.length} match`);
    const lens = lensBits.length > 0 ? ` · ${lensBits.join(" · ")}` : "";
    footer = `${position}${stamp}${lens} · ←/→ column · ↑/↓ card · PgUp/PgDn page · home/end · / search · v views · enter detail · r refresh · s sort · L ready · ? help · q quit`;
  }
  lines.push(padEndTo(clipLine(footer, width), width));

  return `\x1b[H\x1b[2J${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Detail pane (task-tui-detail-pane): read one item without leaving the board.
// ---------------------------------------------------------------------------

/** One acceptance checkbox row of an item body. */
export type TuiAcceptanceRow = {
  checked: boolean;
  /** Checkbox text (marker stripped, trimmed). */
  text: string;
};

/**
 * Word-wrap one sanitized display line to `width` columns: break at the last
 * space that fits, hard-break a word longer than the line, drop the break
 * space. The pane never clips values — it is scrollable, so wrapping is the
 * documented narrow-terminal fallback. Returns [""] for empty input and [] for
 * a degenerate width. Pure; callers sanitize BEFORE wrapping, so no control
 * byte is ever measured or emitted by a hostile body line.
 */
export function wrapTuiLine(text: string, width: number): string[] {
  const max = Math.floor(width);
  if (!Number.isFinite(max) || max <= 0) return [];
  if (text.length === 0) return [""];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^ +/, "");
  }
  out.push(rest);
  return out;
}

/**
 * Acceptance checkbox rows of a body (task-tui-detail-pane): the exact
 * task-list rule the container cascade counts (`acceptanceComplete`, kernel
 * task-cascade-acceptance-aware) — `- [ ]` / `- [x]` / `- [X]` with leading
 * whitespace tolerated — so the pane shows the checklist whose completion the
 * cascade checks, never a second interpretation of it. A checkbox line with
 * no text after the box is a scaffold placeholder, not a criterion
 * (bug-empty-template-checkbox) — skipped, so the `checked/total` count is
 * the same contract the done gate judges.
 */
export function tuiAcceptanceRows(body: string): TuiAcceptanceRow[] {
  const rows: TuiAcceptanceRow[] = [];
  for (const line of body.split("\n")) {
    const match = /^[ \t]*[-*] \[( |x|X)\]/.exec(line);
    if (!match) continue;
    const text = line.slice(match[0].length).trim();
    if (!text) continue;
    rows.push({ checked: match[1] !== " ", text });
  }
  return rows;
}

/**
 * One-line dependency summary with each dependency's status: `a (in_progress
 * ⌫), b (done)`. Open dependencies (not done/cancelled, unknown ids included —
 * the board's ⌫ rule, ADR 0004) carry the marker; the caller sanitizes the
 * result like every other field value.
 */
export function tuiDependencySummary(item: WorkItem, items: WorkItem[]): string {
  if (item.depends_on.length === 0) return "(none)";
  const byId = new Map(items.map((entry) => [entry.id, entry]));
  return item.depends_on
    .map((id) => {
      const dep = byId.get(id);
      if (!dep) return `${id} (unknown ⌫)`;
      const open = dep.status !== "done" && dep.status !== "cancelled";
      return `${id} (${dep.status}${open ? " ⌫" : ""})`;
    })
    .join(", ");
}

export type TuiDetailInput = {
  /** The item being read; null when its id is no longer in the tree. */
  item: WorkItem | null;
  /** Id the pane was opened with (shown when `item` is null). */
  id: string;
  /** All loaded items — dependency statuses must not depend on the filter. */
  items: WorkItem[];
  /** Raw markdown body (kernel read path via loadTuiItems). */
  body: string;
  /** Terminal width the content is wrapped to. */
  width: number;
  /** Source body line cap; defaults to TUI_DETAIL_MAX_BODY_LINES. */
  maxBodyLines?: number;
  /** Rendered display line cap; defaults to TUI_DETAIL_MAX_LINES. */
  maxLines?: number;
};

/**
 * Pure detail-pane content builder (task-tui-detail-pane): sanitized, wrapped
 * display lines in reading order — title, fields (type/status/priority/
 * assignee, labels, milestone, parent, branch, worktree, path, dependencies
 * with statuses), the acceptance excerpt, then the body. Everything
 * repo-controlled goes through `sanitizeHumanTextUncapped` (the same
 * human-text path as the board cards) per source line, so a hostile body line
 * renders as inert `\uXXXX` text and cannot drive the terminal.
 *
 * Layout: `width >= TUI_DETAIL_NARROW_WIDTH` packs related fields on one line
 * (`type: … · status: …`); below it the stacked layout puts one field per line
 * and wraps values instead of clipping them. Two documented caps bound the
 * output (see TUI_DETAIL_MAX_BODY_LINES / TUI_DETAIL_MAX_LINES); each cap is
 * named by a marker line, so nothing is dropped silently. Read-only: the
 * builder never touches the filesystem.
 */
export function buildTuiDetailLines(input: TuiDetailInput): string[] {
  const width = Math.max(1, Math.floor(input.width) || 0);
  const maxBodyLines = Math.max(
    1,
    Math.floor(input.maxBodyLines ?? TUI_DETAIL_MAX_BODY_LINES) || 0,
  );
  const maxLines = Math.max(1, Math.floor(input.maxLines ?? TUI_DETAIL_MAX_LINES) || 0);
  const lines: string[] = [];
  let truncated = false;

  // Append one logical line, wrapped to the pane; continuation segments get
  // `cont` (defaults to spaces matching the prefix) so indented content keeps
  // its shape. Stops at the rendered-line cap and records the truncation.
  const push = (prefix: string, text: string, cont?: string): void => {
    const continuation = cont ?? " ".repeat(prefix.length);
    const inner = Math.max(1, width - Math.max(prefix.length, continuation.length));
    const parts = wrapTuiLine(text, inner);
    for (let i = 0; i < parts.length; i++) {
      if (lines.length >= maxLines) {
        truncated = true;
        return;
      }
      lines.push(`${i === 0 ? prefix : continuation}${parts[i]}`);
    }
  };

  const safe = (value: string): string => sanitizeHumanTextUncapped(value);
  const item = input.item;

  if (item === null) {
    push("", `item ${safe(input.id)} is not in the tree anymore`, "");
    push("", "esc · back to the board (the tree is re-read on every key)", "");
    return lines;
  }

  // Title line: the board's card vocabulary (badge + id + title).
  push("", `${TYPE_BADGES[item.type]} ${safe(item.id)} — ${safe(item.title ?? item.id)}`, "");

  // Fields. Labels/statuses/enums are repo-controlled values and are escaped
  // like every other one; only the field NAMES and the separators are trusted.
  const fields: Array<[string, string]> = [
    ["type", item.type],
    ["status", item.status],
    ["priority", safe(item.priority ?? "(none)")],
    ["assignee", safe(item.assignee ?? "(none)")],
    ["labels", safe(item.labels.length > 0 ? item.labels.join(", ") : "(none)")],
    ["milestone", safe(item.milestone ?? "(none)")],
    ["parent", safe(item.parent ?? "(none)")],
    ["branch", safe(item.branch ?? "(none)")],
    ["worktree", safe(item.worktree_path ?? "(none)")],
    ["path", safe(item.path)],
    ["dependencies", safe(tuiDependencySummary(item, input.items))],
  ];
  const groups =
    width < TUI_DETAIL_NARROW_WIDTH
      ? fields.map(([label]) => [label])
      : [
          ["type", "status", "priority", "assignee"],
          ["labels", "milestone"],
          ["parent", "branch", "worktree"],
          ["path", "dependencies"],
        ];
  const valueByLabel = new Map(fields);
  for (const group of groups) {
    push(
      "",
      group.map((label) => `${label}: ${valueByLabel.get(label) ?? "(none)"}`).join(" · "),
      "",
    );
  }

  // Acceptance excerpt: the cascade-counted rows plus the count, so the item's
  // contract is readable before the body is scrolled.
  const acceptance = tuiAcceptanceRows(input.body);
  if (acceptance.length === 0) {
    push("", "acceptance: (none)", "");
  } else {
    const checked = acceptance.filter((row) => row.checked).length;
    push("", `acceptance ${checked}/${acceptance.length}:`, "");
    for (const row of acceptance) {
      push("  ", `[${row.checked ? "x" : " "}] ${safe(row.text)}`, "    ");
    }
  }

  // Body: the raw markdown (prose and comment history), one sanitized line at
  // a time, capped — the item is a file, not a buffer.
  const body = input.body.replace(/^\n+/, "").replace(/\s+$/, "");
  if (body === "") {
    push("", "body: (empty)", "");
  } else {
    const source = body.split("\n");
    push("", "body:", "");
    for (const line of source.slice(0, maxBodyLines)) push("  ", safe(line), "  ");
    if (source.length > maxBodyLines) {
      push(
        "",
        `… body truncated: ${source.length - maxBodyLines} of ${source.length} line(s) omitted (cap ${maxBodyLines})`,
        "",
      );
    }
  }

  if (truncated) {
    if (lines.length >= maxLines) lines.pop();
    lines.push(`… more content omitted (rendered line cap ${maxLines})`);
  }
  return lines;
}

/**
 * The pane's content lines for one loaded snapshot: item lookup (null when the
 * id vanished from the tree), raw body, dependency statuses, wrapped to
 * `width`. Shared by the renderer and by the loop's keypress reducer, so
 * scrolling always clamps against exactly the lines the frame draws.
 */
export function tuiDetailLinesFor(
  items: WorkItem[],
  details: ReadonlyMap<string, TuiDetailSource>,
  detail: TuiDetailState,
  width: number,
): string[] {
  const item = items.find((entry) => entry.id === detail.id) ?? null;
  return buildTuiDetailLines({
    item,
    id: detail.id,
    items,
    body: details.get(detail.id)?.body ?? "",
    width,
  });
}

/**
 * Pure detail-pane frame renderer (task-tui-detail-pane): pane header +
 * scrollable content + footer, exactly `height` lines each padded to `width`
 * (the board's no-ghosting rule). The window is re-derived from
 * `detail.scroll` on every frame (clampTuiDetailScroll), so a stale value, a
 * resize or a tree that shrank still renders a valid frame. With
 * `color: false` (tests) no SGR sequences are emitted.
 */
export function renderTuiDetail(
  items: WorkItem[],
  detail: TuiDetailState,
  details: ReadonlyMap<string, TuiDetailSource>,
  geometry: { width: number; height: number },
  opts: { color?: boolean } = {},
): string {
  const color = opts.color !== false;
  const width = Math.max(1, Math.floor(geometry.width) || 0);
  const height = Math.max(1, Math.floor(geometry.height) || 0);
  const content = tuiDetailLinesFor(items, details, detail, width);
  const rows = tuiDetailBodyRows(height);
  const scroll = clampTuiDetailScroll(detail.scroll, content.length, rows);
  const window = content.slice(scroll, scroll + rows);

  const headerText = clipLine(
    `arggon detail · ${sanitizeHumanTextUncapped(detail.id)} · esc back`,
    width,
  );
  const header = color ? `\x1b[1m${headerText}\x1b[0m` : headerText;
  // Position first, help last — a narrow terminal clips the help, never the
  // position (same precedence as the board footer).
  const footer = clipLine(
    `row ${content.length === 0 ? 0 : scroll + 1}/${content.length} · ↑/↓ line · PgUp/PgDn page · home/end · esc back · q quit`,
    width,
  );

  const out: string[] = [padEndTo(header, width)];
  for (const line of window) out.push(padEndTo(clipLine(line, width), width));
  out.push(padEndTo(footer, width));
  while (out.length < height) out.push(" ".repeat(width));
  return `\x1b[H\x1b[2J${out.slice(0, height).join("\n")}`;
}

/**
 * One help overlay row: the keys and what they do. The overlay's content is
 * data (task-tui-help-vim-keys) so the renderer stays a dumb loop and the
 * groups render in this order: navigation, filter, view, quit.
 */
export type TuiHelpGroup = { title: string; rows: Array<[string, string]> };

/**
 * The help overlay content (task-tui-help-vim-keys): EVERY board key, grouped
 * — navigation (arrows + the vim motions), filter, view, actions (the kernel
 * write path, task-tui-actions-parity) and quit. Kept beside the keymap; the
 * golden test pins that every `handleKey`-documented key appears here.
 */
export const TUI_HELP: readonly TuiHelpGroup[] = [
  {
    title: "navigation",
    rows: [
      ["←/→ · h/l", "move the selected column (v0 status order)"],
      ["↑/↓ · j/k", "move the selected card within the column"],
      ["PgUp/PgDn", "move the selection one body page up/down"],
      ["g/G · home/end", "jump to the first/last card of the column"],
      ["enter", "open the read-only detail pane (esc/enter back)"],
    ],
  },
  {
    title: "filter",
    rows: [
      ["/", "filter prompt: free text + kernel predicates (status:todo …)"],
      ["esc", "clear the active filter and the saved view"],
    ],
  },
  {
    title: "view",
    rows: [
      ["v", "cycle the saved views (x-views): the view ANDs with the filter"],
      ["s", "cycle the card order: id → priority → next"],
      ["L", "toggle the ready-only lens (pullable work only)"],
      ["r", "force a refresh (re-read the tree now)"],
    ],
  },
  {
    title: "actions",
    rows: [
      ["c", "claim the selected item (assignee prompt, one kernel runUpdate)"],
      ["m", "move the selected item: kernel-legal targets, prompts, y/N confirm"],
    ],
  },
  {
    title: "quit",
    rows: [
      ["q · Ctrl-C", "quit, restoring the screen (works from any prompt)"],
      ["?", "toggle this help"],
    ],
  },
];

/**
 * Pure help-overlay frame renderer (task-tui-help-vim-keys): exactly `height`
 * lines padded to `width` (the board's no-ghosting rule), the grouped key list
 * centered in the content area, a header and an `esc closes` footer. Groups
 * render back-to-back (the titles separate them): the union keymap must fit a
 * standard 24-row terminal. With `color: false` no SGR sequences are emitted.
 */
export function renderTuiHelp(state: TuiState, opts: { color?: boolean } = {}): string {
  const color = opts.color !== false;
  const width = Math.max(1, Math.floor(state.width));
  const height = Math.max(1, Math.floor(state.height));
  const rows: string[] = ["arggon board --tui — keys (? or esc closes)"];
  for (const group of TUI_HELP) {
    rows.push(`${group.title}`);
    for (const [keys, description] of group.rows) {
      rows.push(`  ${padEndTo(clipLine(keys, 18), 18)} ${description}`);
    }
  }
  const footer = "esc closes · q quits";
  const out: string[] = [];
  for (let i = 0; i < height; i++) {
    if (i === 0) {
      const header = clipLine(rows[0] ?? "", width);
      out.push(padEndTo(color ? `\x1b[1m${header}\x1b[0m` : header, width));
      continue;
    }
    if (i === height - 1) {
      out.push(padEndTo(clipLine(footer, width), width));
      continue;
    }
    const row = rows[i] ?? "";
    out.push(padEndTo(clipLine(row, width), width));
  }
  return `\x1b[H\x1b[2J${out.slice(0, height).join("\n")}`;
}

/**
 * The frame the loop draws (task-tui-detail-pane, task-tui-help-vim-keys): the
 * help overlay when `state.help` is set, else the read-only detail pane when
 * `state.detail` is set, else the board. Pure; `details` carries the bodies
 * loaded beside the contract items (loadTuiItems).
 */
export function renderTuiScreen(
  items: WorkItem[],
  state: TuiState,
  details: ReadonlyMap<string, TuiDetailSource> = new Map(),
  opts: { color?: boolean } = {},
): string {
  if (state.help) return renderTuiHelp(state, opts);
  if (state.detail === null) return renderTui(items, state, opts);
  return renderTuiDetail(items, state.detail, details, state, opts);
}

/** Minimal output surface the loop needs (process.stdout or a test double). */
export type TuiOutput = {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  write(chunk: string | Uint8Array): unknown;
  on(event: string, listener: () => void): unknown;
  removeListener(event: string, listener: () => void): unknown;
};

export type TuiLoopOptions = {
  cwd: string;
  /** Defaults to process.stdin; only needs to be readable + (optionally) raw-capable. */
  input?: NodeJS.ReadableStream & {
    setRawMode?: (mode: boolean) => unknown;
    resume?: () => unknown;
  };
  /** Defaults to process.stdout; must report isTTY (checked). */
  output?: TuiOutput;
  /** Geometry overrides (tests); defaults to the real size, then 80x24. */
  width?: number;
  height?: number;
  /**
   * Esc-flush override (tests): how long a split escape sequence may wait for
   * its continuation before the buffered bytes are flushed as plain keys.
   * Defaults to TUI_ESCAPE_FLUSH_MS.
   */
  escapeFlushMs?: number;
  /**
   * Watcher factory override (tests); defaults to fsWatchTuiWatcher (recursive
   * fs.watch on the tracker dir). Returning null or throwing degrades the loop
   * to per-keypress reads (task-tui-live-refresh).
   */
  watch?: TuiWatchFactory;
  /** Watcher debounce override (tests); defaults to TUI_REFRESH_DEBOUNCE_MS. */
  refreshDebounceMs?: number;
  /**
   * Emit SGR colors (task-tui-help-vim-keys). Default: the `NO_COLOR` env
   * convention — colors ON unless `NO_COLOR` is set in the environment; the
   * CLI's `--no-color` passes `false` (the flag wins over the env). With
   * colors off the frame is plain text: the selection rides the `>` marker
   * and the inverted header/column marks drop out.
   */
  color?: boolean;
  /**
   * Write path override (tests, task-tui-actions-parity): defaults to the
   * kernel `runUpdate`. The loop performs exactly ONE call per finished flow
   * — never with `force` or `steal` (the flows cannot construct them).
   */
  runUpdate?: typeof runUpdate;
};

/**
 * Interactive loop for `arggon board --tui`. It re-reads the tree after every
 * keypress and, whenever the tracker dir changes, after a short debounce
 * (task-tui-live-refresh) — so an idle board repaints in place while other
 * agents/sessions write. The only write is a finished action flow's single
 * kernel `runUpdate` (task-tui-actions-parity): a failure surfaces as footer
 * text and the loop keeps running. A watcher that cannot open or fails later
 * degrades transparently to per-keypress reads (never crashes, never exits).
 * Enter opens the read-only detail pane; Esc/Enter return to the board; `r`
 * forces a refresh; `/` filters through the kernel filter language plus free
 * text on id/title (an invalid expression is refused inline, never applied)
 * and `v` cycles the tracker's saved views (task-tui-filter-language). Key bytes
 * go through the stateful decoder
 * (bug-tui-split-escape-sequences): a CSI sequence split across stdin chunks
 * reassembles instead of leaking a phantom Esc, and a genuinely lone Esc is
 * flushed by the TUI_ESCAPE_FLUSH_MS timeout. Fails with an actionable error
 * when stdout is not a TTY (piped output cannot render).
 */
export function runTuiBoard(opts: TuiLoopOptions): Promise<void> {
  const output: TuiOutput = opts.output ?? process.stdout;
  const input = opts.input ?? process.stdin;
  if (output.isTTY !== true) {
    return Promise.reject(
      new Error("board --tui requires an interactive terminal (stdout is not a TTY)"),
    );
  }
  const escapeFlushMs = Math.max(0, Math.floor(opts.escapeFlushMs ?? TUI_ESCAPE_FLUSH_MS));
  // Color resolution (task-tui-help-vim-keys): the explicit option wins; the
  // default honors the NO_COLOR convention (colors unless NO_COLOR is set).
  const color = opts.color ?? process.env.NO_COLOR === undefined;
  const watchFactory = opts.watch ?? fsWatchTuiWatcher;
  const applyUpdate = opts.runUpdate ?? runUpdate;
  const refreshDebounceMs = Math.max(
    0,
    Math.floor(opts.refreshDebounceMs ?? TUI_REFRESH_DEBOUNCE_MS),
  );
  const initial = loadTuiItems(opts.cwd);
  const size = (value: number | undefined, fallback: number): number =>
    typeof value === "number" && value > 0 ? value : fallback;
  const state = initialTuiState(
    opts.width ?? size(output.columns, TUI_DEFAULT_WIDTH),
    opts.height ?? size(output.rows, TUI_DEFAULT_HEIGHT),
  );

  return new Promise<void>((resolve, reject) => {
    let items = initial.items;
    let details = initial.details;
    let currentRoot = initial.root;
    let current: TuiState = { ...state, updatedAt: Date.now() };
    let settled = false;
    const decoder = createTuiKeyDecoder();
    let escTimer: ReturnType<typeof setTimeout> | null = null;
    let watchDebounce: ReturnType<typeof setTimeout> | null = null;
    let treeWatcher: TuiTreeWatcher | null = null;
    // Login memoization: `assignee:@me` resolution (task-tui-filter-language)
    // and the assignee-prompt prefill (task-tui-actions-parity) resolve the
    // login lazily on the first use and memoize it for the session — a gh
    // lookup must never run per keystroke. An unresolvable login stays a
    // refusal (the prompt shows the kernel's error).
    let me: string | null | undefined;
    const resolveMe = (): string | null => {
      if (me === undefined) me = resolveCurrentLogin() ?? null;
      return me;
    };

    // Alternate screen + hidden cursor; restored on any exit path.
    output.write("\x1b[?1049h\x1b[?25l");
    const restore = (): void => {
      output.write("\x1b[?25h\x1b[?1049l");
    };

    const fail = (err: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      restore();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const finish = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      restore();
      resolve();
    };

    const render = (): void => {
      output.write(renderTuiScreen(items, current, details, { color }));
    };

    // Reduce decoded keys against the live state; false once the loop quit.
    const reduce = (keys: string[]): boolean => {
      for (const key of keys) {
        // Context is re-derived per key: a chunk may open the pane, scroll
        // it and close it again, and each key must be reduced against the
        // state (and the data) the previous one left behind.
        const counts = tuiColumnCounts(items, current);
        const selected = selectedTuiItem(items, current);
        const detailLines =
          current.detail === null
            ? 0
            : tuiDetailLinesFor(items, details, current.detail, current.width).length;
        // Saved views only for `v` presses and the prompt verdict only while
        // searching (task-tui-filter-language): both read the convention file
        // / re-filter the tree, so keys that cannot touch them skip the cost.
        const views = key === "v" ? tuiViewOptions(currentRoot, items, resolveMe) : undefined;
        let filterVerdict: TuiFilterVerdict | undefined;
        if (current.searching) {
          const verdict = applyViewFilter(items, current.filter, { resolveMe });
          filterVerdict = verdict.ok ? { ok: true } : verdict;
        }
        current = handleKey(current, key, {
          counts,
          selectedId: selected?.id ?? null,
          detailLines,
          selected,
          suggestedAssignee: resolveMe(),
          views,
          filterVerdict,
        });
        if (current.quit) return false;
        // A finished flow (task-tui-actions-parity): exactly ONE kernel
        // runUpdate per flow, then the sync below repaints the move. A
        // refusal (the tree moved under the flow, a claim conflict, any
        // kernel rule) is footer text — the board stays open and consistent,
        // and the alternate-screen lifecycle is untouched.
        const action = current.action;
        if (action !== null && action.stage === "apply") {
          current = { ...current, action: null };
          try {
            const result = applyUpdate({
              cwd: opts.cwd,
              id: action.id,
              status: action.status,
              ...(action.assignee !== null ? { assignee: action.assignee } : {}),
              ...(action.blockedReason !== null ? { blockedReason: action.blockedReason } : {}),
            });
            const assignee = action.assignee === null ? "" : ` (assignee ${action.assignee})`;
            const cascade =
              result.autoCompleted.length > 0
                ? ` (cascade: ${result.autoCompleted.join(", ")})`
                : "";
            current = {
              ...current,
              message: action.claim
                ? `claimed ${action.id} (${action.status})${cascade}`
                : `${action.id}: ${action.from} -> ${action.status}${assignee}${cascade}`,
            };
          } catch (err) {
            current = {
              ...current,
              message: tuiActionError(err),
            };
          }
        }
      }
      return true;
    };

    // Re-read the tree, stamp the freshness time and repaint. Shared by the
    // keypress path and the debounced watcher path (task-tui-live-refresh):
    // the tree is the source of truth and may have changed while we were
    // idle; the clamp then uses the fresh counts, keeping the scroll window
    // valid, and the selection/filter survive (clampTuiState keeps them, only
    // pulling both back into bounds). The detail pane re-derives its own
    // window per frame from the fresh bodies, so a body that shrank while
    // open still renders valid.
    const sync = (): void => {
      const fresh = loadTuiItems(opts.cwd);
      items = fresh.items;
      details = fresh.details;
      currentRoot = fresh.root;
      current = {
        ...clampTuiState(current, tuiColumnCounts(items, current)),
        updatedAt: Date.now(),
      };
      render();
    };

    // Watcher events debounce into one re-read (the `board --serve` reload
    // pattern): events keep rescheduling while the tree is being written, and
    // the quiet gap fires exactly one sync. A failing sync is swallowed —
    // the tree may be mid-write, and the next event (or keypress) retries.
    const scheduleRefresh = (): void => {
      if (watchDebounce !== null) clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        watchDebounce = null;
        try {
          sync();
        } catch {
          // Degrade transparently: the per-keypress reads keep working.
        }
      }, refreshDebounceMs);
      watchDebounce.unref?.();
    };

    // A chunk that ends inside an escape sequence holds the tail: if no
    // continuation arrives, the flush releases it as plain keys so a lone Esc
    // keeps its semantics (bug-tui-split-escape-sequences).
    const armEscFlush = (): void => {
      if (decoder.pending === "" || escTimer !== null) return;
      escTimer = setTimeout(() => {
        escTimer = null;
        try {
          if (!reduce(decoder.flush())) {
            finish();
            return;
          }
          sync();
        } catch (err) {
          fail(err);
        }
      }, escapeFlushMs);
    };

    const onData = (chunk: string | Buffer): void => {
      try {
        // New bytes are the continuation the flush was waiting for.
        if (escTimer !== null) {
          clearTimeout(escTimer);
          escTimer = null;
        }
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        if (!reduce(decoder.decode(text))) {
          finish();
          return;
        }
        sync();
        armEscFlush();
      } catch (err) {
        fail(err);
      }
    };

    const onResize = (): void => {
      try {
        current = {
          ...current,
          width: size(output.columns, current.width),
          height: size(output.rows, current.height),
        };
        // A resize changes the body height: re-derive the window so it stays
        // valid and the selected card stays visible.
        current = clampTuiState(current, tuiColumnCounts(items, current));
        render();
      } catch (err) {
        fail(err);
      }
    };

    const rawCapable = input as { setRawMode?: (mode: boolean) => unknown };
    const cleanup = (): void => {
      input.removeListener("data", onData);
      if (escTimer !== null) {
        clearTimeout(escTimer);
        escTimer = null;
      }
      if (watchDebounce !== null) {
        clearTimeout(watchDebounce);
        watchDebounce = null;
      }
      if (treeWatcher !== null) {
        try {
          treeWatcher.close();
        } catch {
          // The watcher may already be gone; the screen restore matters more.
        }
        treeWatcher = null;
      }
      if (typeof output.removeListener === "function") output.removeListener("resize", onResize);
      if (typeof rawCapable.setRawMode === "function") {
        try {
          rawCapable.setRawMode(false);
        } catch {
          // stdin may already be gone; restoring the screen is what matters.
        }
      }
    };

    try {
      // Watch the tracker dir so an idle board repaints while other agents /
      // sessions write (task-tui-live-refresh). Unavailable or failing
      // watchers degrade to the per-keypress reads — never crash, never exit.
      try {
        treeWatcher = watchFactory(initial.tasksDir, scheduleRefresh);
      } catch {
        treeWatcher = null;
      }
      if (typeof rawCapable.setRawMode === "function") rawCapable.setRawMode(true);
      if (typeof input.resume === "function") input.resume();
      input.on("data", onData);
      if (typeof output.on === "function") output.on("resize", onResize);
      render();
    } catch (err) {
      fail(err);
    }
  });
}

/**
 * The stateless per-chunk split rule (bug-tui-split-escape-sequences): CSI
 * escape sequences stay together (arrows, PgUp/PgDn, Home/End), everything
 * else is one key per character. A CSI sequence is `ESC [`, parameter bytes
 * (0x30-0x3f), intermediate bytes (0x20-0x2f) and one final byte (0x40-0x7e)
 * — reading the whole run keeps `\x1b[6~` (PgDn) from splitting into
 * `\x1b[6` + `~`. The loop feeds chunks through `createTuiKeyDecoder` so a
 * sequence split ACROSS chunks reassembles; `splitKeys` itself stays the
 * fallback that drains a flush (a held sequence no continuation ever
 * completed), where per-character decay of the orphaned bytes is correct.
 */
function splitKeys(text: string): string[] {
  const keys: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === ESC && text[i + 1] === "[") {
      let end = i + 2;
      while (end < text.length) {
        const code = text.charCodeAt(end);
        if (code < 0x20 || code > 0x3f) break;
        end += 1;
      }
      if (end < text.length && text.charCodeAt(end) >= 0x40 && text.charCodeAt(end) <= 0x7e) {
        keys.push(text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    keys.push(text[i]);
    i += 1;
  }
  return keys;
}
