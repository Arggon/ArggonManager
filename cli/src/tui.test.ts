import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runList, toContractWorkItem, type ContractWorkItem as WorkItem } from "@arggondev/lib";

import { renderBoardHtml } from "./board.js";

import {
  buildTuiDetailLines,
  clampTuiDetailScroll,
  clampTuiState,
  clipLine,
  followTuiScroll,
  handleKey,
  initialTuiState,
  loadTuiItems,
  renderTui,
  renderTuiDetail,
  renderTuiScreen,
  runTuiBoard,
  selectedTuiItem,
  TUI_DETAIL_MAX_BODY_LINES,
  TUI_DETAIL_MAX_LINES,
  TUI_DETAIL_NARROW_WIDTH,
  tuiAcceptanceRows,
  tuiBodyRows,
  tuiColumnCounts,
  tuiDepBlocked,
  tuiDependencySummary,
  tuiDetailBodyRows,
  tuiDetailLinesFor,
  visibleTuiItems,
  wrapTuiLine,
} from "./tui.js";
import type { TuiDetailInput, TuiDetailSource, TuiState } from "./tui.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

function item(overrides: Partial<WorkItem> & Pick<WorkItem, "id" | "type" | "status">): WorkItem {
  return {
    title: null,
    assignee: null,
    branch: null,
    parent: null,
    labels: [],
    priority: null,
    created: "2026-09-11",
    updated: "2026-09-11",
    path: `tasks/x/${overrides.id}.md`,
    blocked_reason: null,
    milestone: null,
    depends_on: [],
    claimed_at: null,
    worktree_path: null,
    issue: null,
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
      // The position leads (bug-tui-selection-offscreen); at 80 columns the
      // tail of the key help is clipped, never the position.
      "row 1/2 · ←/→ column · ↑/↓ card · PgUp/PgDn page · home/end · / search · enter …",
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
    // After applying the filter the footer is the position + help again (the
    // help tail clips at 80 columns); Enter with no selection only messages.
    expect(lines(renderTui(THREE, state, { color: false }))[7]).toContain("row 1/1 · ←/→ column");
    const noItem = handleKey(initialTuiState(80, 8), "\r", { counts: [2, 1, 0, 0, 0] });
    expect(lines(renderTui(THREE, noItem, { color: false }))[7]).toBe(
      "row 1/2 · (no item selected)".padEnd(80, " "),
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
    const moved = handleKey(state, "\x1b[C", { counts: [10, 2, 0, 0, 0] });
    expect(moved.column).toBe(1);
    expect(moved.card).toBe(1); // min(5, count-1)
    const toEmpty = handleKey(moved, "\x1b[C", { counts: [10, 2, 0, 0, 0] });
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

  it("enter opens the detail pane for the selected item, or messages when the column is empty", () => {
    const state = handleKey(initialTuiState(), "\r", {
      counts: [2, 1, 0, 0, 0],
      selectedId: "bug-beta",
    });
    expect(state.detail).toEqual({ id: "bug-beta", scroll: 0 });
    expect(state.quit).toBe(false);
    expect(state.message).toBeNull();
    const none = handleKey(initialTuiState(), "\r", { counts: [0, 0, 0, 0, 0], selectedId: null });
    expect(none.detail).toBeNull();
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

// ---------- scroll window (bug-tui-selection-offscreen) ----------

/** Long single-status column: ids sort lexicographically in creation order. */
function longColumn(n: number, status: WorkItem["status"] = "todo"): WorkItem[] {
  return Array.from({ length: n }, (_, i) =>
    item({
      id: `demo-${String(i).padStart(2, "0")}`,
      type: "task",
      status,
      title: `Demo item ${i}`,
    }),
  );
}

const LONG = longColumn(30);

describe("tuiBodyRows / followTuiScroll", () => {
  it("derives the body height from the frame geometry", () => {
    expect(tuiBodyRows(24)).toBe(21);
    expect(tuiBodyRows(8)).toBe(5);
    expect(tuiBodyRows(3)).toBe(0);
    expect(tuiBodyRows(1)).toBe(0);
  });

  it("keeps the selection inside the window and never pages past the end", () => {
    // 30 cards, 21 rows: the last full page starts at index 9.
    expect(followTuiScroll(0, 0, 30, 21)).toBe(0);
    expect(followTuiScroll(20, 0, 30, 21)).toBe(0); // still the last visible row
    expect(followTuiScroll(21, 0, 30, 21)).toBe(1); // one past the window
    expect(followTuiScroll(29, 0, 30, 21)).toBe(9); // last page, no overshoot
    expect(followTuiScroll(29, 9, 30, 21)).toBe(9); // idempotent
    expect(followTuiScroll(0, 9, 30, 21)).toBe(0); // back to the top
    // Short column: never show empty space while items exist.
    expect(followTuiScroll(3, 5, 5, 21)).toBe(0);
    // Degenerate geometry.
    expect(followTuiScroll(3, 4, 0, 21)).toBe(0);
    expect(followTuiScroll(3, 4, 10, 0)).toBe(0);
  });
});

describe("TUI scroll window (bug-tui-selection-offscreen)", () => {
  it("renders the highlighted row when the selection is at the bottom of a long column", () => {
    const counts = tuiColumnCounts(LONG, "");
    let state = initialTuiState(200, 24); // 21 body rows
    for (let i = 0; i < 29; i++) state = handleKey(state, "\x1b[B", { counts });
    expect(state.card).toBe(29);
    expect(state.scroll).toBe(9);
    const frame = renderTui(LONG, state);
    // Exactly one body highlight (the column header uses `1;7`, not `7`).
    expect((frame.match(/\x1b\[7m/g) ?? []).length).toBe(1);
    expect(frame).toContain("\x1b[7m> T demo-29 Demo item 29");
    expect(frame).toContain("  T demo-09 Demo item 9"); // first window row
    expect(frame).not.toContain("demo-08");
    expect(lines(frame)[23]).toContain("row 30/30");
  });

  it("keeps the 80x24 repro frame on the selected card (no stale top-of-column window)", () => {
    const counts = tuiColumnCounts(LONG, "");
    let state = initialTuiState(80, 24);
    for (let i = 0; i < 25; i++) state = handleKey(state, "\x1b[B", { counts });
    expect(state.card).toBe(25);
    expect(state.scroll).toBe(5); // 25 - 21 + 1
    const frame = renderTui(LONG, state);
    expect((frame.match(/\x1b\[7m/g) ?? []).length).toBe(1);
    expect(frame).toContain("\x1b[7m> T demo-25 Dem…");
    expect(frame).not.toContain("demo-04"); // the window no longer starts at 0
    expect(lines(frame)[23]).toContain("row 26/30");
  });

  it("PgDn/PgUp/Home/End page the column without overshoot or empty pages", () => {
    const counts = tuiColumnCounts(LONG, "");
    let state = initialTuiState(200, 24); // page = 21 rows
    state = handleKey(state, "\x1b[6~", { counts }); // PgDn
    expect(state.card).toBe(21);
    expect(state.scroll).toBe(1);
    state = handleKey(state, "\x1b[6~", { counts }); // PgDn again: last card, last page
    expect(state.card).toBe(29);
    expect(state.scroll).toBe(9);
    state = handleKey(state, "\x1b[6~", { counts }); // no overshoot past the end
    expect(state.card).toBe(29);
    expect(state.scroll).toBe(9);
    state = handleKey(state, "\x1b[5~", { counts }); // PgUp: one page back
    expect(state.card).toBe(8);
    expect(state.scroll).toBe(8);
    state = handleKey(state, "\x1b[F", { counts }); // End (xterm)
    expect(state.card).toBe(29);
    expect(state.scroll).toBe(9);
    state = handleKey(state, "\x1b[4~", { counts }); // End (vt220)
    expect(state.card).toBe(29);
    expect(state.scroll).toBe(9);
    state = handleKey(state, "\x1b[1~", { counts }); // Home (vt220)
    expect(state.card).toBe(0);
    expect(state.scroll).toBe(0);
    state = handleKey(state, "\x1b[H", { counts }); // Home (xterm)
    expect(state.card).toBe(0);
    expect(state.scroll).toBe(0);
    state = handleKey(state, "\x1b[5~", { counts }); // PgUp at the top stays put
    expect(state.card).toBe(0);
    expect(state.scroll).toBe(0);
  });

  it("keeps the window valid after a resize (both directions)", () => {
    const counts = tuiColumnCounts(LONG, "");
    let state = initialTuiState(200, 24);
    for (let i = 0; i < 29; i++) state = handleKey(state, "\x1b[B", { counts });
    expect(state.scroll).toBe(9);

    // Grow: the whole column fits, so the window starts at the top.
    const grown = clampTuiState({ ...state, height: 42 }, counts);
    expect(grown.card).toBe(29);
    expect(grown.scroll).toBe(0);
    const grownFrame = renderTui(LONG, grown, { color: false });
    expect(grownFrame).toContain("demo-00");
    expect(grownFrame).toContain("> T demo-29");

    // Shrink: the window pulls back so the last page stays full.
    const shrunk = clampTuiState({ ...state, height: 10 }, counts);
    expect(shrunk.card).toBe(29);
    expect(shrunk.scroll).toBe(23); // 30 - 7 body rows
    const shrunkFrame = renderTui(LONG, shrunk, { color: false });
    expect(shrunkFrame).not.toContain("demo-22");
    expect(shrunkFrame).toContain("> T demo-29");
  });

  it("keeps the window valid after a filter shrinks the column", () => {
    const counts = tuiColumnCounts(LONG, "");
    let state = initialTuiState(200, 24);
    for (let i = 0; i < 29; i++) state = handleKey(state, "\x1b[B", { counts });
    expect(state.scroll).toBe(9);

    const filteredCounts = tuiColumnCounts(LONG, "demo-2"); // demo-20..demo-29
    expect(filteredCounts[0]).toBe(10);
    const next = clampTuiState({ ...state, filter: "demo-2" }, filteredCounts);
    expect(next.card).toBe(9);
    expect(next.scroll).toBe(0);
    const frame = renderTui(LONG, next, { color: false });
    expect(frame).toContain("> T demo-29 Demo item 29");
    expect(frame).toContain("demo-20");
    expect(frame).toContain("row 10/10");
  });

  it("shows the position in the footer and follows the selection", () => {
    const counts = tuiColumnCounts(LONG, "");
    let state = initialTuiState(200, 24);
    expect(lines(renderTui(LONG, state, { color: false }))[23]).toContain("row 1/30");
    for (let i = 0; i < 29; i++) state = handleKey(state, "\x1b[B", { counts });
    expect(lines(renderTui(LONG, state, { color: false }))[23]).toContain("row 30/30");
    // Empty column: an honest zero instead of a stale row.
    const empty = { ...state, column: 3 };
    expect(lines(renderTui(LONG, empty, { color: false }))[23]).toContain("row 0/0");
  });
});

// ---------- data parity with list / board (kernel read path) ----------

function writeItem(
  root: string,
  rel: string,
  frontmatter: Record<string, string>,
  body = "# body\n",
): void {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  const lines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  writeFileSync(
    full,
    `---\n${lines}\nlabels: []\ncreated: "2026-09-11"\nupdated: "2026-09-11"\n---\n\n${body}`,
    "utf8",
  );
}

function newTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-tui-"));
  mkdirSync(join(root, "tasks"), { recursive: true });
  writeFileSync(join(root, "tasks/.convention.yml"), "version: 0\n", "utf8");
  writeItem(root, "tasks/launch/launch.md", {
    type: "initiative",
    status: "todo",
    id: "launch",
  });
  writeItem(root, "tasks/launch/epic-a/epic-a.md", {
    type: "epic",
    status: "todo",
    id: "epic-a",
    parent: "launch",
  });
  writeItem(root, "tasks/launch/epic-a/story-login/story-login.md", {
    type: "story",
    status: "in_progress",
    id: "story-login",
    parent: "epic-a",
    assignee: "arggon",
  });
  writeItem(root, "tasks/launch/epic-a/story-login/task-rate-limit.md", {
    type: "task",
    status: "todo",
    id: "task-rate-limit",
    parent: "story-login",
    title: "Add rate limiting",
  });
  writeItem(root, "tasks/launch/epic-a/story-login/bug-login-500.md", {
    type: "bug",
    status: "blocked",
    id: "bug-login-500",
    parent: "story-login",
    blocked_reason: "waiting on oauth",
    title: "Login 500 on empty password",
  });
  writeItem(root, "tasks/launch/epic-a/story-archived/story-archived.md", {
    type: "story",
    status: "done",
    id: "story-archived",
    parent: "epic-a",
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
    // Every item carries its raw body for the detail pane (same read pass, so
    // board and pane can never disagree), keyed by id.
    expect([...tui.details.keys()].sort()).toEqual(tui.items.map((i) => i.id).sort());
    expect(tui.details.get("task-rate-limit")?.body).toContain("# body");
    expect(tui.details.get("task-rate-limit")?.id).toBe("task-rate-limit");
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
    term.input.write("\r"); // open the read-only detail pane
    term.input.write("\x1b[6~"); // PgDn inside the pane
    term.input.write("\x1b"); // Esc: back to the board, same selection
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
    // The pane opened on the selected card (in_progress column).
    expect(text).toContain("arggon detail · story-login");
    expect(text).toContain("esc back");
    // Esc rendered the board again with the selection untouched: the frame
    // after the pane is the board, still on the in_progress card.
    const afterPane = text.slice(text.indexOf("arggon detail · story-login"));
    const boardFrame = afterPane.slice(afterPane.indexOf("\x1b[H\x1b[2J"));
    expect(boardFrame).toContain("arggon board --tui");
    expect(boardFrame).toContain("> S story-login");
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

/** newTree() plus 30 todo tasks (demo-00..demo-29) to force a scroll window. */
function longTree(): string {
  const root = newTree();
  for (let i = 0; i < 30; i++) {
    const id = `demo-${String(i).padStart(2, "0")}`;
    writeItem(root, `tasks/launch/epic-a/story-login/${id}.md`, {
      type: "task",
      status: "todo",
      id,
      parent: "story-login",
      title: `Demo item ${i}`,
    });
  }
  return root;
}

describe("runTuiBoard scroll window (bug-tui-selection-offscreen)", () => {
  it("pages with PgDn/End (CSI keys) and keeps the window valid across a resize", async () => {
    const root = longTree();
    const todoCount = tuiColumnCounts(loadTuiItems(root).items, "")[0]!;
    const term = fakeTerminal();
    term.output.columns = 200; // wide: card ids render unclipped
    term.output.rows = 24; // 21 body rows
    const done = runTuiBoard({ cwd: root, input: term.input, output: term.output });
    const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 25));
    term.input.write("\x1b[6~"); // PgDn: one full body page
    await tick();
    term.input.write("\x1b[F"); // End: last card
    await tick();
    term.output.rows = 10; // shrink: 7 body rows
    term.output.emit("resize");
    await tick();
    term.input.write("q");
    await done;

    const text = term.outputText();
    expect(text).toContain("row 1/" + todoCount); // initial frame
    // PgDn moved the window and kept the highlighted row in the frame (the
    // old 3-char splitter cut `\x1b[6~` into unknown keys and did nothing).
    expect(text).toContain("row 22/" + todoCount);
    expect(text).toContain("\x1b[7m> T demo-21 Demo item 21");
    expect(text).toContain("row " + todoCount + "/" + todoCount); // End
    expect(text).toContain("\x1b[7m> T task-rate-limit Add rate limiting");
    // Last frame = after the resize: full height, window pulled back, selected
    // row drawn.
    const frames = text.split("\x1b[H\x1b[2J").slice(1);
    const lastLines = lines(`\x1b[H\x1b[2J${frames[frames.length - 1] ?? ""}`);
    expect(lastLines.length).toBe(10);
    const body = lastLines.join("\n");
    expect(body).toContain("row " + todoCount + "/" + todoCount);
    expect(body).toContain("\x1b[7m> T task-rate-limit Add rate limiting");
    expect(body).not.toContain("demo-19"); // window starts after demo-25
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
    priority: null,
    created: null,
    updated: null,
    path: `tasks/x/${id}.md`,
    blocked_reason: null,
    milestone: null,
    depends_on: [],
    claimed_at: null,
    worktree_path: null,
    issue: null,
  });

  it("keeps right-hand columns at their own x-offset when the selected column runs out of cards (color on)", () => {
    const items = [
      mk("task-b1", "blocked"),
      mk("task-d1", "done"),
      mk("task-d2", "done"),
      mk("task-d3", "done"),
    ];
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

describe("tui dependency visuals (task-board-dependency-visuals)", () => {
  it("marks dependency-blocked cards with a ⌫ tag; terminal-only deps and clean cards stay unmarked", () => {
    const items = [
      item({ id: "task-a", type: "task", status: "todo", depends_on: ["task-x"] }),
      item({ id: "task-b", type: "task", status: "todo", depends_on: ["done-y"] }),
      item({ id: "task-c", type: "task", status: "todo" }),
      item({ id: "task-x", type: "task", status: "in_progress" }),
      item({ id: "done-y", type: "task", status: "done" }),
    ];
    const frame = renderTui(items, initialTuiState(120, 24), { color: false });
    expect(frame).toContain("T task-a ⌫ ");
    expect(frame).not.toContain("T task-b ⌫");
    expect(frame).not.toContain("T task-c ⌫");
    // Unknown dep ids count as open (same rule as the HTML board).
    const frameUnknown = renderTui(
      [item({ id: "task-d", type: "task", status: "todo", depends_on: ["gone-z"] })],
      initialTuiState(120, 24),
      { color: false },
    );
    expect(frameUnknown).toContain("T task-d ⌫ ");
  });

  it("tuiDepBlocked matches the HTML board open-dep rule", () => {
    const items = [
      item({ id: "task-x", type: "task", status: "in_progress" }),
      item({ id: "done-y", type: "task", status: "done" }),
      item({ id: "cancel-z", type: "task", status: "cancelled" }),
      item({ id: "task-a", type: "task", status: "todo", depends_on: ["task-x"] }),
      item({ id: "task-b", type: "task", status: "todo", depends_on: ["done-y", "cancel-z"] }),
    ];
    expect(tuiDepBlocked(items, items[3])).toBe(true);
    expect(tuiDepBlocked(items, items[4])).toBe(false);
    expect(tuiDepBlocked(items, { ...items[3], depends_on: [] })).toBe(false);
    expect(tuiDepBlocked(items, { ...items[3], depends_on: ["missing"] })).toBe(true);
  });
});

// ---------- detail pane (task-tui-detail-pane) ----------

/** Body with acceptance rows, a wrapping line and a short tail. */
const DETAIL_BODY = [
  "# Context",
  "",
  "A line that is definitely longer than forty columns so that it wraps.",
  "",
  "## Acceptance",
  "",
  "- [x] first row",
  "- [ ] second row",
  "",
  "## Notes",
  "",
  "tail",
].join("\n");

function detailItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return item({
    id: "task-detail",
    type: "task",
    status: "in_progress",
    title: "Read me in the pane",
    assignee: "arggon",
    branch: "feat/task-detail",
    priority: "p1",
    labels: ["tui", "ui"],
    depends_on: ["bug-beta", "task-alpha", "done-zeta"],
    worktree_path: "/tmp/wt/task-detail",
    milestone: "2026-10-01",
    ...overrides,
  });
}

const DETAIL_ITEMS = [
  detailItem(),
  item({ id: "bug-beta", type: "bug", status: "todo", title: "Login 500" }),
  item({ id: "task-alpha", type: "task", status: "in_progress", title: "Rate limit" }),
  item({ id: "done-zeta", type: "task", status: "done", title: "Shipped" }),
];

const DETAIL_SOURCES = new Map<string, TuiDetailSource>([
  ["task-detail", { id: "task-detail", body: DETAIL_BODY }],
]);

function detailLines(input: Partial<TuiDetailInput> = {}): string[] {
  return buildTuiDetailLines({
    item: detailItem(),
    id: "task-detail",
    items: DETAIL_ITEMS,
    body: DETAIL_BODY,
    width: 120,
    ...input,
  });
}

describe("detail pane: documented caps and threshold", () => {
  it("pins the configuration the README and the renderer both name", () => {
    expect(TUI_DETAIL_NARROW_WIDTH).toBe(40);
    expect(TUI_DETAIL_MAX_BODY_LINES).toBe(400);
    expect(TUI_DETAIL_MAX_LINES).toBe(1000);
  });
});

describe("detail pane: wrapTuiLine", () => {
  it("wraps at spaces, hard-breaks long words and handles degenerate widths", () => {
    expect(wrapTuiLine("hello world", 20)).toEqual(["hello world"]);
    expect(wrapTuiLine("aaaa bbbb cccc", 9)).toEqual(["aaaa bbbb", "cccc"]);
    expect(wrapTuiLine("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
    expect(wrapTuiLine("", 10)).toEqual([""]);
    expect(wrapTuiLine("anything", 0)).toEqual([]);
    // Every segment fits the requested width (the pane's contract).
    for (const line of wrapTuiLine("one two three four five six seven", 7)) {
      expect(line.length).toBeLessThanOrEqual(7);
    }
  });
});

describe("detail pane: geometry and scroll clamp", () => {
  it("derives the content rows from the pane frame", () => {
    expect(tuiDetailBodyRows(24)).toBe(22);
    expect(tuiDetailBodyRows(8)).toBe(6);
    expect(tuiDetailBodyRows(2)).toBe(0);
    expect(tuiDetailBodyRows(1)).toBe(0);
  });

  it("clamps the pane window to the content and never pages past the end", () => {
    expect(clampTuiDetailScroll(0, 50, 20)).toBe(0);
    expect(clampTuiDetailScroll(10, 50, 20)).toBe(10);
    expect(clampTuiDetailScroll(30, 50, 20)).toBe(30); // last full page
    expect(clampTuiDetailScroll(999, 50, 20)).toBe(30); // no overshoot
    expect(clampTuiDetailScroll(-3, 50, 20)).toBe(0);
    expect(clampTuiDetailScroll(5, 10, 20)).toBe(0); // content fits
    expect(clampTuiDetailScroll(5, 0, 20)).toBe(0); // no content
    expect(clampTuiDetailScroll(5, 50, 0)).toBe(0); // no room
  });
});

describe("detail pane: acceptance rows", () => {
  it("uses the cascade's task-list rule, marker variants included", () => {
    const rows = tuiAcceptanceRows(
      ["- [ ] open", "  * [x] done", "- [X] also done", "- [] not a checkbox", "prose"].join("\n"),
    );
    expect(rows).toEqual([
      { checked: false, text: "open" },
      { checked: true, text: "done" },
      { checked: true, text: "also done" },
    ]);
  });
});

describe("detail pane: dependency summary", () => {
  it("carries each dependency's status and marks the open ones", () => {
    const dep = detailItem();
    expect(tuiDependencySummary(dep, DETAIL_ITEMS)).toBe(
      "bug-beta (todo ⌫), task-alpha (in_progress ⌫), done-zeta (done)",
    );
    expect(tuiDependencySummary(detailItem({ depends_on: [] }), DETAIL_ITEMS)).toBe("(none)");
    // Unknown ids count as open, same rule as the board's ⌫ tag.
    expect(tuiDependencySummary(detailItem({ depends_on: ["gone-z"] }), DETAIL_ITEMS)).toBe(
      "gone-z (unknown ⌫)",
    );
    expect(
      tuiDependencySummary(detailItem({ depends_on: ["cancel-z"] }), [
        ...DETAIL_ITEMS,
        item({ id: "cancel-z", type: "task", status: "cancelled" }),
      ]),
    ).toBe("cancel-z (cancelled)");
  });
});

describe("detail pane: buildTuiDetailLines content (120 columns)", () => {
  it("renders title, every field, the acceptance excerpt and the body", () => {
    const got = detailLines();
    expect(got[0]).toBe("T task-detail — Read me in the pane");
    expect(got).toContain("type: task · status: in_progress · priority: p1 · assignee: arggon");
    expect(got).toContain("labels: tui, ui · milestone: 2026-10-01");
    expect(got).toContain(
      "parent: (none) · branch: feat/task-detail · worktree: /tmp/wt/task-detail",
    );
    expect(got).toContain(
      "path: tasks/x/task-detail.md · dependencies: bug-beta (todo ⌫), task-alpha (in_progress ⌫), done-zeta (done)",
    );
    expect(got).toContain("acceptance 1/2:");
    expect(got).toContain("  [x] first row");
    expect(got).toContain("  [ ] second row");
    expect(got).toContain("body:");
    expect(got).toContain("  # Context");
    expect(got).toContain("  tail");
    for (const line of got) expect(line.length).toBeLessThanOrEqual(120);
  });

  it("falls back to the id for a missing title and names absent fields", () => {
    const got = detailLines({ item: detailItem({ title: null, assignee: null, labels: [] }) });
    expect(got[0]).toBe("T task-detail — task-detail");
    expect(got.join("\n")).toContain("assignee: (none)");
    expect(got.join("\n")).toContain("labels: (none)");
  });

  it("reports an item that vanished from the tree instead of rendering a stale body", () => {
    const got = detailLines({ item: null, id: "task-gone", body: "" });
    expect(got[0]).toBe("item task-gone is not in the tree anymore");
    expect(got.join("\n")).toContain("esc · back to the board");
  });
});

describe("detail pane: wrapping, narrow layout, caps and sanitization", () => {
  it("wraps the body to the pane width without clipping it", () => {
    const got = detailLines({ width: 40 });
    for (const line of got) expect(line.length).toBeLessThanOrEqual(40);
    // The wrapping line survives in full: the wrap only replaces the break
    // space, so a whitespace-normalized join reproduces the source text.
    const joined = got.join("\n").replace(/\s+/g, " ");
    expect(joined).toContain(
      "A line that is definitely longer than forty columns so that it wraps.",
    );
    expect(joined).not.toContain("…");
  });

  it("stacks one field per line below the narrow threshold, values wrapped", () => {
    const got = detailLines({ width: 30 });
    expect(got).toContain("type: task");
    expect(got).toContain("status: in_progress");
    expect(got).toContain("priority: p1");
    expect(got).toContain("assignee: arggon");
    expect(got.some((line) => line.startsWith("type: task ·"))).toBe(false);
    expect(got.some((line) => line.startsWith("labels: tui, ui ·"))).toBe(false);
    for (const line of got) expect(line.length).toBeLessThanOrEqual(30);
  });

  it("caps the body lines and the rendered lines with explicit markers", () => {
    const body = ["# Context", "one", "two", "three", "four", "five"].join("\n");
    const cappedBody = detailLines({ body, maxBodyLines: 3 });
    expect(cappedBody.join("\n")).toContain("… body truncated: 3 of 6 line(s) omitted (cap 3)");
    expect(cappedBody.join("\n")).not.toContain("three");

    const cappedAll = detailLines({ body, maxLines: 12 });
    expect(cappedAll.length).toBeLessThanOrEqual(12);
    expect(cappedAll[cappedAll.length - 1]).toContain("rendered line cap 12");
  });

  it("sanitizes every body line through the human-text path", () => {
    const hostile = `${DETAIL_BODY}\n\u001b[31mred\u0007bell\u2028sep`;
    const got = detailLines({ body: hostile, width: 120 });
    const joined = got.join("\n");
    expect(joined).not.toContain("\u001b");
    expect(joined).not.toContain("\u0007");
    expect(joined).not.toContain("\u2028");
    expect(joined).toContain("\\u001b[31mred\\u0007bell\\u2028sep");
  });

  it("sanitizes hostile ids, titles, labels and dependency ids", () => {
    const hostile = "\u001b[2J";
    const got = detailLines({
      item: detailItem({
        id: `task-a${hostile}b`,
        title: `title${hostile}`,
        labels: [`lab${hostile}`],
        depends_on: [`dep${hostile}`],
        worktree_path: `/tmp${hostile}/wt`,
      }),
      id: "task-a\u001b[2Jb",
    });
    expect(got.join("\n")).not.toContain("\u001b");
    expect(got.join("\n")).toContain("\\u001b[2J");
  });
});

describe("detail pane: renderTuiDetail golden", () => {
  const detail = { id: "task-detail", scroll: 0 };

  it("renders exactly height padded lines: header, window, footer", () => {
    const frame = renderTuiDetail(
      DETAIL_ITEMS,
      detail,
      DETAIL_SOURCES,
      { width: 80, height: 12 },
      { color: false },
    );
    expect(frame.startsWith("\x1b[H\x1b[2J")).toBe(true);
    const got = lines(frame);
    expect(got.length).toBe(12);
    for (const line of got) expect(line.length).toBe(80);
    expect(got[0]).toBe("arggon detail · task-detail · esc back".padEnd(80));
    const content = tuiDetailLinesFor(DETAIL_ITEMS, DETAIL_SOURCES, detail, 80);
    expect(got.slice(1, 11)).toEqual(content.slice(0, 10).map((line) => line.padEnd(80)));
    expect(got[11]).toContain(`row 1/${content.length} · ↑/↓ line`);
    expect(got[11]).toContain("esc back · q quit");
  });

  it("scrolls the window with the pane scroll and clamps a stale one", () => {
    const content = tuiDetailLinesFor(DETAIL_ITEMS, DETAIL_SOURCES, detail, 80);
    const rows = tuiDetailBodyRows(12);
    const scrolled = renderTuiDetail(
      DETAIL_ITEMS,
      { id: "task-detail", scroll: 3 },
      DETAIL_SOURCES,
      { width: 80, height: 12 },
      { color: false },
    );
    const got = lines(scrolled);
    expect(got[1]).toBe(content[3].padEnd(80));
    expect(got[11]).toContain("row 4/");

    // A stale scroll (content shrank, resize, tree re-read) still renders the
    // last full window instead of an empty frame.
    const clamped = renderTuiDetail(
      DETAIL_ITEMS,
      { id: "task-detail", scroll: 10_000 },
      DETAIL_SOURCES,
      { width: 80, height: 12 },
      { color: false },
    );
    const clampedLines = lines(clamped);
    const maxScroll = content.length - rows;
    expect(clampedLines[1]).toBe(content[maxScroll].padEnd(80));
    expect(clampedLines[11]).toContain(`row ${maxScroll + 1}/${content.length}`);
  });

  it("highlights the pane header with SGR when color is on", () => {
    const frame = renderTuiDetail(DETAIL_ITEMS, detail, DETAIL_SOURCES, { width: 80, height: 12 });
    expect(frame).toContain("\x1b[1marggon detail · task-detail · esc back");
    const plain = renderTuiDetail(
      DETAIL_ITEMS,
      detail,
      DETAIL_SOURCES,
      { width: 80, height: 12 },
      { color: false },
    );
    expect(plain).not.toContain("\x1b[1m");
  });

  it("renders a marker (not a stale body) when the item is gone", () => {
    const frame = renderTuiDetail(
      DETAIL_ITEMS,
      { id: "task-gone", scroll: 0 },
      DETAIL_SOURCES,
      { width: 80, height: 8 },
      { color: false },
    );
    expect(frame).toContain("item task-gone is not in the tree anymore");
  });
});

describe("detail pane: renderTuiScreen dispatch", () => {
  it("draws the board when no pane is open and the pane when one is", () => {
    const boardState = initialTuiState(80, 8);
    expect(renderTuiScreen(THREE, boardState, DETAIL_SOURCES, { color: false })).toBe(
      renderTui(THREE, boardState, { color: false }),
    );
    const paneState = { ...boardState, detail: { id: "task-detail", scroll: 0 } };
    expect(renderTuiScreen(THREE, paneState, DETAIL_SOURCES, { color: false })).toBe(
      renderTuiDetail(
        THREE,
        { id: "task-detail", scroll: 0 },
        DETAIL_SOURCES,
        { width: 80, height: 8 },
        { color: false },
      ),
    );
  });
});

describe("detail pane: handleKey", () => {
  /** The board in a known state, pane open on task-detail. */
  const openPane = (overrides: Partial<TuiState> = {}): TuiState => ({
    ...initialTuiState(80, 10),
    column: 1,
    card: 2,
    scroll: 1,
    filter: "log",
    detail: { id: "task-detail", scroll: 0 },
    ...overrides,
  });

  it("opens with Enter on the selected card and leaves the board state alone", () => {
    const board = { ...initialTuiState(80, 10), column: 1, card: 2, scroll: 1, filter: "log" };
    const opened = handleKey(board, "\r", { selectedId: "task-detail" });
    expect(opened.detail).toEqual({ id: "task-detail", scroll: 0 });
    expect(opened.column).toBe(1);
    expect(opened.card).toBe(2);
    expect(opened.scroll).toBe(1);
    expect(opened.filter).toBe("log");
    expect(opened.message).toBeNull();
  });

  it("closes on esc and on enter, restoring the board exactly", () => {
    const state = openPane();
    for (const key of ["\x1b", "\r"]) {
      const back = handleKey(state, key, { detailLines: 100 });
      expect(back.detail).toBeNull();
      expect(back.column).toBe(state.column);
      expect(back.card).toBe(state.card);
      expect(back.scroll).toBe(state.scroll);
      expect(back.filter).toBe(state.filter);
      // The board is live again: Enter reopens on the same card.
      const reopened = handleKey(back, "\r", { selectedId: "task-detail" });
      expect(reopened.detail).toEqual({ id: "task-detail", scroll: 0 });
    }
  });

  it("scrolls with ↑/↓ and pages with PgUp/PgDn, clamped to the content", () => {
    const state = openPane();
    const rows = tuiDetailBodyRows(state.height); // 8
    expect(rows).toBe(8);
    expect(handleKey(state, "\x1b[B", { detailLines: 100 }).detail?.scroll).toBe(1);
    expect(handleKey(state, "\x1b[A", { detailLines: 100 }).detail?.scroll).toBe(0);
    expect(handleKey(state, "\x1b[6~", { detailLines: 100 }).detail?.scroll).toBe(8);
    expect(
      handleKey(openPane({ detail: { id: "task-detail", scroll: 20 } }), "\x1b[5~", {
        detailLines: 100,
      }).detail?.scroll,
    ).toBe(12);
    expect(handleKey(state, "\x1b[F", { detailLines: 100 }).detail?.scroll).toBe(92);
    expect(handleKey(state, "\x1b[4~", { detailLines: 100 }).detail?.scroll).toBe(92);
    expect(
      handleKey(openPane({ detail: { id: "task-detail", scroll: 50 } }), "\x1b[H", {
        detailLines: 100,
      }).detail?.scroll,
    ).toBe(0);
    expect(
      handleKey(openPane({ detail: { id: "task-detail", scroll: 50 } }), "\x1b[1~", {
        detailLines: 100,
      }).detail?.scroll,
    ).toBe(0);
    // Batch typed into one chunk: the reducer's context (lines) still applies.
    expect(handleKey(state, "\x1b[B", { detailLines: 4 }).detail?.scroll).toBe(0);
  });

  it("ignores board keys inside the pane, quits on q/Ctrl-C and never writes", () => {
    const state = openPane();
    expect(handleKey(state, "/", { detailLines: 100 })).toEqual(state);
    expect(handleKey(state, "\x1b[C", { detailLines: 100 })).toEqual(state);
    expect(handleKey(state, "x", { detailLines: 100 })).toEqual(state);
    expect(handleKey(state, "q", { detailLines: 100 }).quit).toBe(true);
    expect(handleKey(state, "\x03", { detailLines: 100 }).quit).toBe(true);
  });
});

describe("detail pane: runTuiBoard loop", () => {
  it("opens with Enter, scrolls with PgDn and Esc returns to the same selection", async () => {
    const root = newTree();
    const body = [
      "## Acceptance",
      "",
      "- [x] long body checkbox",
      "- [ ] second checkbox",
      "",
      ...Array.from({ length: 60 }, (_, i) => `Body line ${String(i).padStart(2, "0")}`),
    ].join("\n");
    writeItem(
      root,
      "tasks/launch/epic-a/story-login/task-rate-limit.md",
      {
        type: "task",
        status: "todo",
        id: "task-rate-limit",
        parent: "story-login",
        title: "Add rate limiting",
      },
      `${body}\n`,
    );
    const before = readFileSync(
      join(root, "tasks/launch/epic-a/story-login/task-rate-limit.md"),
      "utf8",
    );

    const term = fakeTerminal();
    term.output.columns = 200;
    term.output.rows = 24; // 22 pane rows
    const done = runTuiBoard({ cwd: root, input: term.input, output: term.output });
    const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 25));
    term.input.write("\x1b[B"); // card 0 (epic-a) -> card 1
    await tick();
    term.input.write("\x1b[B"); // card 2: task-rate-limit
    await tick();
    term.input.write("\r"); // open the pane
    await tick();
    term.input.write("\x1b[6~"); // PgDn: one pane page
    await tick();
    term.input.write("\x1b"); // Esc: back to the board
    await tick();
    term.input.write("q");
    await done;

    const text = term.outputText();
    expect(text).toContain("arggon detail · task-rate-limit · esc back");
    expect(text).toContain("acceptance 1/2:");
    expect(text).toContain("[x] long body checkbox");
    expect(text).toContain("body:");
    expect(text).toContain("row 1/"); // pane opened at the top
    expect(text).toContain("row 23/"); // one page down (22 rows)
    const frames = text.split("\x1b[H\x1b[2J");
    const last = frames[frames.length - 1] ?? "";
    expect(last.startsWith("arggon board --tui")).toBe(true);
    expect(last).toContain("> T task-rate-limit Add rate limiting");
    // The pane is read-only: the item file is byte-identical after the visit.
    expect(
      readFileSync(join(root, "tasks/launch/epic-a/story-login/task-rate-limit.md"), "utf8"),
    ).toBe(before);
  });

  it("keeps the pane window valid when the item disappears mid-session", async () => {
    const root = newTree();
    const target = join(root, "tasks/launch/epic-a/story-login/task-rate-limit.md");
    const term = fakeTerminal();
    term.output.columns = 200;
    term.output.rows = 24;
    const done = runTuiBoard({ cwd: root, input: term.input, output: term.output });
    const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 25));
    term.input.write("\x1b[B");
    await tick();
    term.input.write("\x1b[B");
    await tick();
    term.input.write("\r"); // pane open on task-rate-limit
    await tick();
    rmSync(target, { force: true }); // tree changed while the pane is open
    term.input.write("\x1b[B"); // any key re-reads the tree
    await tick();
    term.input.write("\x1b");
    await tick();
    term.input.write("q");
    await done;
    expect(term.outputText()).toContain("item task-rate-limit is not in the tree anymore");
  });
});
