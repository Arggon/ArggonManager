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
import { afterEach, describe, expect, it } from "vitest";
import {
  ARGON_BOARD_BIND,
  ARGON_BOARD_COMMAND,
  ARGON_BOARD_SLASH,
  registerArgonTui,
  type ArgonTuiContext,
  type ArgonTuiSlot,
} from "./tui.js";

const here = dirname(fileURLToPath(import.meta.url));
const tmpDirs: string[] = [];
afterEach(() => {
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
  const item = (id: string, fields: string, title = id): string =>
    `---\ntype: task\nstatus: todo\nid: ${id}\ntitle: ${title}\n${fields}---\n\n# ${title}\n`;
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
    item("task-one", "parent: story-a\n", "First task"),
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
    expect(lines.slice(2)).toEqual([
      " ▸ I launch — Launch",
      "   · E core — Core",
      "     · S story-a — Story A",
      "       ▸ B bug-two @Arggon — Open bug",
      "      ▶· T task-one — First task",
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
      'from "@arggon/lib',
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
