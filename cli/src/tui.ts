/**
 * Terminal UI kanban (`arggon board --tui`) — story-tui-board / task-tui-board.
 *
 * Read-only interactive view over the same kernel read path as `list --json`
 * and the HTML board (loadItems -> toContractWorkItem). Dependency-light per
 * ADR 0001: raw ANSI escapes (clear/home, SGR colors, alternate screen), no
 * TUI framework, zero new npm dependencies.
 *
 * Hygiene split (task-tui-board): every pure piece lives here as an exported
 * function — `renderTui` (frame -> string, golden-tested), `handleKey`
 * (keypress reducer), `clampTuiState` (selection bounds), `tuiColumnCounts`,
 * `tuiBodyRows` + `followTuiScroll` (the scroll window), `loadTuiItems`
 * (shared data path). `runTuiBoard` only wires raw mode, keypress events and
 * resize to the pure pieces; it performs no writes anywhere.
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

/** One-letter type badge per v0 type (I/E/S/T/B). */
export const TYPE_BADGES: Record<WorkItem["type"], string> = {
  initiative: "I",
  epic: "E",
  story: "S",
  task: "T",
  bug: "B",
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
  /** Transient footer line (e.g. the item path printed on Enter). */
  message: string | null;
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
    quit: false,
  };
}

/**
 * Items feeding the TUI: same kernel read path as the HTML board, sorted
 * lexicographically by id (same rule as renderBoardHtml / list), through the
 * shared view-model.
 */
export function loadTuiItems(cwd: string): { root: string; items: WorkItem[] } {
  const tasksDir = findTasksDir(cwd);
  const root = repoRootFromTasks(tasksDir);
  const items = sortById(loadItems(tasksDir)).map((item) => toContractWorkItem(item, root));
  return { root, items };
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
 * Pure keypress reducer. `counts` are the visible card counts per status
 * (see tuiColumnCounts); `selectedPath` is the path of the currently selected
 * item, printed into the footer by Enter. Card moves keep the scroll window
 * following the selection (and clamp at the column edges) whenever `counts`
 * carries the selected column; without counts the reducer falls back to the
 * unbounded card moves of the pure cases. Never mutates the input state.
 */
export function handleKey(
  state: TuiState,
  key: string,
  counts: number[] = [],
  selectedPath: string | null = null,
): TuiState {
  // Ctrl-C quits from anywhere, search prompt included.
  if (key === CTRL_C) return { ...state, quit: true };

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
      return { ...state, message: selectedPath ?? "(no item selected)" };
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
    // The message is the selected item's file path (Enter), i.e. repo-
    // controlled filename bytes: escape before rendering.
    footer = `${position} · ${sanitizeHumanTextUncapped(state.message)}`;
  } else {
    footer = `${position} · ←/→ column · ↑/↓ card · PgUp/PgDn page · home/end · / search · enter path · q quit`;
  }
  lines.push(padEndTo(clipLine(footer, width), width));

  return `\x1b[H\x1b[2J${lines.join("\n")}`;
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
 * after every keypress (cheap at v0 scale) and never writes. Fails with an
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
  const { items: initialItems } = loadTuiItems(opts.cwd);
  const size = (value: number | undefined, fallback: number): number =>
    typeof value === "number" && value > 0 ? value : fallback;
  const state = initialTuiState(
    opts.width ?? size(output.columns, TUI_DEFAULT_WIDTH),
    opts.height ?? size(output.rows, TUI_DEFAULT_HEIGHT),
  );

  return new Promise<void>((resolve, reject) => {
    let items = initialItems;
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
      output.write(renderTui(items, current));
    };

    const onData = (chunk: string | Buffer): void => {
      try {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        const counts = tuiColumnCounts(items, current.filter);
        const selected = selectedTuiItem(items, current);
        for (const key of splitKeys(text)) {
          current = handleKey(current, key, counts, selected?.path ?? null);
          if (current.quit) {
            finish();
            return;
          }
        }
        // Re-read before clamping: the tree is the source of truth and may
        // have changed while we were idle (no file watcher in v0); the clamp
        // then uses the fresh counts, keeping the scroll window valid.
        items = loadTuiItems(opts.cwd).items;
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
