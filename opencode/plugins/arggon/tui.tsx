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
 *   suggestion. Opened by the `arggon.board.open` command (slash
 *   `/arggon-board`, palette, `ctrl+g`).
 * - `sidebar.content` contribution: one status line (active item, or the ready
 *   count) so the item status is visible without opening the panel.
 * - `app` slot: hosts the global keymap layer (the documented home for plugin
 *   commands — `context.keymap.layer` requires a rendered provider).
 *
 * Display only: every read goes through `board.ts` → the kernel; nothing here
 * writes to the tracker.
 */
import { Show, createSignal } from "solid-js";
import {
  ARGON_BOARD_PANEL,
  boardSnapshot,
  boardTreeLines,
  emptyBoardSnapshot,
  sidebarStatusLine,
  type BoardSnapshot,
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

/**
 * Register the board/status surface on a TUI context. Returns a disposer that
 * unregisters every slot contribution (the `setup` cleanup contract). Pure
 * wiring: the components read the tracker through `boardSnapshot` on mount.
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

  /** Panel body: snapshot on mount, `r` reloads, `f` full-screen, `esc` closes. */
  const BoardPanel = (props: { panel: ArgonTuiPanel }) => {
    const [snapshot, setSnapshot] = createSignal<BoardSnapshot>(readSnapshot());
    const width = (): number => (typeof props.panel?.width === "number" ? props.panel.width : 0);
    try {
      context.keymap?.layer?.(() => ({
        commands: [
          {
            id: "arggon.board.close",
            bind: "escape",
            run: () => props.panel?.close?.(),
          },
          {
            id: "arggon.board.fullscreen",
            bind: "f",
            run: () => props.panel?.toggleFullscreen?.(),
          },
          {
            id: "arggon.board.reload",
            bind: "r",
            run: () => setSnapshot(readSnapshot()),
          },
        ],
      }));
    } catch (error) {
      logTui("panel-keymap", "panel key layer unavailable", error);
    }
    return (
      <box flexDirection="column">
        {() => boardTreeLines(snapshot(), { width: width() }).map((line) => <text>{line}</text>)}
      </box>
    );
  };

  /** Sidebar contribution: active item status (or the ready count). */
  const SidebarStatus = () => {
    const [snapshot] = createSignal<BoardSnapshot>(readSnapshot());
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
