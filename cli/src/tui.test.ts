import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runList } from "./list.js";
import { toContractWorkItem } from "./contract.js";
import { renderBoardHtml } from "./board.js";
import type { WorkItem } from "./types.js";
import {
  clampTuiState,
  clipLine,
  handleKey,
  initialTuiState,
  loadTuiItems,
  renderTui,
  runTuiBoard,
  selectedTuiItem,
  tuiColumnCounts,
  visibleTuiItems,
} from "./tui.js";
import type { TuiState } from "./tui.js";

function item(overrides: Partial<WorkItem> & Pick<WorkItem, "id" | "type" | "status">): WorkItem {
  return {
    title: null,
    assignee: null,
    branch: null,
    parent: null,
    labels: [],
    created: "2026-09-11",
    updated: "2026-09-11",
    path: `tasks/x/${overrides.id}.md`,
    blocked_reason: null,
    milestone: null,
    depends_on: [],
    claimed_at: null,
    worktree_path: null,
    ...overrides,
  };
}

const THREE = [
  item({ id: "bug-beta", type: "bug", status: "todo", title: "Login 500 on empty password" }),
  item({ id: "task-alpha", type: "task", status: "todo", title: "Add rate limiting" }),
  item({ id: "story-gamma", type: "story", status: "in_progress", title: "Terminal UI kanban" }),
];

function lines(frame: string): string[] {
  return frame.replace(/^\x1b\[H\x1b\[2J/, "").split("\n");
}

// ---------- renderTui golden (plain, fixed geometry) ----------

describe("renderTui golden (80x8, color off)", () => {
  it("renders the exact frame: columns in enum order, counts, selected marker, footer", () => {
    const frame = renderTui(THREE, initialTuiState(80, 8), { color: false });
    const got = lines(frame);
    expect(frame.startsWith("\x1b[H\x1b[2J")).toBe(true);
    expect(got).toEqual([
      "arggon board --tui · 3 item(s)" + " ".repeat(50),
      "todo (2)        " +
        "in_progress (1) " +
        "blocked (0)     " +
        "done (0)        " +
        "cancelled (0)   ",
      "> B bug-beta Lo…" + "  S story-gamma…" + " ".repeat(48),
      "  T task-alpha …" + " ".repeat(64),
      " ".repeat(80),
      " ".repeat(80),
      " ".repeat(80),
      "←/→ column · ↑/↓ card · / search · enter path · q quit" + " ".repeat(26),
    ]);
  });

  it("renders exactly height padded lines at 80x24 (no ghosting between frames)", () => {
    const got = lines(renderTui(THREE, initialTuiState(80, 24), { color: false }));
    expect(got.length).toBe(24);
    for (const line of got) expect(line.length).toBe(80);
  });

  it("orders the column headers in v0 status enum order", () => {
    const got = lines(renderTui(THREE, initialTuiState(80, 24), { color: false }));
    const header = got[1];
    const positions = ["todo", "in_progress", "blocked", "done", "cancelled"].map((status) =>
      header.indexOf(`${status} (`),
    );
    expect(positions.every((pos) => pos >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("moves the > marker with the selection (column and card)", () => {
    // Selected: column 1 (in_progress), card 0 -> story-gamma.
    const state = handleKey(initialTuiState(80, 8), "\x1b[C");
    const got = lines(renderTui(THREE, state, { color: false }));
    expect(got[2]).toContain("> S story-gamma…");
    expect(got[2]).not.toContain("> B bug-beta");
    expect(got[2]).toContain("  B bug-beta");
  });

  it("clips card text to the column width with an ellipsis", () => {
    const got = lines(renderTui(THREE, initialTuiState(80, 8), { color: false }));
    expect(got[2]).toContain("> B bug-beta Lo…");
    expect(got[3]).toContain("  T task-alpha …");
  });

  it("reflects the active filter in the header, counts and visible cards", () => {
    const state = { ...initialTuiState(80, 8), filter: "rate" };
    const got = lines(renderTui(THREE, state, { color: false }));
    expect(got[0]).toContain("filter: rate");
    expect(got[1]).toContain("todo (1)");
    expect(got[1]).toContain("in_progress (0)");
    expect(got.join("\n")).toContain("task-alpha");
    expect(got.join("\n")).not.toContain("bug-beta");
    expect(got.join("\n")).not.toContain("story-gamma");
  });

  it("shows the search prompt while searching and the message after Enter", () => {
    let state = handleKey(initialTuiState(80, 8), "/");
    expect(lines(renderTui(THREE, state, { color: false }))[7]).toContain(
      "/█ — enter to apply, esc to cancel",
    );
    state = handleKey(state, "b");
    expect(lines(renderTui(THREE, state, { color: false }))[7]).toContain("/b█");
    state = handleKey(state, "\r");
    // After applying the filter the footer is help again; Enter shows a path.
    expect(lines(renderTui(THREE, state, { color: false }))[7]).toContain("enter path");
    const withPath = handleKey(initialTuiState(80, 8), "\r", [], "tasks/x/bug-beta.md");
    expect(lines(renderTui(THREE, withPath, { color: false }))[7]).toBe(
      "tasks/x/bug-beta.md" + " ".repeat(61),
    );
  });

  it("colors the selected column header and card line with SGR when color is on", () => {
    const frame = renderTui(THREE, initialTuiState(80, 8), { color: true });
    expect(frame).toContain("\x1b[1;7mtodo (2)");
    expect(frame).toContain("\x1b[7m> B bug-beta");
  });
});

// ---------- clipLine ----------

describe("clipLine", () => {
  it("keeps short text and marks long text with an ellipsis", () => {
    expect(clipLine("short", 16)).toBe("short");
    expect(clipLine("0123456789abcde", 16)).toBe("0123456789abcde");
    expect(clipLine("0123456789abcdef", 16)).toBe("0123456789abcdef");
    expect(clipLine("0123456789abcdefg", 16)).toBe("0123456789abcde…");
    expect(clipLine("anything", 0)).toBe("");
  });
});

// ---------- handleKey (pure keypress reducer) ----------

describe("handleKey", () => {
  it("quits on q and on Ctrl-C (Ctrl-C even while searching)", () => {
    expect(handleKey(initialTuiState(), "q").quit).toBe(true);
    expect(handleKey(initialTuiState(), "\x03").quit).toBe(true);
    const searching = handleKey(initialTuiState(), "/");
    expect(searching.searching).toBe(true);
    expect(handleKey(searching, "\x03").quit).toBe(true);
    // While searching, q types into the filter instead of quitting.
    expect(handleKey(searching, "q").quit).toBe(false);
    expect(handleKey(searching, "q").filter).toBe("q");
  });

  it("moves the selected column with left/right and clamps at the edges", () => {
    let state = initialTuiState();
    expect(state.column).toBe(0);
    state = handleKey(state, "\x1b[D");
    expect(state.column).toBe(0); // left edge
    state = handleKey(state, "\x1b[C");
    expect(state.column).toBe(1);
    for (let i = 0; i < 10; i++) state = handleKey(state, "\x1b[C");
    expect(state.column).toBe(4); // right edge
  });

  it("moves the selected card with up/down and clamps at the top", () => {
    let state = handleKey(initialTuiState(), "\x1b[A");
    expect(state.card).toBe(0); // top edge
    state = handleKey(state, "\x1b[B");
    expect(state.card).toBe(1);
    state = handleKey(state, "\x1b[B");
    expect(state.card).toBe(2);
    state = handleKey(state, "\x1b[A");
    expect(state.card).toBe(1);
  });

  it("re-clamps the card index when entering a smaller column (counts)", () => {
    const state = { ...initialTuiState(), card: 5 };
    const moved = handleKey(state, "\x1b[C", [10, 2, 0, 0, 0]);
    expect(moved.column).toBe(1);
    expect(moved.card).toBe(1); // min(5, count-1)
    const toEmpty = handleKey(moved, "\x1b[C", [10, 2, 0, 0, 0]);
    expect(toEmpty.column).toBe(2);
    expect(toEmpty.card).toBe(0); // empty column
  });

  it("drives the / search prompt: open, type, backspace, apply with enter", () => {
    let state = handleKey(initialTuiState(), "/");
    expect(state.searching).toBe(true);
    state = handleKey(state, "l");
    state = handleKey(state, "o");
    state = handleKey(state, "g");
    expect(state.filter).toBe("log");
    state = handleKey(state, "\x7f");
    expect(state.filter).toBe("lo");
    state = handleKey(state, "\r");
    expect(state.searching).toBe(false);
    expect(state.filter).toBe("lo"); // applied, kept
  });

  it("cancels the search prompt with esc, clearing the filter", () => {
    let state = handleKey(initialTuiState(), "/");
    state = handleKey(state, "a");
    state = handleKey(state, "\x1b");
    expect(state.searching).toBe(false);
    expect(state.filter).toBe("");
  });

  it("esc outside the search clears an applied filter and any message", () => {
    let state: TuiState = { ...initialTuiState(), filter: "log", message: "tasks/x/task-alpha.md" };
    state = handleKey(state, "\x1b");
    expect(state.filter).toBe("");
    expect(state.message).toBeNull();
  });

  it("enter records the selected item's path as the footer message", () => {
    const state = handleKey(initialTuiState(), "\r", [2, 1, 0, 0, 0], "tasks/x/bug-beta.md");
    expect(state.message).toBe("tasks/x/bug-beta.md");
    expect(state.quit).toBe(false);
    const none = handleKey(initialTuiState(), "\r", [0, 0, 0, 0, 0], null);
    expect(none.message).toBe("(no item selected)");
  });

  it("ignores unknown keys and escape-sequence tails", () => {
    const state = initialTuiState();
    expect(handleKey(state, "x")).toEqual(state);
    expect(handleKey(state, "\x1b[Z")).toEqual(state);
  });
});

// ---------- clampTuiState / selectedTuiItem / filters ----------

describe("clampTuiState and selection helpers", () => {
  it("clamps column and card against real counts", () => {
    const clamped = clampTuiState({ ...initialTuiState(), column: 9, card: 7 }, [2, 0, 0, 0, 0]);
    expect(clamped.column).toBe(4);
    expect(clamped.card).toBe(0);
    const card = clampTuiState({ ...initialTuiState(), card: 3 }, [4, 0, 0, 0, 0]);
    expect(card.card).toBe(3);
  });

  it("selectedTuiItem returns the selected card and null past the end", () => {
    const state = { ...initialTuiState(), column: 0, card: 1 };
    expect(selectedTuiItem(THREE, state)?.id).toBe("task-alpha");
    expect(selectedTuiItem(THREE, { ...state, card: 9 })).toBeNull();
    expect(selectedTuiItem(THREE, { ...state, column: 3 })).toBeNull();
  });

  it("visibleTuiItems sorts lexicographically by id and filters on id/title", () => {
    const visible = visibleTuiItems(THREE, "");
    expect(visible.map((i) => i.id)).toEqual(["bug-beta", "story-gamma", "task-alpha"]);
    expect(visibleTuiItems(THREE, "BUG").map((i) => i.id)).toEqual(["bug-beta"]); // case-insensitive
    expect(visibleTuiItems(THREE, "kanban").map((i) => i.id)).toEqual(["story-gamma"]);
    expect(visibleTuiItems(THREE, "nope")).toEqual([]);
  });

  it("tuiColumnCounts aligns with STATUSES", () => {
    expect(tuiColumnCounts(THREE, "")).toEqual([2, 1, 0, 0, 0]);
    expect(tuiColumnCounts(THREE, "alpha")).toEqual([1, 0, 0, 0, 0]);
  });
});

// ---------- data parity with list / board (kernel read path) ----------

function writeItem(
  root: string,
  rel: string,
  frontmatter: Record<string, string>,
): void {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  const lines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  writeFileSync(full, `---\n${lines}\nlabels: []\ncreated: "2026-09-11"\nupdated: "2026-09-11"\n---\n\n# body\n`, "utf8");
}

function newTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-tui-"));
  mkdirSync(join(root, "tasks"), { recursive: true });
  writeFileSync(join(root, "tasks/.convention.yml"), "version: 0\n", "utf8");
  writeItem(root, "tasks/launch/launch.md", {
    type: "initiative", status: "todo", id: "launch",
  });
  writeItem(root, "tasks/launch/epic-a/epic-a.md", {
    type: "epic", status: "todo", id: "epic-a", parent: "launch",
  });
  writeItem(root, "tasks/launch/epic-a/story-login/story-login.md", {
    type: "story", status: "in_progress", id: "story-login", parent: "epic-a", assignee: "arggon",
  });
  writeItem(root, "tasks/launch/epic-a/story-login/task-rate-limit.md", {
    type: "task", status: "todo", id: "task-rate-limit", parent: "story-login", title: "Add rate limiting",
  });
  writeItem(root, "tasks/launch/epic-a/story-login/bug-login-500.md", {
    type: "bug", status: "blocked", id: "bug-login-500", parent: "story-login",
    blocked_reason: "waiting on oauth", title: "Login 500 on empty password",
  });
  writeItem(root, "tasks/launch/epic-a/story-archived/story-archived.md", {
    type: "story", status: "done", id: "story-archived", parent: "epic-a",
  });
  return root;
}

describe("tui data parity (same kernel read path as list/board)", () => {
  it("loadTuiItems returns exactly the contract items `list --json` renders", () => {
    const root = newTree();
    const tui = loadTuiItems(root);
    const list = runList({ cwd: root });
    expect(tui.root).toBe(list.root);
    const listContract = list.items.map((i) => toContractWorkItem(i, list.root));
    expect(tui.items).toEqual(listContract);
  });

  it("renders the same ids/statuses the static HTML board renders", () => {
    const root = newTree();
    const { items } = loadTuiItems(root);
    const html = renderBoardHtml(items, { generatedAt: "2026-09-11T00:00:00.000Z" });
    // Wide terminal so even long ids render unclipped on the cards.
    const frame = renderTui(items, initialTuiState(240, 24), { color: false });
    for (const item of items) {
      expect(html).toContain(`data-id="${item.id}"`);
      expect(html).toContain(`data-status="${item.status}"`);
      expect(frame).toContain(item.id);
    }
  });
});

// ---------- interactive loop (headless smoke via fake streams) ----------

function fakeTerminal(): {
  input: PassThrough & { setRawMode: (mode: boolean) => void };
  output: PassThrough & { isTTY: true; columns: number; rows: number };
  outputText: () => string;
} {
  const input = new PassThrough() as PassThrough & { setRawMode: (mode: boolean) => void };
  input.setRawMode = () => {};
  const output = new PassThrough() as PassThrough & { isTTY: true; columns: number; rows: number };
  (output as unknown as { isTTY: boolean }).isTTY = true;
  output.columns = 80;
  output.rows = 24;
  let text = "";
  output.on("data", (chunk: Buffer) => {
    text += chunk.toString("utf8");
  });
  return {
    input,
    output,
    outputText: () => text,
  };
}

describe("runTuiBoard loop", () => {
  it("renders, handles keys and restores the screen on quit", async () => {
    const root = newTree();
    const term = fakeTerminal();
    const done = runTuiBoard({ cwd: root, input: term.input, output: term.output });
    term.input.write("\x1b[C"); // -> in_progress column
    term.input.write("\r"); // print selected item's path
    term.input.write("/"); // open search
    term.input.write("login");
    term.input.write("\x1b"); // cancel search
    term.input.write("q"); // quit
    await done;
    const text = term.outputText();
    expect(text.startsWith("\x1b[?1049h\x1b[?25l")).toBe(true);
    expect(text.endsWith("\x1b[?25h\x1b[?1049l")).toBe(true);
    expect(text).toContain("arggon board --tui · 6 item(s)");
    expect(text).toContain("story-login"); // column header card of in_progress
    expect(text).toContain("filter: login");
    expect(text).toContain("tasks/launch/epic-a/story-login/story-login.md");
  });

  it("rejects with an actionable error when stdout is not a TTY", async () => {
    const root = newTree();
    const notTty = new PassThrough() as unknown as NodeJS.WriteStream;
    await expect(
      runTuiBoard({
        cwd: root,
        input: new PassThrough(),
        output: notTty,
      }),
    ).rejects.toThrow("board --tui requires an interactive terminal");
  });
});

// ---------- CLI wiring (spawned, piped stdout = non-TTY) ----------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(repoRoot, "cli/src/cli.ts");
const tsx = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], {
    encoding: "utf8",
    cwd,
  });
}

describe("arggon board --tui (CLI)", () => {
  it("fails gracefully on a piped (non-TTY) stdout", () => {
    const root = newTree();
    const result = runCli(["board", "--tui"], root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("board --tui requires an interactive terminal");
    expect(result.stdout).not.toContain("<html");
  });

  it("refuses --tui combined with --json (BOARD_FAILED), even before the TTY check", () => {
    const root = newTree();
    const result = runCli(["board", "--tui", "--json"], root);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout.trim()) as {
      ok: boolean;
      command: string;
      error: { code: string; message: string };
    };
    expect(payload.ok).toBe(false);
    expect(payload.command).toBe("board");
    expect(payload.error.code).toBe("BOARD_FAILED");
    expect(payload.error.message).toContain("--json");
  });

  it("refuses --tui combined with --serve (BOARD_FAILED)", () => {
    const root = newTree();
    const result = runCli(["board", "--tui", "--serve", "--json"], root);
    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout.trim()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("BOARD_FAILED");
    expect(payload.error.message).toContain("--serve");
  });
});

describe("renderTui column alignment (bug-tui-column-shift)", () => {
  const mk = (id: string, status: string, type: WorkItem["type"] = "task"): WorkItem => ({
    id,
    type,
    status: status as WorkItem["status"],
    title: id,
    assignee: null,
    branch: null,
    parent: null,
    labels: [],
    created: null,
    updated: null,
    path: `tasks/x/${id}.md`,
    blocked_reason: null,
    milestone: null,
    depends_on: [],
    claimed_at: null,
    worktree_path: null,
  });

  it("keeps right-hand columns at their own x-offset when the selected column runs out of cards (color on)", () => {
    const items = [mk("task-b1", "blocked"), mk("task-d1", "done"), mk("task-d2", "done"), mk("task-d3", "done")];
    const state = { ...initialTuiState(80, 12), column: 2 }; // blocked selected
    const lines = renderTui(items, state).split("\n"); // color ON (default)
    const colWidth = Math.floor(80 / 5);
    const visibleX = (line: string, needle: string): number =>
      line.replace(/\x1b\[[0-9;]*m/g, "").indexOf(needle) - 4; // minus "M B " prefix
    // Rows where blocked has no cell must not shift done's cards left.
    for (const id of ["task-d1", "task-d2", "task-d3"]) {
      const line = lines.find((l) => l.replace(/\x1b\[[0-9;]*m/g, "").includes(id))!;
      expect(visibleX(line, id), `${id} x-offset`).toBe(3 * colWidth);
    }
  });
});
