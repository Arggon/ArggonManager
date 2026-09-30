/**
 * ArggonManager TUI plugin (W5, `task-native-tui`) — the board/status surface.
 *
 * OpenCode V2 discovers the TUI entry beside the server entry in the same
 * plugin directory (`.opencode/plugins/arggon/tui.tsx` next to `index.ts`,
 * docs/playbooks/opencode.md). `arggon init` vendors this file verbatim (it is
 * NOT bundled): the runtime transpiles it and resolves `solid-js` itself, while
 * the board data comes from the vendored bundle through a relative import
 * (`./index.ts`), so the adopter tree still needs no `node_modules`.
 *
 * Registered surfaces (all feature-detected, failure-isolated — a missing
 * surface logs once and no-ops, exactly like the server plugin):
 *
 * - `session.panel` contribution `arggon.board`: the tree (epic/story/leaf),
 *   per-item status, the session's active item and the kernel `next`
 *   suggestion, with a navigable selection cursor (`j`/`k`, `PgUp`/`PgDn`,
 *   `g`/`G`), `Enter` toggling a bounded inline detail block (body +
 *   acceptance rows, read through the kernel's `runShow`), `n`/`a` jumping to
 *   the kernel `next` suggestion and the session's active item, a per-session
 *   view (`s` text filter with live matching, `d` hide done/cancelled,
 *   `z`/`Z` subtree fold, restored on reopen), `r` reloading manually, a timer
 *   re-reading the tracker live (`BOARD_REFRESH_MS`, `r` unchanged), `f`
 *   full-screen and `esc` stepping back out (filter editor → detail → filters
 *   → panel). Opened by the `arggon.board.open` command (slash
 *   `/arggon-board`, palette, `ctrl+g`).
 * - `sidebar.content` contribution: one status line (active item, or the ready
 *   count) so the item status is visible without opening the panel; it
 *   re-reads on the same live-refresh interval instead of mount-only.
 * - `app` slot: hosts the global keymap layer (the documented home for plugin
 *   commands — `context.keymap.layer` requires a rendered provider).
 *
 * Display only: every read goes through `board.ts` → the kernel; nothing here
 * writes to the tracker.
 */
import { Show, createSignal, onCleanup } from "solid-js";
import {
  ARGON_BOARD_PANEL,
  boardItemDetail,
  boardSnapshot,
  boardToggleFold,
  boardToggleFoldAll,
  boardToggleHideDone,
  boardTreeLines,
  boardViewActive,
  emptyBoardSelection,
  emptyBoardSnapshot,
  emptyBoardView,
  moveBoardSelection,
  resolveBoardSelection,
  selectBoardItem,
  sidebarStatusLine,
  type BoardItemDetail,
  type BoardSelection,
  type BoardSelectionMove,
  type BoardSnapshot,
  type BoardView,
} from "./index.ts";

/** Slash-command name and command id (stable contract, tested). */
export const ARGON_BOARD_COMMAND = "arggon.board.open";
export const ARGON_BOARD_SLASH = "arggon-board";
export const ARGON_BOARD_BIND = "ctrl+g";

/** Panel props the host passes to a `session.panel` contribution. */
export type ArgonTuiPanel = {
  name?: unknown;
  sessionID?: unknown;
  width?: unknown;
  presentation?: unknown;
  focused?: unknown;
  close?(): unknown;
  toggleFullscreen?(): unknown;
  focus?(): unknown;
};

/** Minimal structural typing: the vendored file imports no plugin types. */
export type ArgonTuiSlot = {
  append?: string;
  prepend?: string;
  before?: string;
  after?: string;
  replace?: string;
  render(props?: unknown): unknown;
};

export type ArgonTuiContext = {
  location?: { directory?: unknown };
  ui?: {
    slot?(input: ArgonTuiSlot): unknown;
    panel?: { open?(name: string, options?: unknown): unknown };
    toast?: { show?(input: { message?: string; title?: string; variant?: string }): unknown };
  };
  keymap?: { layer?(factory: () => unknown): unknown };
  data?: {
    location?: {
      vcs?: {
        info?(location?: unknown): { branch?: { current?: unknown } } | undefined | null;
      };
    };
  };
};

export type ArgonTuiOptions = {
  /** Project directory to read the tracker from (defaults to the location). */
  cwd?: string;
  /** `ARGON_ITEM` override (defaults to `process.env.ARGON_ITEM`). */
  envItem?: string | null;
};

/**
 * Failure-isolation log dedupe: a repeated failure logs once per process and
 * no-ops (the server plugin's contract, applied to the TUI surfaces).
 */
const loggedScopes = new Set<string>();

function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logTui(scope: string, message: string, error?: unknown): void {
  if (loggedScopes.has(scope)) return;
  loggedScopes.add(scope);
  const suffix = error === undefined ? "" : ` (${detail(error)})`;
  console.error(`[arggon] tui ${scope}: ${message}${suffix}`);
}

/** Options for the panel controller (the host wiring is injected, not read). */
export type BoardControllerOptions = {
  /** Project directory the tracker is read from. */
  cwd: string;
  /** Panel width reader (0 = unknown: no clipping). */
  width?: () => number;
  /** Snapshot reader; the panel passes its failure-isolated reader. */
  readSnapshot: () => BoardSnapshot;
  /** Detail row budget override (tests). */
  detailRows?: number;
  /** Host panel close action (`esc` with no detail block open). */
  close?: () => void;
  /** Toast channel for a jump with no target. */
  toast?: (message: string) => void;
  /** Host full-screen toggle (the `f` key). */
  fullscreen?: () => void;
  /** View state restored from the session (fold/hide/filter persist). */
  initialView?: BoardView;
  /** View-state sink — the panel keeps it per session. */
  onViewChange?: (view: BoardView) => void;
};

/** Panel state + actions, testable without the host JSX runtime. */
export type BoardController = {
  /** Panel lines for the current state (header, counts, view, tree, detail). */
  lines(): string[];
  selection(): BoardSelection;
  detail(): BoardItemDetail | null;
  /** The fold/hide/filter view currently applied to the tree. */
  view(): BoardView;
  /** True while the filter editor owns the letter keys. */
  filterEditing(): boolean;
  move(direction: BoardSelectionMove): void;
  /** Select the id; toasts `no <label>` when it is absent from the tree. */
  jump(id: string | null, label: string): void;
  /** Jump to the kernel `next` suggestion (toasts when the pool is empty). */
  jumpNext(): void;
  /** Jump to the session's active item (toasts when none resolves). */
  jumpActive(): void;
  /** Toggle the inline detail block for the selected item. */
  toggleDetail(): void;
  /** Re-read the tracker, keeping the selection when the item still exists. */
  reload(): void;
  /**
   * Live-refresh tick (the panel and sidebar call it on a timer): same
   * guarantees as `reload`, but a open detail block is re-read instead of
   * closed so background updates never disturb reading.
   */
  refresh(): void;
  /**
   * The mode-aware key entry the keymap binds route through: while the filter
   * editor is open the letter/backspace/return keys edit the filter, otherwise
   * they act (`s` filter, `d` hide done, `z`/`Z` fold, `j`/`k`/… navigate).
   */
  key(token: string): void;
  /** `esc`: close the detail block first, then the panel. */
  escape(): void;
};

/**
 * Filter-editor charset: lowercase letters route through the letter binds, the
 * remaining id characters (digits, `-`, `_`, `.`, `/`) through the extended
 * best-effort layer. Uppercase is unreachable by design — matching is
 * case-insensitive.
 */
const BOARD_FILTER_CHARS = /^[a-z0-9._/-]$/;

/** The per-key view-state refresh interval (live refresh; 0 disables). */
export const BOARD_REFRESH_MS = 10_000;

/**
 * Live-refresh interval: `ARGON_BOARD_REFRESH_MS` overrides (0 disables the
 * timer, `r` stays); anything non-numeric or negative falls back to the
 * default. A tick is one in-process kernel read — bounded and cheap.
 */
export function boardRefreshMs(): number {
  const raw = Number(process.env.ARGON_BOARD_REFRESH_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : BOARD_REFRESH_MS;
}

/**
 * Per-session view state (task-native-panel-refresh-filter): fold/hide/filter
 * survive closing and reopening the panel and never leak across sessions.
 * Session-scoped memory by design — the panel holds no durable host storage
 * contract, so the state lives as long as the session does.
 */
const sessionViews = new Map<string, BoardView>();

/** The view stored for a session (a defensive copy; empty when none). */
export function boardSessionView(sessionID: string): BoardView {
  const stored = sessionViews.get(sessionID);
  return stored === undefined ? emptyBoardView() : { ...stored, folded: [...stored.folded] };
}

/** Store the view for a session (a defensive copy). */
export function setBoardSessionView(sessionID: string, view: BoardView): void {
  sessionViews.set(sessionID, { ...view, folded: [...view.folded] });
}

/**
 * The panel's selection/detail/view state machine over a `BoardSnapshot`. Every
 * read goes through `board.ts` (nothing here writes); the returned `lines()`
 * is the plain-text body the component renders. Kept exported so the keymap
 * wiring is tested against the real state machine without the host runtime.
 */
export function createBoardController(options: BoardControllerOptions): BoardController {
  const [snapshot, setSnapshot] = createSignal<BoardSnapshot>(options.readSnapshot());
  const [selection, setSelection] = createSignal<BoardSelection>(emptyBoardSelection());
  const [detail, setDetail] = createSignal<BoardItemDetail | null>(null);
  const [view, setView] = createSignal<BoardView>(options.initialView ?? emptyBoardView());
  const [filterEditing, setFilterEditing] = createSignal(false);
  // Seed the cursor on the first line; the same id-first resolution `r` uses,
  // so mount and reload cannot drift.
  setSelection(resolveBoardSelection(snapshot(), emptyBoardSelection(), view()));

  /** Apply a view change: re-resolve the cursor against the visible tree. */
  const applyView = (next: BoardView): void => {
    setView(next);
    setSelection(resolveBoardSelection(snapshot(), selection(), next));
    options.onViewChange?.(next);
  };

  const move = (direction: BoardSelectionMove): void => {
    setSelection(moveBoardSelection(snapshot(), selection(), direction, view()));
    // The block belongs to one line: moving away returns to the tree.
    setDetail(null);
  };

  const jump = (id: string | null, label: string): void => {
    const target = selectBoardItem(snapshot(), id, view());
    if (target === null) {
      options.toast?.(`arggon board: no ${label}`);
      return;
    }
    setSelection(target);
    setDetail(null);
  };

  const jumpNext = (): void => jump(snapshot().nextId, "next suggestion");
  const jumpActive = (): void => jump(snapshot().activeId, "active item");

  const readDetail = (id: string): BoardItemDetail =>
    options.detailRows === undefined
      ? boardItemDetail(options.cwd, id)
      : boardItemDetail(options.cwd, id, { rows: options.detailRows });

  const toggleDetail = (): void => {
    const selected = selection().id;
    if (selected === null) return;
    if (detail()?.id === selected) {
      setDetail(null);
      return;
    }
    setDetail(readDetail(selected));
  };

  const reload = (): void => {
    setSnapshot(options.readSnapshot());
    setSelection(resolveBoardSelection(snapshot(), selection(), view()));
    setDetail(null);
  };

  const refresh = (): void => {
    setSnapshot(options.readSnapshot());
    setSelection(resolveBoardSelection(snapshot(), selection(), view()));
    // A live tick must not close an open detail block: re-read it instead (a
    // deleted item degrades to the bounded error detail).
    const open = detail()?.id;
    if (open !== undefined && open !== null) setDetail(readDetail(open));
  };

  const enterFilter = (): void => {
    setFilterEditing(true);
  };

  /**
   * Mode-aware key dispatch (the whole keymap routes through here). While the
   * filter editor is open, printable keys append (live filtering), backspace
   * deletes and return/escape leave the editor; otherwise the tokens act.
   */
  const key = (token: string): void => {
    if (filterEditing()) {
      if (token === "return" || token === "escape") {
        setFilterEditing(false);
        return;
      }
      if (token === "backspace") {
        applyView({ ...view(), text: view().text.slice(0, -1) });
        return;
      }
      if (BOARD_FILTER_CHARS.test(token)) {
        applyView({ ...view(), text: view().text + token });
      }
      return;
    }
    switch (token) {
      case "escape":
        // Step back out: detail block, then the view filters, then the panel.
        if (detail() !== null) {
          setDetail(null);
          return;
        }
        if (boardViewActive(view())) {
          applyView(emptyBoardView());
          return;
        }
        options.close?.();
        return;
      case "return":
        toggleDetail();
        return;
      case "down":
      case "j":
        move("down");
        return;
      case "up":
      case "k":
        move("up");
        return;
      case "page-up":
        move("page-up");
        return;
      case "page-down":
        move("page-down");
        return;
      case "first":
      case "g":
        move("first");
        return;
      case "last":
        move("last");
        return;
      case "n":
        jumpNext();
        return;
      case "a":
        jumpActive();
        return;
      case "s":
        enterFilter();
        return;
      case "d":
        applyView(boardToggleHideDone(view()));
        return;
      case "z":
        applyView(boardToggleFold(view(), snapshot().items, selection().id));
        return;
      case "Z":
        applyView(boardToggleFoldAll(view(), snapshot().items));
        return;
      case "r":
        reload();
        return;
      case "f":
        options.fullscreen?.();
        return;
      default:
        return;
    }
  };

  const escape = (): void => {
    if (detail() !== null) {
      setDetail(null);
      return;
    }
    options.close?.();
  };

  return {
    lines: () =>
      boardTreeLines(snapshot(), {
        width: options.width?.() ?? 0,
        selection: selection(),
        detail: detail(),
        view: view(),
        filterEditing: filterEditing(),
      }),
    selection,
    detail,
    view,
    filterEditing,
    move,
    jump,
    jumpNext,
    jumpActive,
    toggleDetail,
    reload,
    refresh,
    key,
    escape,
  };
}

/**
 * Register the board/status surface on a TUI context. Returns a disposer that
 * unregisters every slot contribution (the `setup` cleanup contract). The
 * components read the tracker through `boardSnapshot` on mount and re-read it
 * on the live-refresh interval.
 */
export function registerArgonTui(
  context: ArgonTuiContext,
  options: ArgonTuiOptions = {},
): () => void {
  const disposers: Array<() => void> = [];
  let commandLayerRegistered = false;
  const cwd = (): string =>
    options.cwd ??
    (typeof context.location?.directory === "string" ? context.location.directory : process.cwd());

  const readBranch = (): string | null => {
    try {
      const vcs = context.data?.location?.vcs;
      const info = vcs?.info?.(context.location);
      const current = info?.branch?.current;
      return typeof current === "string" ? current : null;
    } catch {
      return null;
    }
  };

  /**
   * Read the snapshot for one render. `boardSnapshot` is contractually total
   * (no tracker and corrupt tracker both degrade to an error snapshot); this
   * per-surface guard is the belt-and-braces: a slot crash would otherwise take
   * the whole panel down with a host overlay (W5 review P1).
   */
  const readSnapshot = (): BoardSnapshot => {
    try {
      return boardSnapshot(cwd(), {
        branch: readBranch(),
        // An explicit `null` disables the env override (tests / embedders).
        envItem: options.envItem === undefined ? (process.env.ARGON_ITEM ?? null) : options.envItem,
      });
    } catch (error) {
      logTui("snapshot", "board read failed", error);
      return emptyBoardSnapshot("board read failed");
    }
  };

  const toast = (message: string): void => {
    try {
      context.ui?.toast?.show?.({ message, variant: "warning" });
    } catch (error) {
      logTui("toast", "toast failed", error);
    }
  };

  /** Open the board panel; `false` means "no active session" (host contract). */
  const openBoard = (): void => {
    const open = context.ui?.panel?.open;
    if (typeof open !== "function") {
      toast("arggon board: this OpenCode build has no session panels");
      return;
    }
    try {
      if (open(ARGON_BOARD_PANEL) === false) toast("arggon board: open a session first");
    } catch (error) {
      logTui("panel", "panel.open failed", error);
    }
  };

  /**
   * Panel body: cursor navigation, `enter` detail, `n`/`a` jumps, `s` filter,
   * `d` hide done, `z`/`Z` fold, `r` reload, `f` full-screen, `esc` stepping
   * back out (filter editor → detail → filters → panel). The binds are the
   * documented OpenCode key names (docs/playbooks/opencode.md § TUI); a plain
   * letter bound in a panel layer is active only while the panel owns input.
   * The extended layer (digits, `-`, `_`, `.`, `/`, `backspace`) is registered
   * separately so an unknown key name on a host can only cost those keys, not
   * the whole panel layer.
   */
  const BoardPanel = (props: { panel: ArgonTuiPanel }) => {
    const width = (): number => (typeof props.panel?.width === "number" ? props.panel.width : 0);
    const sessionID =
      typeof props.panel?.sessionID === "string" ? props.panel.sessionID : "default";
    const board = createBoardController({
      cwd: cwd(),
      width,
      readSnapshot,
      close: () => props.panel?.close?.(),
      toast,
      fullscreen: () => props.panel?.toggleFullscreen?.(),
      initialView: boardSessionView(sessionID),
      onViewChange: (view) => setBoardSessionView(sessionID, view),
    });
    // Live refresh: one in-process kernel read per tick (selection, view and an
    // open detail block survive; `r` stays the manual, detail-closing reload).
    const refreshMs = boardRefreshMs();
    if (refreshMs > 0) {
      const timer = setInterval(() => board.refresh(), refreshMs);
      onCleanup(() => clearInterval(timer));
    }
    /** Letters with no action of their own: they only feed the filter editor. */
    const inertLetters = [..."bcehilmopqtuvwxy"];
    try {
      context.keymap?.layer?.(() => ({
        commands: [
          { id: "arggon.board.down", bind: "j", run: () => board.key("down") },
          { id: "arggon.board.down.arrow", bind: "down", run: () => board.key("down") },
          { id: "arggon.board.up", bind: "k", run: () => board.key("up") },
          { id: "arggon.board.up.arrow", bind: "up", run: () => board.key("up") },
          { id: "arggon.board.page-down", bind: "pagedown", run: () => board.key("page-down") },
          { id: "arggon.board.page-up", bind: "pageup", run: () => board.key("page-up") },
          { id: "arggon.board.first", bind: "g", run: () => board.key("first") },
          { id: "arggon.board.first.home", bind: "home", run: () => board.key("first") },
          { id: "arggon.board.last", bind: "shift+g", run: () => board.key("last") },
          { id: "arggon.board.last.end", bind: "end", run: () => board.key("last") },
          { id: "arggon.board.detail", bind: "return", run: () => board.key("return") },
          { id: "arggon.board.next", bind: "n", run: () => board.key("n") },
          { id: "arggon.board.active", bind: "a", run: () => board.key("a") },
          { id: "arggon.board.filter.edit", bind: "s", run: () => board.key("s") },
          { id: "arggon.board.hide-done", bind: "d", run: () => board.key("d") },
          { id: "arggon.board.fold", bind: "z", run: () => board.key("z") },
          { id: "arggon.board.fold.all", bind: "shift+z", run: () => board.key("Z") },
          {
            id: "arggon.board.fullscreen",
            bind: "f",
            run: () => board.key("f"),
          },
          { id: "arggon.board.reload", bind: "r", run: () => board.key("r") },
          { id: "arggon.board.close", bind: "escape", run: () => board.key("escape") },
          ...inertLetters.map((letter) => ({
            id: `arggon.board.char.${letter}`,
            bind: letter,
            run: () => board.key(letter),
          })),
        ],
      }));
    } catch (error) {
      logTui("panel-keymap", "panel key layer unavailable", error);
    }
    // Best-effort extended keys for the filter editor: id-style characters and
    // backspace. A host that rejects any of these names only loses them.
    try {
      context.keymap?.layer?.(() => ({
        commands: [
          {
            id: "arggon.board.filter.backspace",
            bind: "backspace",
            run: () => board.key("backspace"),
          },
          { id: "arggon.board.char./", bind: "/", run: () => board.key("/") },
          ...[..."0123456789._-"].map((character) => ({
            id: `arggon.board.char.${character}`,
            bind: character,
            run: () => board.key(character),
          })),
        ],
      }));
    } catch (error) {
      logTui("panel-keymap-ext", "panel extended key layer unavailable", error);
    }
    return (
      <box flexDirection="column">
        {() => board.lines().map((line) => <text>{line}</text>)}
      </box>
    );
  };

  /**
   * Sidebar contribution: active item status (or the ready count). Live: the
   * snapshot re-reads on the same interval as the panel instead of mount-only.
   */
  const SidebarStatus = () => {
    const [snapshot, setSnapshot] = createSignal<BoardSnapshot>(readSnapshot());
    const refreshMs = boardRefreshMs();
    if (refreshMs > 0) {
      const timer = setInterval(() => setSnapshot(readSnapshot()), refreshMs);
      onCleanup(() => clearInterval(timer));
    }
    return <text>{sidebarStatusLine(snapshot())}</text>;
  };

  /** Global commands live in a rendered provider (the `app` slot). */
  const registerCommands = (): null => {
    if (commandLayerRegistered) return null;
    commandLayerRegistered = true;
    try {
      context.keymap?.layer?.(() => ({
        mode: "global",
        priority: 10,
        commands: [
          {
            id: ARGON_BOARD_COMMAND,
            title: "Open Arggon board",
            group: "Arggon",
            bind: ARGON_BOARD_BIND,
            palette: true,
            suggested: true,
            slash: { name: ARGON_BOARD_SLASH },
            run: () => openBoard(),
          },
        ],
        bindings: [ARGON_BOARD_COMMAND],
      }));
    } catch (error) {
      logTui("commands", "keymap layer unavailable", error);
    }
    return null;
  };

  const slot = (input: ArgonTuiSlot): void => {
    try {
      const unregister = context.ui?.slot?.(input);
      if (typeof unregister === "function") disposers.push(unregister as () => void);
    } catch (error) {
      logTui("slot", `slot registration failed (${input.append ?? input.replace ?? "?"})`, error);
    }
  };

  slot({
    append: "session.panel",
    render: (props?: unknown) => {
      const panel = (props ?? {}) as ArgonTuiPanel;
      return (
        <Show when={panel.name === ARGON_BOARD_PANEL}>
          <BoardPanel panel={panel} />
        </Show>
      );
    },
  });
  slot({ append: "sidebar.content", render: () => <SidebarStatus /> });
  slot({ append: "app", render: () => registerCommands() });

  logTui(
    "board",
    `panel registered (/${ARGON_BOARD_SLASH}, palette, ${ARGON_BOARD_BIND}) — session.panel + sidebar.content`,
  );

  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch (error) {
        logTui("dispose", "slot cleanup failed", error);
      }
    }
  };
}

/**
 * Plain V2 TUI plugin definition. Like the server plugin, `Plugin.define` from
 * `@opencode/plugin/tui` is deliberately NOT imported: a discovered plugin
 * resolves `@opencode/plugin/tui` at runtime (probe on 2.0.12), but the plain
 * `{ id, setup }` object is the same definition with no resolution risk in a
 * dependency-less adopter tree — and the closures above need no `usePlugin`.
 */
export default {
  id: "arggon.tui",
  setup(context: ArgonTuiContext): () => void {
    try {
      return registerArgonTui(context);
    } catch (error) {
      logTui("setup", "board panel registration unavailable", error);
      return () => {};
    }
  },
};
