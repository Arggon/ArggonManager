/**
 * W5 task-native-tui: the TUI entry wiring (`tui.tsx`) without an OpenCode
 * runtime. `solid-js` and the JSX runtime are aliased to
 * `test/tui-runtime-stub.ts` by `vitest.config.ts` (the vendored file must stay
 * dependency-less), so these tests assert the surfaces the runtime contract
 * cares about: the three slot contributions, the global command (slash/palette/
 * bind), the panel body content read from a real tracker fixture, the sidebar
 * status line and the failure isolation of every missing surface. Real runtime
 * load/rendering is covered by `npm run smoke:tui` (PTY) and the manual
 * checklist.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runTuiCleanups } from "../../../test/tui-runtime-stub.js";
import { boardSnapshot, emptyBoardSnapshot } from "./board.js";
import {
  ARGON_BOARD_BIND,
  ARGON_BOARD_COMMAND,
  ARGON_BOARD_SLASH,
  createBoardController,
  registerArgonTui,
  setBoardSessionView,
  type ArgonTuiContext,
  type ArgonTuiSlot,
  type BoardControllerOptions,
  type BoardView,
} from "./tui.js";

const here = dirname(fileURLToPath(import.meta.url));
const tmpDirs: string[] = [];
afterEach(() => {
  runTuiCleanups();
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function write(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

/** Minimal tracker: one story with one task and one bug. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-tui-"));
  tmpDirs.push(root);
  write(root, "ArggonManager/.convention.yml", "version: 5\n");
  const base = "ArggonManager/arggon-manager";
  const item = (id: string, fields: string, title = id, body?: string): string =>
    `---\ntype: task\nstatus: todo\nid: ${id}\ntitle: ${title}\n${fields}---\n\n${body ?? `# ${title}\n`}`;
  write(
    root,
    `${base}/launch/launch.md`,
    item("launch", "type: initiative\nstatus: in_progress\n", "Launch"),
  );
  write(root, `${base}/launch/core/core.md`, item("core", "type: epic\nparent: launch\n", "Core"));
  write(
    root,
    `${base}/launch/core/story-a/story-a.md`,
    item("story-a", "type: story\nparent: core\n", "Story A"),
  );
  write(
    root,
    `${base}/launch/core/story-a/task-one.md`,
    item(
      "task-one",
      "parent: story-a\n",
      "First task",
      [
        "# First task",
        "",
        "## Acceptance",
        "",
        "- [ ] ship it",
        "- [x] done row",
        "",
        "Context for the panel detail block.",
        "",
      ].join("\n"),
    ),
  );
  write(
    root,
    `${base}/launch/core/story-a/bug-two.md`,
    item(
      "bug-two",
      "type: bug\nstatus: in_progress\nparent: story-a\nassignee: Arggon\n",
      "Open bug",
    ),
  );
  return root;
}

type SlotRecord = { slot: ArgonTuiSlot; render: (props?: unknown) => unknown };

type FakeContext = {
  context: ArgonTuiContext;
  slots: SlotRecord[];
  layers: Array<() => unknown>;
  toasts: string[];
  opened: string[];
  unregistered: string[];
};

function fakeContext(cwd: string, openResult: unknown = true): FakeContext {
  const slots: SlotRecord[] = [];
  const layers: Array<() => unknown> = [];
  const toasts: string[] = [];
  const opened: string[] = [];
  const unregistered: string[] = [];
  const context: ArgonTuiContext = {
    location: { directory: cwd },
    ui: {
      slot: (input: ArgonTuiSlot) => {
        slots.push({ slot: input, render: (props?: unknown) => input.render(props) });
        return () => unregistered.push(input.append ?? input.replace ?? "?");
      },
      panel: {
        open: (name: string) => {
          opened.push(name);
          return openResult;
        },
      },
      toast: {
        show: (input: { message?: string }) => {
          toasts.push(String(input.message));
        },
      },
    },
    keymap: {
      layer: (factory: () => unknown) => {
        layers.push(factory);
      },
    },
    data: {
      location: { vcs: { info: () => ({ branch: { current: "feat/task-one" } }) } },
    },
  };
  return { context, slots, layers, toasts, opened, unregistered };
}

/** Render the stubbed JSX element tree to text (see test/tui-runtime-stub.ts). */
function render(node: unknown): string {
  if (node === null || node === undefined || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "function") return render((node as () => unknown)());
  if (Array.isArray(node)) return node.map(render).join("");
  if (typeof node === "object") {
    const element = node as { type?: unknown; props?: Record<string, unknown> };
    if (typeof element.type === "function") {
      return render((element.type as (props: unknown) => unknown)(element.props));
    }
    if (typeof element.type === "string") {
      const inner = render(element.props?.children);
      // Host `<text>` lines are terminal rows; a newline mirrors that.
      return element.type === "text" ? `${inner}\n` : inner;
    }
  }
  return "";
}

type CommandShape = {
  id: string;
  title: string;
  bind?: string;
  palette?: boolean;
  slash?: { name?: string };
  run: () => unknown;
};

function commandFrom(layer: () => unknown, id: string): CommandShape {
  const definition = layer() as { commands?: CommandShape[] };
  const command = (definition.commands ?? []).find((candidate) => candidate.id === id);
  expect(command, `command ${id} registered`).toBeDefined();
  return command!;
}

describe("TUI entry wiring (registerArgonTui)", () => {
  it("contributes the panel, the sidebar status and the command host slot", () => {
    const root = fixture();
    const { context, slots } = fakeContext(root);
    const dispose = registerArgonTui(context, { cwd: root });
    expect(slots.map((entry) => entry.slot.append)).toEqual([
      "session.panel",
      "sidebar.content",
      "app",
    ]);
    expect(typeof dispose).toBe("function");
  });

  it("registers the argon.board.open command (slash, palette, bind) and opens the panel", () => {
    const root = fixture();
    const { context, slots, opened, toasts, layers } = fakeContext(root);
    registerArgonTui(context, { cwd: root });
    const app = slots.find((entry) => entry.slot.append === "app")!;
    expect(render(app.render())).toBe("");
    expect(layers).toHaveLength(1);
    const command = commandFrom(layers[0]!, ARGON_BOARD_COMMAND);
    expect(command.slash?.name).toBe(ARGON_BOARD_SLASH);
    expect(command.bind).toBe(ARGON_BOARD_BIND);
    expect(command.palette).toBe(true);
    expect(command.title).toContain("Arggon");

    command.run();
    expect(opened).toEqual(["arggon.board"]);
    expect(toasts).toEqual([]);

    // A second app-slot render must not register a duplicate layer.
    app.render();
    expect(layers).toHaveLength(1);
  });

  it("toasts instead of failing when there is no session or no panel surface", () => {
    const root = fixture();
    const closed = fakeContext(root, false);
    registerArgonTui(closed.context, { cwd: root });
    const app = closed.slots.find((entry) => entry.slot.append === "app")!;
    app.render();
    commandFrom(closed.layers[0]!, ARGON_BOARD_COMMAND).run();
    expect(closed.opened).toEqual(["arggon.board"]);
    expect(closed.toasts[0]).toContain("open a session first");

    const { context, slots, toasts, layers } = fakeContext(root);
    if (context.ui) context.ui.panel = undefined;
    registerArgonTui(context, { cwd: root });
    const noPanel = slots.find((entry) => entry.slot.append === "app")!;
    noPanel.render();
    commandFrom(layers[0]!, ARGON_BOARD_COMMAND).run();
    expect(toasts[0]).toContain("no session panels");
  });

  it("renders the tree in the panel (current tree, active item, width clip)", () => {
    const root = fixture();
    const { context, slots } = fakeContext(root);
    registerArgonTui(context, { cwd: root, envItem: null });
    const panel = slots.find((entry) => entry.slot.append === "session.panel")!;

    // Another plugin's panel name renders nothing.
    expect(render(panel.render({ name: "someone.else" }))).toBe("");

    const text = render(panel.render({ name: "arggon.board", width: 40 }));
    const lines = text.split("\n").filter((line) => line.length > 0);
    expect(lines).toHaveLength(7);
    // Wide content is clipped to the panel width, tree lines stay exact.
    expect(lines[0]).toMatch(/^arggon board · 5 item\(s\) · next: task-o/);
    expect(lines[0].endsWith("…")).toBe(true);
    expect(lines[1].endsWith("…")).toBe(true);
    // Every line carries the selection gutter; the cursor seeds on line one.
    expect(lines.slice(2)).toEqual([
      "❯ ▸ I launch — Launch",
      "    · E core — Core",
      "      · S story-a — Story A",
      "        ▸ B bug-two @Arggon — Open bug",
      "       ▶· T task-one — First task",
    ]);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(40);
    expect(text).toContain("▶");
  });

  it("renders the sidebar status line from the session branch", () => {
    const root = fixture();
    const { context, slots } = fakeContext(root);
    registerArgonTui(context, { cwd: root });
    const sidebar = slots.find((entry) => entry.slot.append === "sidebar.content")!;
    expect(render(sidebar.render({ sessionID: "ses_test" })).trim()).toBe("arggon ▶ task-one todo");
  });

  it("unregisters every slot on dispose and stays inert on a bare context", () => {
    const root = fixture();
    const { context, slots, unregistered } = fakeContext(root);
    const dispose = registerArgonTui(context, { cwd: root });
    dispose();
    expect(unregistered).toEqual(["session.panel", "sidebar.content", "app"]);
    expect(slots).toHaveLength(3);

    // No ui/keymap/location surfaces: still returns a disposer, never throws.
    const bare: ArgonTuiContext = {};
    const disposeBare = registerArgonTui(bare);
    expect(() => disposeBare()).not.toThrow();
  });

  it("degrades the panel instead of crashing on a corrupt tracker (P1)", () => {
    const root = mkdtempSync(join(tmpdir(), "arggon-tui-dupe-"));
    tmpDirs.push(root);
    write(root, "ArggonManager/.convention.yml", "version: 5\n");
    const base = "ArggonManager/arggon-manager/story-x";
    const dupe = `---\ntype: task\nstatus: todo\nid: dup\ntitle: Duplicate\n---\n\n# Duplicate\n`;
    write(root, `${base}/one.md`, dupe);
    write(root, `${base}/two.md`, dupe);

    const { context, slots } = fakeContext(root);
    expect(() => registerArgonTui(context, { cwd: root })).not.toThrow();
    const panel = slots.find((entry) => entry.slot.append === "session.panel")!;
    // The host would otherwise show "Plugin arggon.tui crashed in slot
    // session.panel: Duplicate id 'dup' …"; the panel renders the reason.
    const text = render(panel.render({ name: "arggon.board" }));
    expect(text).toContain("arggon board · tracker unreadable");
    expect(text).toContain("Duplicate id 'dup'");
    const sidebar = slots.find((entry) => entry.slot.append === "sidebar.content")!;
    expect(render(sidebar.render()).trim()).toBe("arggon · no tracker");
  });

  it("keeps the vendored source dependency-less and runtime-resolved", () => {
    const source = readFileSync(join(here, "tui.tsx"), "utf8");
    const imports = [...source.matchAll(/^import\s[\s\S]*?from\s+"([^"]+)"/gm)].map(
      (match) => match[1],
    );
    // Only `solid-js` (resolved by the OpenCode TUI runtime) and the vendored
    // bundle (relative) may be imported: no @opencode/plugin, no npm package.
    expect(imports).toEqual(["solid-js", "./index.ts"]);
    for (const forbidden of [
      'from "@opencode/plugin',
      'require("@opencode/plugin',
      'from "@arggondev/lib',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    // The documented trigger + fallbacks are pinned in the source contract.
    expect(source).toContain('append: "session.panel"');
    expect(source).toContain('append: "sidebar.content"');
    expect(source).toContain("panel.open");
  });

  it("resolves the project directory from the location when no cwd is given", () => {
    const root = fixture();
    const { context, slots } = fakeContext(root);
    registerArgonTui(context);
    const panel = slots.find((entry) => entry.slot.append === "session.panel")!;
    expect(render(panel.render({ name: "arggon.board" }))).toContain("arggon board · 5 item(s)");
  });
});

describe("board panel controller (selection, jumps, detail)", () => {
  function controllerFor(root: string, overrides: Partial<BoardControllerOptions> = {}) {
    return createBoardController({
      cwd: root,
      readSnapshot: () => boardSnapshot(root, { envItem: null }),
      width: () => 60,
      ...overrides,
    });
  }

  it("navigates the flattened tree and keeps the selection across a reload", () => {
    const root = fixture();
    const controller = controllerFor(root);
    const lines = () => controller.lines();
    expect(controller.selection()).toEqual({ index: 0, id: "launch" });
    expect(lines()[2]?.startsWith("❯")).toBe(true);
    expect(lines()[2]).toContain("I launch");

    controller.move("down");
    expect(controller.selection()).toEqual({ index: 1, id: "core" });
    expect(lines()[3]?.startsWith("❯")).toBe(true);
    expect(lines()[2]?.startsWith("❯")).toBe(false);

    controller.move("page-down"); // clamps at the last row
    expect(controller.selection()).toEqual({ index: 4, id: "task-one" });
    controller.move("first");
    expect(controller.selection()).toEqual({ index: 0, id: "launch" });
    controller.move("last");
    expect(controller.selection()).toEqual({ index: 4, id: "task-one" });

    // Reload with the item still present: the cursor stays on the same item.
    controller.move("up");
    controller.reload();
    expect(controller.selection()).toEqual({ index: 3, id: "bug-two" });

    // The item disappears: the previous index clamps into the new tree.
    rmSync(join(root, "ArggonManager/arggon-manager/launch/core/story-a/bug-two.md"));
    controller.reload();
    expect(controller.selection()).toEqual({ index: 3, id: "task-one" });
  });

  it("jumps to the kernel next suggestion and the active session item", () => {
    const root = fixture();
    const toasts: string[] = [];
    const controller = controllerFor(root, {
      readSnapshot: () => boardSnapshot(root, { envItem: "bug-two" }),
      toast: (message) => toasts.push(message),
    });
    controller.jumpNext();
    expect(controller.selection()).toEqual({ index: 4, id: "task-one" });
    controller.jumpActive();
    expect(controller.selection()).toEqual({ index: 3, id: "bug-two" });
    expect(toasts).toEqual([]);

    // No targets (error snapshot): the jumps toast and leave the cursor alone.
    const empty = createBoardController({
      cwd: root,
      readSnapshot: () => emptyBoardSnapshot("no tracker"),
      toast: (message) => toasts.push(message),
    });
    empty.jumpNext();
    empty.jumpActive();
    expect(toasts).toEqual([
      "arggon board: no next suggestion",
      "arggon board: no active item",
    ]);
    expect(empty.selection()).toEqual({ index: -1, id: null });
    expect(empty.lines()).toEqual(["arggon board · no tracker"]);
  });

  it("toggles the detail block; esc closes it before the panel", () => {
    const root = fixture();
    const closes: number[] = [];
    const controller = controllerFor(root, { close: () => closes.push(1) });
    controller.escape();
    expect(closes).toHaveLength(1); // no block open: esc closes the panel

    controller.jump("task-one", "test");
    controller.toggleDetail();
    expect(controller.detail()?.id).toBe("task-one");
    const text = controller.lines().join("\n");
    expect(text).toContain("┌ argon detail · task-one — First task");
    expect(text).toContain("│ [ ] ship it");
    expect(text).toContain("│ [x] done row");
    expect(text).toContain("└ 1/2 acceptance");

    controller.escape(); // block open: esc returns to the tree
    expect(controller.detail()).toBeNull();
    expect(closes).toHaveLength(1);
    controller.escape();
    expect(closes).toHaveLength(2);

    // Movement returns to the tree as well, and Enter toggles the block off.
    controller.toggleDetail();
    expect(controller.detail()).not.toBeNull();
    controller.move("up");
    expect(controller.detail()).toBeNull();
    controller.toggleDetail();
    controller.toggleDetail();
    expect(controller.detail()).toBeNull();
  });

  it("filters the tree live: s starts the editor, keys append, esc steps back out", () => {
    const root = fixture();
    const closes: number[] = [];
    const controller = controllerFor(root, { close: () => closes.push(1) });
    // `s` opens the filter editor; letters append and match live.
    controller.key("s");
    expect(controller.filterEditing()).toBe(true);
    for (const character of "task") controller.key(character);
    expect(controller.view()).toEqual({ folded: [], hideDone: false, text: "task" });
    expect(controller.selection()).toEqual({ index: 0, id: "task-one" });
    let text = controller.lines().join("\n");
    expect(text).toContain('view · filter "task▏" · 1/5 shown');
    expect(text).toContain("T task-one — First task");
    expect(text).not.toContain("I launch");
    // While editing, letters feed the filter — they are not navigation.
    controller.key("j");
    expect(controller.view().text).toBe("taskj");
    // No matches: the visible tree is empty and the cursor clears (total).
    expect(controller.selection()).toEqual({ index: -1, id: null });
    controller.key("backspace");
    expect(controller.view().text).toBe("task");
    controller.key("return"); // accept: back to the tree, filter stays applied
    expect(controller.filterEditing()).toBe(false);
    text = controller.lines().join("\n");
    expect(text).toContain('view · filter "task" · 1/5 shown');
    // First esc resets the view, only the second closes the panel.
    controller.key("escape");
    expect(controller.view()).toEqual({ folded: [], hideDone: false, text: "" });
    expect(controller.lines().join("\n")).toContain("I launch");
    expect(closes).toHaveLength(0);
    controller.key("escape");
    expect(closes).toHaveLength(1);
  });

  it("folds a subtree with z (and all containers with Z), counting hidden rows", () => {
    const root = fixture();
    const controller = controllerFor(root);
    controller.key("j"); // cursor on `core`
    controller.key("z"); // fold the core subtree
    let text = controller.lines().join("\n");
    expect(text).toContain("E core — Core (+3 folded)");
    expect(text).not.toContain("S story-a");
    expect(text).toContain('view · filter "" · 1 folded · 2/5 shown');
    // A fold is a view change: the cursor re-resolves onto the visible tree.
    expect(controller.selection()).toEqual({ index: 1, id: "core" });

    controller.key("Z"); // every container folds — only the root stays visible
    text = controller.lines().join("\n");
    expect(text).toContain('view · filter "" · 3 folded · 1/5 shown');
    expect(text).not.toContain("S story-a");

    controller.key("Z"); // all folded → unfold everything
    text = controller.lines().join("\n");
    expect(text).toContain("S story-a");
    expect(text).not.toContain("folded");

    // Leaves cannot fold: z on the last row (`task-one`) leaves the view empty.
    controller.key("last"); // shift+g routes the same token
    expect(controller.selection().id).toBe("task-one");
    controller.key("z");
    expect(controller.view().folded).toEqual([]);
  });

  it("d hides done and cancelled rows and reports the change to the session", () => {
    const root = fixture();
    write(
      root,
      "ArggonManager/arggon-manager/launch/core/story-a/task-done.md",
      "---\ntype: task\nstatus: done\nid: task-done\ntitle: Shipped task\nparent: story-a\n---\n\n# Shipped task\n",
    );
    const seen: BoardView[] = [];
    const controller = controllerFor(root, { onViewChange: (view) => seen.push(view) });
    expect(controller.lines().join("\n")).toContain("T task-done — Shipped task");
    controller.key("d");
    expect(controller.lines().join("\n")).not.toContain("task-done");
    expect(controller.lines()[2]).toContain("done hidden");
    expect(seen).toEqual([{ folded: [], hideDone: true, text: "" }]);
    controller.key("d");
    expect(controller.lines().join("\n")).toContain("T task-done — Shipped task");
    expect(controller.view().hideDone).toBe(false);
  });

  it("keeps the view per session and restores it when the panel reopens", () => {
    const root = fixture();
    const { context, slots } = fakeContext(root);
    registerArgonTui(context, { cwd: root, envItem: null });
    const panel = slots.find((entry) => entry.slot.append === "session.panel")!;
    setBoardSessionView("ses_a", { folded: ["core"], hideDone: false, text: "" });
    const sessionA = render(panel.render({ name: "arggon.board", sessionID: "ses_a", width: 60 }));
    expect(sessionA).toContain("(+3 folded)");
    expect(sessionA).toContain("1 folded");
    const sessionB = render(panel.render({ name: "arggon.board", sessionID: "ses_b", width: 60 }));
    expect(sessionB).not.toContain("(+3 folded)");
    // Reopening the same session restores the fold.
    expect(render(panel.render({ name: "arggon.board", sessionID: "ses_a", width: 60 }))).toContain(
      "(+3 folded)",
    );
  });

  it("refresh re-reads the tracker, keeps the selection and re-reads an open detail", () => {
    const root = fixture();
    const controller = controllerFor(root);
    controller.jump("bug-two", "test");
    controller.toggleDetail();
    expect(controller.detail()?.id).toBe("bug-two");
    // A new item lands on disk; a live tick (not `r`) keeps cursor and block.
    write(
      root,
      "ArggonManager/arggon-manager/launch/core/story-a/task-nine.md",
      "---\ntype: task\nstatus: todo\nid: task-nine\ntitle: Nine\nparent: story-a\n---\n\n# Nine\n",
    );
    controller.refresh();
    expect(controller.selection()).toEqual({ index: 3, id: "bug-two" });
    expect(controller.detail()?.id).toBe("bug-two");
    expect(controller.lines().join("\n")).toContain("T task-nine — Nine");
    // The selected item disappears: the detail degrades instead of throwing.
    rmSync(join(root, "ArggonManager/arggon-manager/launch/core/story-a/bug-two.md"));
    controller.refresh();
    expect(controller.detail()?.error).not.toBeNull();
    expect(controller.selection().id).not.toBe("bug-two");
  });

  it("refreshes the panel and sidebar on the live timer and stops on cleanup", () => {
    vi.useFakeTimers();
    try {
      const root = fixture();
      const { context, slots } = fakeContext(root);
      registerArgonTui(context, { cwd: root, envItem: null });
      const panelSlot = slots.find((entry) => entry.slot.append === "session.panel")!;
      const sidebarSlot = slots.find((entry) => entry.slot.append === "sidebar.content")!;
      const panelElement = panelSlot.render({ name: "arggon.board", width: 60 });
      const sidebarElement = sidebarSlot.render({});
      expect(render(panelElement)).not.toContain("task-nine");
      expect(render(sidebarElement)).toContain("arggon ▶ task-one todo");
      write(
        root,
        "ArggonManager/arggon-manager/launch/core/story-a/task-nine.md",
        "---\ntype: task\nstatus: todo\nid: task-nine\ntitle: Nine\nparent: story-a\n---\n\n# Nine\n",
      );
      write(
        root,
        "ArggonManager/arggon-manager/launch/core/story-a/task-one.md",
        "---\ntype: task\nstatus: done\nid: task-one\ntitle: First task\nparent: story-a\n---\n\n# First task\n",
      );
      vi.advanceTimersByTime(10_000);
      // The next renders show the new tree with no `r` pressed.
      expect(render(panelElement)).toContain("T task-nine — Nine");
      expect(render(sidebarElement)).toContain("arggon ▶ task-one done");
    } finally {
      vi.useRealTimers();
    }
  });

  it("binds the documented panel keys through the panel key layer", () => {
    const root = fixture();
    const { context, slots, layers } = fakeContext(root);
    registerArgonTui(context, { cwd: root, envItem: null });
    const panel = slots.find((entry) => entry.slot.append === "session.panel")!;
    render(panel.render({ name: "arggon.board", width: 60 }));
    const panelLayers = layers.filter((factory) => {
      const definition = factory() as { commands?: CommandShape[] };
      return (definition.commands ?? []).some((command) => command.id.startsWith("arggon.board."));
    });
    expect(panelLayers.length).toBe(2); // the documented layer + the best-effort filter layer
    const commands = (panelLayers[0]!() as { commands: CommandShape[] }).commands;
    expect(Object.fromEntries(commands.map((command) => [command.id, command.bind]))).toEqual({
      "arggon.board.down": "j",
      "arggon.board.down.arrow": "down",
      "arggon.board.up": "k",
      "arggon.board.up.arrow": "up",
      "arggon.board.page-down": "pagedown",
      "arggon.board.page-up": "pageup",
      "arggon.board.first": "g",
      "arggon.board.first.home": "home",
      "arggon.board.last": "shift+g",
      "arggon.board.last.end": "end",
      "arggon.board.detail": "return",
      "arggon.board.next": "n",
      "arggon.board.active": "a",
      "arggon.board.filter.edit": "s",
      "arggon.board.hide-done": "d",
      "arggon.board.fold": "z",
      "arggon.board.fold.all": "shift+z",
      "arggon.board.fullscreen": "f",
      "arggon.board.reload": "r",
      "arggon.board.close": "escape",
      // Letters with no action of their own feed only the filter editor.
      ...Object.fromEntries(
        [..."bcehilmopqtuvwxy"].map((letter) => [`arggon.board.char.${letter}`, letter]),
      ),
    });
    // Every action is inert-safe without a host panel (no throws).
    for (const command of commands) expect(() => command.run()).not.toThrow();
    // The extended layer carries the id-style characters and backspace; a host
    // that rejects those names only loses them (own try/catch).
    const extended = (panelLayers[1]!() as { commands: CommandShape[] }).commands;
    expect(Object.fromEntries(extended.map((command) => [command.id, command.bind]))).toEqual({
      "arggon.board.filter.backspace": "backspace",
      "arggon.board.char./": "/",
      ...Object.fromEntries(
        [..."0123456789._-"].map((character) => [`arggon.board.char.${character}`, character]),
      ),
    });
    for (const command of extended) expect(() => command.run()).not.toThrow();
  });
});
