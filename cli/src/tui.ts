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
 * (keypress reducer), `clampTuiState` (selection bounds), `loadTuiItems`
 * (shared data path). `runTuiBoard` only wires raw mode, keypress events and
 * resize to the pure pieces; it performs no writes anywhere.
 */
import { toContractWorkItem } from "./contract.js";
import { loadItems } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { STATUSES } from "./status.js";
import type { WorkItem } from "./types.js";

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
    filter: "",
    searching: false,
    message: null,
    quit: false,
  };
}

/**
 * Items feeding the TUI: same kernel read path as the HTML board, sorted
 * lexicographically by id (same rule as renderBoardHtml / list).
 */
export function loadTuiItems(cwd: string): { root: string; items: WorkItem[] } {
  const tasksDir = findTasksDir(cwd);
  const root = repoRootFromTasks(tasksDir);
  const items = loadItems(tasksDir)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((item) => toContractWorkItem(item, root));
  return { root, items };
}

/** Case-insensitive substring match on id or title (empty filter matches all). */
export function tuiFilterMatches(item: WorkItem, filter: string): boolean {
  if (filter === "") return true;
  const needle = filter.toLowerCase();
  return (
    item.id.toLowerCase().includes(needle) || (item.title ?? "").toLowerCase().includes(needle)
  );
}

/** Filtered + lexicographically sorted items (the cards the TUI renders). */
export function visibleTuiItems(items: WorkItem[], filter: string): WorkItem[] {
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted.filter((item) => tuiFilterMatches(item, filter));
}

/** Items of one column, filtered. */
export function tuiColumnItems(items: WorkItem[], filter: string, status: string): WorkItem[] {
  return visibleTuiItems(items, filter).filter((item) => item.status === status);
}

/** Visible card count per status, aligned with STATUSES (for key clamping). */
export function tuiColumnCounts(items: WorkItem[], filter: string): number[] {
  return STATUSES.map((status) => tuiColumnItems(items, filter, status).length);
}

/**
 * Clamp the selection against real column sizes (used after filters change or
 * the tree is re-read; a selection may otherwise point past the end).
 */
export function clampTuiState(state: TuiState, counts: number[]): TuiState {
  const column = Math.min(Math.max(state.column, 0), Math.max(STATUSES.length - 1, 0));
  const count = counts[column] ?? 0;
  const card = count === 0 ? 0 : Math.min(Math.max(state.card, 0), count - 1);
  return { ...state, column, card };
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
const CTRL_C = "\x03";
const ESC = "\x1b";
const ENTER = "\r";
const BACKSPACE = "\x7f";

/**
 * Pure keypress reducer. `counts` are the visible card counts per status
 * (see tuiColumnCounts); `selectedPath` is the path of the currently selected
 * item, printed into the footer by Enter. Never mutates the input state.
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
      return { ...state, card: Math.max(state.card - 1, 0), message: null };
    case ARROW_DOWN:
      return { ...state, card: state.card + 1, message: null };
    default:
      return state;
  }
}

function moveColumn(state: TuiState, delta: number, counts: number[]): TuiState {
  const column = Math.min(Math.max(state.column + delta, 0), STATUSES.length - 1);
  if (column === state.column) return state;
  const count = counts[column] ?? 0;
  const card = count === 0 ? 0 : Math.min(state.card, count - 1);
  return { ...state, column, card, message: null };
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

function cardLine(item: WorkItem, selected: boolean): string {
  const marker = selected ? ">" : " ";
  const badge = TYPE_BADGES[item.type];
  const title = item.title ?? item.id;
  return `${marker} ${badge} ${item.id} ${title}`;
}

/**
 * Pure frame renderer: the whole terminal screen as one string (with a
 * leading clear+home and exactly `height` lines, each padded to `width` so
 * consecutive frames never ghost). Columns are the v0 statuses in enum
 * order, one card row per visible item, footer carries help / search prompt
 * / last message. With `color: false` (tests) no SGR sequences are emitted.
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
  const cardRows = Math.max(0, height - 3);

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

  // Card rows: one line per item, per column, up to the body height.
  const columnCards = STATUSES.map((status, i) =>
    tuiColumnItems(items, state.filter, status).map((item, j) => {
      const line = padEndTo(
        clipLine(cardLine(item, i === state.column && j === state.card), colWidth),
        colWidth,
      );
      if (!color) return line;
      return i === state.column && j === state.card ? `\x1b[7m${line}\x1b[0m` : line;
    }),
  );
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

  // Footer: search prompt > transient message > key help.
  let footer: string;
  if (state.searching) {
    footer = `/${state.filter}█ — enter to apply, esc to cancel`;
  } else if (state.message !== null) {
    footer = state.message;
  } else {
    footer = "←/→ column · ↑/↓ card · / search · enter path · q quit";
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
  input?: NodeJS.ReadableStream & { setRawMode?: (mode: boolean) => unknown; resume?: () => unknown };
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
        current = clampTuiState(current, tuiColumnCounts(items, current.filter));
        // Re-read after every keypress: the tree is the source of truth and
        // may have changed while we were idle (no file watcher in v0).
        items = loadTuiItems(opts.cwd).items;
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
 * Split a stdin chunk into single keystrokes: escape sequences stay together
 * (arrows), everything else is one key per character.
 */
function splitKeys(text: string): string[] {
  const keys: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === ESC && text.length - i >= 3 && text[i + 1] === "[") {
      keys.push(text.slice(i, i + 3));
      i += 3;
      continue;
    }
    keys.push(text[i]);
    i += 1;
  }
  return keys;
}
