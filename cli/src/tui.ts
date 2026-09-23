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
 * detail bodies included). `runTuiBoard` only wires raw mode, keypress events
 * and resize to the pure pieces; it performs no writes anywhere.
 */
import {
  STATUSES,
  buildStatusIndex,
  findTasksDir,
  hasOpenDependencies,
  itemsForStatus,
  loadItems,
  matchesSubstringFilter,
  repoRootFromTasks,
  sanitizeHumanTextUncapped,
  sortById,
  statusCounts,
  toContractWorkItem,
  visibleItems,
  type ContractWorkItem as WorkItem,
} from "@arggondev/lib";

/** Default geometry when the terminal size cannot be queried. */
export const TUI_DEFAULT_WIDTH = 80;
export const TUI_DEFAULT_HEIGHT = 24;

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
  /** Active search filter (substring, case-insensitive, on id/title). */
  filter: string;
  /** Whether the `/` search prompt is open. */
  searching: boolean;
  /** Transient footer line (e.g. "(no item selected)" after Enter). */
  message: string | null;
  /**
   * Open detail pane (`null` = the board is the view) — task-tui-detail-pane.
   * Read-only: the pane has no update path, it only reads the loaded items.
   */
  detail: TuiDetailState | null;
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
    message: null,
    detail: null,
    quit: false,
  };
}

/**
 * Items feeding the TUI: same kernel read path as the HTML board, sorted
 * lexicographically by id (same rule as renderBoardHtml / list), through the
 * shared view-model — plus the raw bodies the detail pane reads
 * (task-tui-detail-pane), keyed by id. Both come from the same `loadItems`
 * pass, so the board and the pane can never disagree about an item.
 */
export function loadTuiItems(cwd: string): {
  root: string;
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
  return { root, items, details };
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
 * True when the item has open dependencies (dep not done/cancelled; unknown
 * dep ids count as open — the shared view-model rule, ADR 0004).
 */
export function tuiDepBlocked(items: WorkItem[], item: WorkItem): boolean {
  if (item.depends_on.length === 0) return false;
  return hasOpenDependencies(item.depends_on, buildStatusIndex(items));
}

/** Visible card count per status, aligned with STATUSES (for key clamping). */
export function tuiColumnCounts(items: WorkItem[], filter: string): number[] {
  const counts = statusCounts(visibleItems(items, filter));
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
  const columnItems = tuiColumnItems(items, state.filter, STATUSES[state.column]);
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
 * Optional per-keypress context: the loop owns the data, the reducer stays
 * pure. `counts` are the visible card counts per status (tuiColumnCounts);
 * `selectedId` is the board card under the cursor (Enter opens its pane);
 * `detailLines` is the open pane's total display line count (without it the
 * pane reducer cannot clamp the window, so PgUp/PgDn fall back to unbounded
 * moves for pure tests).
 */
export type TuiKeyContext = {
  counts?: number[];
  selectedId?: string | null;
  detailLines?: number;
};

/**
 * Pure keypress reducer (board and detail pane). Board: Enter opens the
 * read-only detail pane for the selected item (task-tui-detail-pane), Esc
 * clears the filter, card moves keep the scroll window following the
 * selection whenever `counts` carries the selected column. Detail pane: Esc
 * and Enter return to the board with every board field untouched, ↑/↓ and
 * PgUp/PgDn/Home/End scroll the pane, q quits. Never mutates the input state.
 */
export function handleKey(state: TuiState, key: string, ctx: TuiKeyContext = {}): TuiState {
  // Ctrl-C quits from anywhere, pane and search prompt included.
  if (key === CTRL_C) return { ...state, quit: true };
  if (state.detail !== null) return handleDetailKey(state, key, ctx.detailLines ?? 0);

  const counts = ctx.counts ?? [];

  if (state.searching) {
    if (key === ESC) return { ...state, searching: false, filter: "" };
    if (key === ENTER || key === "\n") return { ...state, searching: false };
    if (key === BACKSPACE || key === "\b") {
      return { ...state, filter: state.filter.slice(0, -1) };
    }
    if (key.length === 1 && key >= " ") {
      return { ...state, filter: state.filter + key };
    }
    return state;
  }

  switch (key) {
    case "q":
      return { ...state, quit: true };
    case "/":
      return { ...state, searching: true, message: null };
    case ESC:
      // Esc clears the filter (and any transient message), keeps the view.
      return { ...state, filter: "", message: null };
    case ENTER:
    case "\n":
      if (ctx.selectedId) {
        // Enter reads the item instead of printing its path: the pane carries
        // the path, the body, the acceptance rows and the dependencies.
        return { ...state, detail: { id: ctx.selectedId, scroll: 0 }, message: null };
      }
      return { ...state, message: "(no item selected)" };
    case ARROW_LEFT:
      return moveColumn(state, -1, counts);
    case ARROW_RIGHT:
      return moveColumn(state, 1, counts);
    case ARROW_UP:
      return moveCard(state, -1, counts);
    case ARROW_DOWN:
      return moveCard(state, 1, counts);
    case PAGE_UP:
      return moveCard(state, -pageStep(state), counts);
    case PAGE_DOWN:
      return moveCard(state, pageStep(state), counts);
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
      return scrollTo(detail.scroll - 1);
    case ARROW_DOWN:
      return scrollTo(detail.scroll + 1);
    case PAGE_UP:
      return scrollTo(detail.scroll - page);
    case PAGE_DOWN:
      return scrollTo(detail.scroll + page);
    default:
      if (HOME_KEYS.has(key)) return scrollTo(0);
      if (END_KEYS.has(key)) return scrollTo(lines);
      return state;
  }
}

/** Cards a PgUp/PgDn moves: one body page, at least one row. */
function pageStep(state: TuiState): number {
  return Math.max(1, tuiBodyRows(state.height));
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
  return `${marker} ${badge} ${sanitizeHumanTextUncapped(item.id)}${blockedTag} ${title}`;
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
  const visible = visibleTuiItems(items, state.filter);
  const counts = tuiColumnCounts(items, state.filter);
  const cardRows = tuiBodyRows(height);
  const selectedCount = counts[state.column] ?? 0;
  // The frame is always valid even with a stale state: the window is
  // re-derived from the selection on every render (followTuiScroll), so the
  // selected card is drawn whenever the column has one.
  const selectedCard =
    selectedCount === 0 ? 0 : Math.min(Math.max(state.card, 0), selectedCount - 1);
  const scroll = followTuiScroll(selectedCard, state.scroll, selectedCount, cardRows);

  const lines: string[] = [];

  // Header: title, totals, active filter.
  const total = visible.length;
  let header = `arggon board --tui · ${total} item(s)`;
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
    return visible
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
  // always leads, then the search prompt > transient message > key help — so
  // a narrow terminal clips the help instead of the position.
  const position = `row ${selectedCount === 0 ? 0 : selectedCard + 1}/${selectedCount}`;
  let footer: string;
  if (state.searching) {
    footer = `${position} · /${state.filter}█ — enter to apply, esc to cancel`;
  } else if (state.message !== null) {
    // Transient messages are repo-controlled text (an old path message, the
    // "(no item selected)" hint): escape before rendering.
    footer = `${position} · ${sanitizeHumanTextUncapped(state.message)}`;
  } else {
    footer = `${position} · ←/→ column · ↑/↓ card · PgUp/PgDn page · home/end · / search · enter detail · q quit`;
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
 * cascade checks, never a second interpretation of it.
 */
export function tuiAcceptanceRows(body: string): TuiAcceptanceRow[] {
  const rows: TuiAcceptanceRow[] = [];
  for (const line of body.split("\n")) {
    const match = /^[ \t]*[-*] \[( |x|X)\]/.exec(line);
    if (!match) continue;
    rows.push({ checked: match[1] !== " ", text: line.slice(match[0].length).trim() });
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
 * The frame the loop draws (task-tui-detail-pane): the board, or the read-only
 * detail pane when `state.detail` is set. Pure; `details` carries the bodies
 * loaded beside the contract items (loadTuiItems).
 */
export function renderTuiScreen(
  items: WorkItem[],
  state: TuiState,
  details: ReadonlyMap<string, TuiDetailSource> = new Map(),
  opts: { color?: boolean } = {},
): string {
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
};

/**
 * Interactive loop for `arggon board --tui`. Read-only: it re-reads the tree
 * after every keypress (cheap at v0 scale) and never writes. Enter opens the
 * read-only detail pane; Esc/Enter return to the board. Fails with an
 * actionable error when stdout is not a TTY (piped output cannot render).
 */
export function runTuiBoard(opts: TuiLoopOptions): Promise<void> {
  const output: TuiOutput = opts.output ?? process.stdout;
  const input = opts.input ?? process.stdin;
  if (output.isTTY !== true) {
    return Promise.reject(
      new Error("board --tui requires an interactive terminal (stdout is not a TTY)"),
    );
  }
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
    let current = state;
    let settled = false;

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
      output.write(renderTuiScreen(items, current, details));
    };

    const onData = (chunk: string | Buffer): void => {
      try {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        for (const key of splitKeys(text)) {
          // Context is re-derived per key: a chunk may open the pane, scroll
          // it and close it again, and each key must be reduced against the
          // state (and the data) the previous one left behind.
          const counts = tuiColumnCounts(items, current.filter);
          const selected = selectedTuiItem(items, current);
          const detailLines =
            current.detail === null
              ? 0
              : tuiDetailLinesFor(items, details, current.detail, current.width).length;
          current = handleKey(current, key, {
            counts,
            selectedId: selected?.id ?? null,
            detailLines,
          });
          if (current.quit) {
            finish();
            return;
          }
        }
        // Re-read before clamping: the tree is the source of truth and may
        // have changed while we were idle (no file watcher in v0); the clamp
        // then uses the fresh counts, keeping the scroll window valid. The
        // detail pane re-derives its own window per frame from the fresh
        // bodies, so a body that shrank while open still renders valid.
        const fresh = loadTuiItems(opts.cwd);
        items = fresh.items;
        details = fresh.details;
        current = clampTuiState(current, tuiColumnCounts(items, current.filter));
        render();
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
        current = clampTuiState(current, tuiColumnCounts(items, current.filter));
        render();
      } catch (err) {
        fail(err);
      }
    };

    const rawCapable = input as { setRawMode?: (mode: boolean) => unknown };
    const cleanup = (): void => {
      input.removeListener("data", onData);
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
 * Split a stdin chunk into single keystrokes: CSI escape sequences stay
 * together (arrows, PgUp/PgDn, Home/End), everything else is one key per
 * character. A CSI sequence is `ESC [`, parameter bytes (0x30-0x3f),
 * intermediate bytes (0x20-0x2f) and one final byte (0x40-0x7e) — reading the
 * whole run keeps `\x1b[6~` (PgDn) from splitting into `\x1b[6` + `~`.
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
