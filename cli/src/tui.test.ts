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
  applyTuiSort,
  buildTuiDetailLines,
  clampTuiDetailScroll,
  clampTuiState,
  clipLine,
  createTuiKeyDecoder,
  followTuiScroll,
  formatTuiClock,
  handleKey,
  initialTuiState,
  loadTuiItems,
  nextTuiSort,
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
  tuiLegalMoves,
  tuiLensFilter,
  tuiViewItems,
  tuiViewOptions,
  visibleTuiItems,
  wrapTuiLine,
} from "./tui.js";
import type {
  TuiActionState,
  TuiDetailInput,
  TuiDetailSource,
  TuiState,
  TuiWatchFactory,
} from "./tui.js";

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
      "arggon board --tui · 3 item(s) · sort: id" + " ".repeat(39),
      "todo (2)        " +
        "in_progress (1) " +
        "blocked (0)     " +
        "done (0)        " +
        "cancelled (0)   ",
      "> B bug-beta Lo…" + "  S story-gamma…" + "  (empty)         (empty)         (empty)       ",
      "  T task-alpha …" + " ".repeat(64),
      " ".repeat(80),
      " ".repeat(80),
      " ".repeat(80),
      // The position leads (bug-tui-selection-offscreen); at 80 columns the
      // tail of the key help is clipped, never the position.
      "row 1/2 · ←/→ column · ↑/↓ card · PgUp/PgDn page · home/end · / search · v view…",
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
    // After applying the filter the footer carries the lens (filter + matched
    // totals, task-tui-filter-language) before the help tail (clipped at 80
    // columns); Enter with no selection only messages.
    expect(lines(renderTui(THREE, state, { color: false }))[7]).toContain(
      // bug-beta (id) and story-gamma (title "Terminal UI kanban") match the
      // needle; the todo column shows one of them.
      "row 1/1 · filter: b · 2/3 match",
    );
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
    expect(tuiColumnCounts(THREE, { filter: "", sort: "id", readyOnly: false })).toEqual([
      2, 1, 0, 0, 0,
    ]);
    expect(tuiColumnCounts(THREE, { filter: "alpha", sort: "id", readyOnly: false })).toEqual([
      1, 0, 0, 0, 0,
    ]);
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
    const counts = tuiColumnCounts(LONG, { filter: "", sort: "id", readyOnly: false });
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
    const counts = tuiColumnCounts(LONG, { filter: "", sort: "id", readyOnly: false });
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
    const counts = tuiColumnCounts(LONG, { filter: "", sort: "id", readyOnly: false });
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
    const counts = tuiColumnCounts(LONG, { filter: "", sort: "id", readyOnly: false });
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
    const counts = tuiColumnCounts(LONG, { filter: "", sort: "id", readyOnly: false });
    let state = initialTuiState(200, 24);
    for (let i = 0; i < 29; i++) state = handleKey(state, "\x1b[B", { counts });
    expect(state.scroll).toBe(9);

    const filteredCounts = tuiColumnCounts(LONG, {
      filter: "demo-2",
      sort: "id",
      readyOnly: false,
    }); // demo-20..demo-29
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
    const counts = tuiColumnCounts(LONG, { filter: "", sort: "id", readyOnly: false });
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
    const todoCount = tuiColumnCounts(loadTuiItems(root).items, {
      filter: "",
      sort: "id",
      readyOnly: false,
    })[0]!;
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

// ---------- stateful key decoder (bug-tui-split-escape-sequences) ----------

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("createTuiKeyDecoder (bug-tui-split-escape-sequences)", () => {
  it("reassembles a PgDn split across two chunks instead of leaking an Esc", () => {
    const decoder = createTuiKeyDecoder();
    expect(decoder.decode("\x1b[6")).toEqual([]); // held, NOT consumed as Esc
    expect(decoder.pending).toBe("\x1b[6");
    expect(decoder.decode("~")).toEqual(["\x1b[6~"]); // completed by the next chunk
    expect(decoder.pending).toBe("");
  });

  it("reassembles Home split right after the ESC byte", () => {
    const decoder = createTuiKeyDecoder();
    expect(decoder.decode("\x1b")).toEqual([]);
    expect(decoder.decode("[H")).toEqual(["\x1b[H"]);
    expect(decoder.pending).toBe("");
  });

  it("emits a held Esc as a real Esc key when an unrelated byte follows", () => {
    const decoder = createTuiKeyDecoder();
    expect(decoder.decode("\x1b")).toEqual([]);
    expect(decoder.decode("5")).toEqual(["\x1b", "5"]); // Esc, then the plain key
    expect(decoder.pending).toBe("");
  });

  it("keeps whole sequences and mixed chunks byte-exact with splitKeys", () => {
    const decoder = createTuiKeyDecoder();
    expect(decoder.decode("\x1b[6~\x1b[Hq")).toEqual(["\x1b[6~", "\x1b[H", "q"]);
    expect(decoder.decode("ab\x1b[C\x1b")).toEqual(["a", "b", "\x1b[C"]);
    expect(decoder.pending).toBe("\x1b"); // only the trailing ESC is held
  });

  it("flush() drains a lone held ESC as Esc when no continuation follows", () => {
    const decoder = createTuiKeyDecoder();
    expect(decoder.decode("\x1b")).toEqual([]);
    expect(decoder.flush()).toEqual(["\x1b"]);
    expect(decoder.pending).toBe("");
  });

  it("flush() drains a half-delivered sequence as plain per-character keys", () => {
    const decoder = createTuiKeyDecoder();
    expect(decoder.decode("x\x1b[1")).toEqual(["x"]);
    expect(decoder.pending).toBe("\x1b[1");
    expect(decoder.flush()).toEqual(["\x1b", "[", "1"]);
  });
});

describe("runTuiBoard split escape sequence (bug-tui-split-escape-sequences)", () => {
  it("a PgDn split across chunks scrolls instead of clearing the filter", async () => {
    const root = longTree();
    const term = fakeTerminal();
    term.output.columns = 200;
    const done = runTuiBoard({ cwd: root, input: term.input, output: term.output });
    term.input.write("/demo"); // filter the board down to the demo-* tasks
    term.input.write("\r"); // apply the filter
    term.input.write("\x1b[6"); // PgDn, first half only: must NOT act as Esc
    await wait(10);
    term.input.write("~"); // second half — the decoder reassembles one PgDn
    await wait(150); // past the esc flush window: nothing else may decay
    term.input.write("q");
    await done;
    const text = term.outputText();
    expect(text).toContain("filter: demo"); // the filter survived the paging
    expect(text).toContain("row 22/30"); // one full body page scrolled
    expect(text).toContain("\x1b[7m> T demo-21 Demo item 21");
  });

  it("a lone ESC is flushed by the esc timeout and keeps its semantics", async () => {
    const root = newTree();
    const term = fakeTerminal();
    const done = runTuiBoard({ cwd: root, input: term.input, output: term.output });
    term.input.write("/"); // open the search prompt
    term.input.write("log"); // partial filter
    await wait(10);
    term.input.write("\x1b"); // lone Esc: no continuation will follow
    await wait(150); // the esc flush releases it as a real Esc keypress
    term.input.write("q");
    await done;
    const frames = term.outputText().split("\x1b[H\x1b[2J");
    const last = frames[frames.length - 1] ?? "";
    expect(last).not.toContain("esc to cancel"); // the search prompt closed
    expect(last).not.toContain("filter:"); // and the filter was cleared
  });

  it("ESC then an unrelated key in the next chunk quits with both applied", async () => {
    const root = newTree();
    const term = fakeTerminal();
    const done = runTuiBoard({ cwd: root, input: term.input, output: term.output });
    term.input.write("\x1b"); // lone Esc (held)
    term.input.write("q"); // unrelated byte: releases the Esc, then quits
    await done; // resolves: the loop exited cleanly
    expect(term.outputText().endsWith("\x1b[?25h\x1b[?1049l")).toBe(true);
  });
});

// ---------- live refresh (task-tui-live-refresh) ----------

/** Counts the frames the loop has drawn (every render starts with a clear). */
const frameCount = (text: string): number => text.split("\x1b[H\x1b[2J").length - 1;

/** Injectable watcher double: records the watched dir and fires on demand. */
function fakeWatchFactory(): {
  factory: TuiWatchFactory;
  watchers: Array<{ dir: string; onEvent: () => void; closed: boolean }>;
  fire: (index: number) => void;
} {
  const watchers: Array<{ dir: string; onEvent: () => void; closed: boolean; close(): void }> = [];
  const factory: TuiWatchFactory = (dir, onEvent) => {
    const watcher = {
      dir,
      onEvent,
      closed: false,
      close(): void {
        watcher.closed = true;
      },
    };
    watchers.push(watcher);
    return watcher;
  };
  return {
    factory,
    watchers,
    fire: (index) => watchers[index]!.onEvent(),
  };
}

describe("tui freshness stamp (task-tui-live-refresh)", () => {
  it("formatTuiClock renders local HH:MM:SS and degrades a broken clock", () => {
    expect(formatTuiClock(new Date(2026, 8, 30, 12, 3, 44).getTime())).toBe("12:03:44");
    expect(formatTuiClock(new Date(2026, 8, 30, 7, 5, 9).getTime())).toBe("07:05:09");
    expect(formatTuiClock(Number.NaN)).toBe("--:--:--");
  });

  it("the footer carries the stamp when the data is stamped, nothing before", () => {
    const items = visibleTuiItems(loadTuiItems(newTree()).items, "");
    // Wide terminal: the help text now carries the sort/lens keys too
    // (task-tui-sort-ready-lens), so 120 columns would clip `q quit` before
    // the assertion can see it.
    const stamped = renderTui(
      items,
      { ...initialTuiState(200, 10), updatedAt: new Date(2026, 8, 30, 12, 3, 44).getTime() },
      { color: false },
    );
    expect(stamped).toContain("updated 12:03:44");
    expect(stamped).toContain("r refresh");
    const unstamped = renderTui(items, initialTuiState(200, 10), { color: false });
    expect(unstamped).not.toContain("updated ");
    expect(unstamped).toContain("q quit");
  });
});

describe("runTuiBoard live refresh (task-tui-live-refresh)", () => {
  it("repaints a tracker change without a keypress and preserves the selection", async () => {
    const root = newTree();
    const inject = fakeWatchFactory();
    const term = fakeTerminal();
    term.output.columns = 200;
    const done = runTuiBoard({
      cwd: root,
      input: term.input,
      output: term.output,
      watch: inject.factory,
      refreshDebounceMs: 20,
    });
    term.input.write("\x1b[B"); // select card 2 (task-rate-limit, todo)
    term.input.write("\x1b[B");
    await wait(30);
    const before = term.outputText();
    expect(before).toContain("\x1b[7m> T task-rate-limit");
    // Another session writes a new item while the board is idle... (its id
    // sorts AFTER the selected one, so the index-stable selection must not
    // move — an item sorted before it would shift the card window instead).
    writeItem(root, "tasks/launch/epic-a/story-login/task-z-live.md", {
      type: "task",
      status: "todo",
      id: "task-z-live",
      parent: "story-login",
      title: "Written behind the board's back",
    });
    // ...the watcher fires, the loop re-reads and repaints — no key pressed.
    inject.fire(0);
    await wait(120);
    term.input.write("q");
    await done;
    const text = term.outputText();
    expect(frameCount(text)).toBeGreaterThan(frameCount(before)); // a repaint happened
    expect(text).toContain("T task-z-live"); // the new card is on the board
    expect(text).toContain("\x1b[7m> T task-rate-limit"); // selection preserved
    expect(text.endsWith("\x1b[?25h\x1b[?1049l")).toBe(true);
    // The watcher watched the tracker dir (not the repo root or cwd) and quit
    // closed it.
    expect(inject.watchers[0]?.dir).toBe(loadTuiItems(root).tasksDir);
    expect(inject.watchers[0]?.closed).toBe(true);
  });

  it("a watcher burst debounces into exactly one re-read", async () => {
    const root = newTree();
    const inject = fakeWatchFactory();
    const term = fakeTerminal();
    const done = runTuiBoard({
      cwd: root,
      input: term.input,
      output: term.output,
      watch: inject.factory,
      refreshDebounceMs: 40,
    });
    await wait(30);
    const before = frameCount(term.outputText());
    inject.fire(0);
    inject.fire(0);
    inject.fire(0); // three events inside the debounce window
    await wait(150);
    term.input.write("q");
    await done;
    expect(frameCount(term.outputText())).toBe(before + 1);
  });

  it("`r` forces a refresh without any watcher event", async () => {
    const root = newTree();
    const inject = fakeWatchFactory();
    const term = fakeTerminal();
    const done = runTuiBoard({
      cwd: root,
      input: term.input,
      output: term.output,
      watch: inject.factory,
      refreshDebounceMs: 20,
    });
    await wait(30);
    const before = frameCount(term.outputText());
    term.input.write("r");
    await wait(60);
    term.input.write("q");
    await done;
    expect(frameCount(term.outputText())).toBe(before + 1);
  });

  it("a watcher that cannot open (null or throwing) degrades to keypress reads", async () => {
    const root = newTree();
    const term = fakeTerminal();
    const done = runTuiBoard({
      cwd: root,
      input: term.input,
      output: term.output,
      watch: () => null,
    });
    term.input.write("\x1b[C"); // column move proves the loop keeps working
    await wait(30);
    term.input.write("q");
    await done;
    expect(term.outputText()).toContain("\x1b[1;7min_progress (1)");
  });

  it("a throwing watcher factory never reaches the loop", async () => {
    const root = newTree();
    const term = fakeTerminal();
    const done = runTuiBoard({
      cwd: root,
      input: term.input,
      output: term.output,
      watch: () => {
        throw new Error("no inotify for you");
      },
    });
    term.input.write("q");
    await done; // resolves: the loop booted without a watcher
    expect(term.outputText()).toContain("arggon board --tui");
  });

  it("a watcher whose close fails still quits cleanly, and quit closes the watcher", async () => {
    const root = newTree();
    const term = fakeTerminal();
    const failingClose = (): { close(): void } => ({
      close(): void {
        throw new Error("already closed");
      },
    });
    const done = runTuiBoard({
      cwd: root,
      input: term.input,
      output: term.output,
      watch: failingClose,
    });
    term.input.write("q");
    await done;
    expect(term.outputText().endsWith("\x1b[?25h\x1b[?1049l")).toBe(true);
  });
});

// ---------- sort + ready lens (task-tui-sort-ready-lens) ----------

/** alpha(p2, ready) beta(p0, claimed) gamma(p1, blocked by alpha) delta(unset, ready). */
const SORT_SET: WorkItem[] = [
  item({ id: "alpha", type: "task", status: "todo", priority: "p2" }),
  item({ id: "beta", type: "task", status: "todo", priority: "p0", assignee: "mia" }),
  item({ id: "gamma", type: "bug", status: "todo", priority: "p1", depends_on: ["alpha"] }),
  item({ id: "delta", type: "task", status: "todo" }),
];

describe("nextTuiSort (task-tui-sort-ready-lens)", () => {
  it("cycles id -> priority -> next -> id", () => {
    expect(nextTuiSort("id")).toBe("priority");
    expect(nextTuiSort("priority")).toBe("next");
    expect(nextTuiSort("next")).toBe("id");
  });
});

describe("applyTuiSort + tuiViewItems (task-tui-sort-ready-lens)", () => {
  it("id sort is the canonical lexicographic order", () => {
    expect(applyTuiSort(SORT_SET, "id").map((i) => i.id)).toEqual([
      "alpha",
      "beta",
      "delta",
      "gamma",
    ]);
  });

  it("priority sort is the ADR 0009 tier order, id on ties", () => {
    expect(applyTuiSort(SORT_SET, "priority").map((i) => i.id)).toEqual([
      "beta",
      "gamma",
      "alpha",
      "delta", // unprioritized orders with the p3 tier
    ]);
  });

  it("next sort is ready-first, then tier, then downstream weight, id on ties", () => {
    // Ready: alpha, delta (beta is claimed, gamma blocked by alpha). Tiers:
    // alpha (p2) before delta (p3 tier). Blocked tail: beta (p0) before
    // gamma (p1).
    expect(applyTuiSort(SORT_SET, "next").map((i) => i.id)).toEqual([
      "alpha",
      "delta",
      "beta",
      "gamma",
    ]);
  });

  it("the ready-only lens keeps pullable work only, readiness over the whole tree", () => {
    const view = tuiViewItems(SORT_SET, { filter: "", sort: "id", readyOnly: true });
    expect(view.map((i) => i.id)).toEqual(["alpha", "delta"]); // beta claimed, gamma blocked
    // Readiness is computed over the WHOLE tree: a search filter that hides
    // alpha must not make gamma's dependency look unknown (it stays blocked,
    // not ready).
    const filtered = tuiViewItems(SORT_SET, { filter: "gam", sort: "id", readyOnly: true });
    expect(filtered).toEqual([]);
  });

  it("the lens composes with the sort and the filter", () => {
    const view = tuiViewItems(SORT_SET, { filter: "", sort: "priority", readyOnly: true });
    expect(view.map((i) => i.id)).toEqual(["alpha", "delta"]);
    const named = tuiViewItems(SORT_SET, { filter: "del", sort: "next", readyOnly: true });
    expect(named.map((i) => i.id)).toEqual(["delta"]);
  });
});

describe("renderTui sort + lens frame (task-tui-sort-ready-lens)", () => {
  it("the header shows the active sort and the ready-only lens", () => {
    const frame = lines(
      renderTui(SORT_SET, { ...initialTuiState(120, 12), sort: "next" }, { color: false }),
    );
    expect(frame[0]).toContain("sort: next");
    expect(frame[0]).not.toContain("ready-only");
    const lensed = lines(
      renderTui(SORT_SET, { ...initialTuiState(120, 12), readyOnly: true }, { color: false }),
    );
    expect(lensed[0]).toContain("sort: id · ready-only");
    expect(lensed[1]).toContain("todo (2)"); // counts narrowed with the lens
  });

  it("cards surface priority, assignee and the blocked marker", () => {
    const body = lines(renderTui(SORT_SET, initialTuiState(200, 12), { color: false })).join("\n");
    expect(body).toContain("beta p0 @mia");
    expect(body).toContain("gamma ⌫ p1");
    expect(body).toContain("alpha p2");
  });

  it("the lens hides claimed and blocked cards from the frame", () => {
    const body = lines(
      renderTui(SORT_SET, { ...initialTuiState(200, 12), readyOnly: true }, { color: false }),
    ).join("\n");
    expect(body).toContain("alpha p2");
    expect(body).not.toContain("beta p0");
    expect(body).not.toContain("gamma");
  });

  it("a lens toggle re-clamps the selection against the narrowed columns", () => {
    // card 2 (gamma in id order) under the ready lens: the todo column
    // shrinks to two cards, so the post-toggle clamp pulls the index back.
    const state = handleKey({ ...initialTuiState(200, 12), card: 2 }, "l");
    expect(state.readyOnly).toBe(true);
    const counts = tuiColumnCounts(SORT_SET, state);
    expect(clampTuiState(state, counts).card).toBe(1);
  });
});

describe("handleKey sort + lens keys (task-tui-sort-ready-lens)", () => {
  it("s cycles the sort, l toggles the lens (board mode)", () => {
    let state = handleKey(initialTuiState(), "s");
    expect(state.sort).toBe("priority");
    state = handleKey(state, "s");
    expect(state.sort).toBe("next");
    state = handleKey(state, "s");
    expect(state.sort).toBe("id");
    state = handleKey(state, "l");
    expect(state.readyOnly).toBe(true);
    state = handleKey(state, "l");
    expect(state.readyOnly).toBe(false);
  });

  it("s and l type into the search prompt like any other key", () => {
    let state = handleKey(initialTuiState(), "/");
    state = handleKey(state, "s");
    state = handleKey(state, "l");
    expect(state.searching).toBe(true);
    expect(state.filter).toBe("sl");
    expect(state.sort).toBe("id");
    expect(state.readyOnly).toBe(false);
  });
});

describe("runTuiBoard sort + lens keys (task-tui-sort-ready-lens)", () => {
  it("s and l repaint the board with the active sort and the ready lens", async () => {
    const root = newTree();
    writeItem(root, "tasks/launch/epic-a/story-login/task-p0.md", {
      type: "task",
      status: "todo",
      id: "task-p0",
      parent: "story-login",
      title: "Hot fix",
      priority: "p0",
    });
    const term = fakeTerminal();
    term.output.columns = 200;
    const done = runTuiBoard({ cwd: root, input: term.input, output: term.output });
    const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    await wait(30);
    term.input.write("s"); // sort: priority
    await wait(30);
    term.input.write("s"); // sort: next
    await wait(30);
    term.input.write("l"); // ready-only lens
    await wait(30);
    term.input.write("q");
    await done;
    const text = term.outputText();
    expect(text).toContain("sort: next");
    expect(text).toContain("ready-only");
    // Last frame: the lens keeps only pullable work — task-p0 and
    // task-rate-limit (todo, unclaimed, no open deps); the blocked bug, the
    // claimed story and the epic are gone. Under sort: next the p0 card
    // leads the todo column.
    const frames = text.split("\x1b[H\x1b[2J");
    const last = frames[frames.length - 1] ?? "";
    expect(last).toContain("> T task-p0 p0");
    expect(last.indexOf("task-p0")).toBeLessThan(last.indexOf("task-rate-limit"));
    expect(last).not.toContain("bug-login-500");
    expect(last).not.toContain("epic-a");
    expect(last).not.toContain("story-login");
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
    // bug-tui-split-escape-sequences: the lone ESC byte is held for the esc
    // flush window (in case a CSI continuation follows), then flushed as a
    // real Esc keypress — wait past the window so the board frame is drawn.
    await wait(150);
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

// ---------- action flows: claim + move (task-tui-actions-parity) ----------

const ACTION_ITEM = item({ id: "task-act", type: "task", status: "todo", title: "Action target" });

function actionState(overrides: Partial<TuiActionState> = {}): TuiActionState {
  return {
    id: "task-act",
    type: "task",
    from: "todo",
    claimedBy: null,
    claim: false,
    stage: "move",
    status: "todo",
    assignee: null,
    blockedReason: null,
    cursor: 0,
    draft: "",
    error: null,
    ...overrides,
  };
}

describe("tuiLegalMoves (task-tui-actions-parity)", () => {
  it("lists kernel-legal targets only, in status enum order", () => {
    expect(tuiLegalMoves({ id: "t", type: "task", status: "todo", assignee: null })).toEqual([
      "in_progress",
      "cancelled",
    ]);
    expect(
      tuiLegalMoves({ id: "t", type: "task", status: "in_progress", assignee: "mia" }),
    ).toEqual(["todo", "blocked", "done", "cancelled"]); // status enum order
    expect(tuiLegalMoves({ id: "t", type: "task", status: "done", assignee: null })).toEqual([
      "todo",
    ]);
  });
});

describe("handleKey claim flow (task-tui-actions-parity)", () => {
  it("c opens the assignee prompt prefilled with the resolved login", () => {
    const state = handleKey(initialTuiState(240, 8), "c", {
      selected: ACTION_ITEM,
      suggestedAssignee: "arggon",
    });
    expect(state.action).toEqual(
      actionState({
        claim: true,
        stage: "assignee",
        status: "in_progress",
        draft: "arggon",
      }),
    );
    // The prompt renders in the footer; the board stays behind it.
    const frame = lines(renderTui([ACTION_ITEM], state, { color: false }))[7];
    expect(frame).toContain("claim task-act: arggon█");
    expect(frame).toContain("enter to apply, esc cancels");
  });

  it("c refuses non-claimable types and claimed items (never steals)", () => {
    const epic = handleKey(initialTuiState(), "c", {
      selected: item({ id: "epic-a", type: "epic", status: "todo" }),
    });
    expect(epic.action).toBeNull();
    expect(epic.message).toContain("not claimable");
    const claimed = handleKey(initialTuiState(), "c", {
      selected: item({ id: "task-c", type: "task", status: "in_progress", assignee: "mia" }),
      suggestedAssignee: "arggon",
    });
    expect(claimed.action).toBeNull();
    expect(claimed.message).toContain("claim conflict");
    expect(claimed.message).toContain("claimed by 'mia'");
  });

  it("c without a selection messages instead of opening a flow", () => {
    const state = handleKey(initialTuiState(), "c", { selected: null });
    expect(state.action).toBeNull();
    expect(state.message).toBe("(no item selected)");
  });

  it("enter applies the prefill (or the typed login) and stages the write; esc cancels untouched", () => {
    let state = handleKey(initialTuiState(240, 8), "c", {
      selected: ACTION_ITEM,
      suggestedAssignee: "mia",
    });
    state = handleKey(state, "\r");
    expect(state.action?.stage).toBe("confirm");
    expect(state.action?.assignee).toBe("mia");
    // Anything but y cancels with nothing written.
    state = handleKey(state, "n");
    expect(state.action).toBeNull();
    // Typing extends the prefill; enter stages the typed login.
    state = handleKey(state, "c", { selected: ACTION_ITEM, suggestedAssignee: "mia" });
    state = handleKey(state, "K");
    expect(state.action?.draft).toBe("miaK");
    state = handleKey(state, "\r");
    expect(state.action?.assignee).toBe("miaK");
    // The confirm names the exact write.
    expect(lines(renderTui([ACTION_ITEM], state, { color: false }))[7]).toContain(
      "apply task-act: todo -> in_progress (assignee miaK)? y applies",
    );
  });
});

describe("handleKey move flow (task-tui-actions-parity)", () => {
  it("m opens the legal-target menu and a number selects", () => {
    let state = handleKey(initialTuiState(240, 8), "m", { selected: ACTION_ITEM });
    expect(state.action?.stage).toBe("move");
    // The menu lists only the legal targets (status enum order).
    expect(lines(renderTui([ACTION_ITEM], state, { color: false }))[7]).toContain(
      "move task-act (todo): [1] in_progress [2] cancelled",
    );
    state = handleKey(state, "1");
    // todo -> in_progress on an unclaimed claimable asks for the assignee.
    expect(state.action?.stage).toBe("assignee");
    state = handleKey(state, "\r"); // empty keeps the (absent) prefill -> no assignee? no: claimable requires one
    // An empty assignee on a claim flow leaves assignee null -> confirm shows it.
    expect(state.action?.stage).toBe("confirm");
    expect(state.action?.assignee).toBeNull();
  });

  it("a move to blocked demands a non-empty reason, inline", () => {
    let state = handleKey(initialTuiState(240, 8), "m", {
      selected: item({ id: "task-ip", type: "task", status: "in_progress", assignee: "mia" }),
    });
    state = handleKey(state, "2"); // blocked (enum order: todo, blocked, ...)
    expect(state.action?.stage).toBe("reason");
    state = handleKey(state, "\r"); // empty -> refused inline
    expect(state.action?.stage).toBe("reason");
    expect(state.action?.error).toContain("non-empty reason");
    state = handleKey(state, "w");
    state = handleKey(state, "a");
    state = handleKey(state, "i");
    state = handleKey(state, "t");
    expect(lines(renderTui([], state, { color: false }))[7]).toContain(
      "blocked reason for task-ip: wait█",
    );
    state = handleKey(state, "\r");
    expect(state.action?.stage).toBe("confirm");
    expect(state.action?.blockedReason).toBe("wait");
  });

  it("a container moves without the assignee prompt; y stages the apply", () => {
    let state = handleKey(initialTuiState(240, 8), "m", {
      selected: item({ id: "epic-a", type: "epic", status: "todo" }),
    });
    state = handleKey(state, "1"); // in_progress
    expect(state.action?.stage).toBe("confirm"); // no claim prompt for containers
    state = handleKey(state, "y");
    expect(state.action?.stage).toBe("apply");
    // The board reducer itself performs no IO: the loop executes the apply.
  });

  it("the flow is modal: board keys are inert and esc restores the board untouched", () => {
    const before = initialTuiState(80, 8);
    let state = handleKey(before, "m", { selected: ACTION_ITEM });
    state = handleKey(state, "s"); // ignored by the flow
    expect(state.sort).toBe("id");
    state = handleKey(state, "q"); // ignored by the flow (Ctrl-C is the quit)
    expect(state.quit).toBe(false);
    state = handleKey(state, "\x1b");
    expect(state.action).toBeNull();
    expect(state).toEqual(before);
  });

  it("m with no selection or no legal target messages", () => {
    const none = handleKey(initialTuiState(), "m", { selected: null });
    expect(none.message).toBe("(no item selected)");
    const done = handleKey(initialTuiState(), "m", {
      selected: item({ id: "task-d", type: "task", status: "done" }),
    });
    expect(done.action?.stage).toBe("move"); // done -> todo exists
    void done;
  });
});

describe("runTuiBoard action execution (task-tui-actions-parity)", () => {
  it("applies a confirmed move through the injected runUpdate and repaints", async () => {
    const root = newTree();
    const term = fakeTerminal();
    term.output.columns = 200;
    const updates: Array<{ id: string; status?: string; assignee?: string }> = [];
    const done = runTuiBoard({
      cwd: root,
      input: term.input,
      output: term.output,
      runUpdate: (opts) => {
        updates.push({ id: opts.id, status: opts.status, assignee: opts.assignee });
        return {
          id: opts.id,
          path: "x",
          root: "r",
          item: {} as never,
          changed: ["status"],
          autoCompleted: [],
          cascadeLevels: [],
          cascadeSkipped: [],
          changedPaths: [],
        };
      },
    });
    const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    await wait(30);
    term.input.write("m"); // move flow for the first card (task-rate-limit is not first; selection follows id order)
    await wait(30);
    term.input.write("2"); // second legal target: cancelled (no prompts)
    await wait(30);
    term.input.write("y"); // confirm -> the loop performs ONE runUpdate
    await wait(30);
    term.input.write("q");
    await done;
    expect(updates).toHaveLength(1);
    expect(updates[0]!.status).toBe("cancelled");
    expect(term.outputText()).toContain("-> cancelled");
  });

  it("surfaces a kernel refusal in the footer and keeps running (and quitting)", async () => {
    const root = newTree();
    const term = fakeTerminal();
    term.output.columns = 200;
    const done = runTuiBoard({
      cwd: root,
      input: term.input,
      output: term.output,
      runUpdate: () => {
        throw new Error("cannot transition status todo -> done (allowed: in_progress, cancelled)");
      },
    });
    const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    await wait(30);
    term.input.write("m");
    await wait(30);
    term.input.write("2"); // cancelled: a container's move needs no prompts
    await wait(30);
    term.input.write("y"); // confirm -> the loop's runUpdate throws
    await wait(30);
    term.input.write("q");
    await done;
    // The refusal is sanitized footer text; the loop survived to quit cleanly.
    expect(term.outputText()).toContain("cannot transition status todo -> done");
  });
});
// ---------- filter language + saved views (task-tui-filter-language) ----------

describe("tuiLensFilter + tuiViewItems saved views (task-tui-filter-language)", () => {
  const VIEWS_SET: WorkItem[] = [
    ...SORT_SET,
    item({ id: "story-e", type: "story", status: "in_progress", assignee: "kim" }),
  ];

  it("tuiLensFilter ANDs the active view expression with the manual filter", () => {
    expect(tuiLensFilter({ filter: "" })).toBe("");
    expect(tuiLensFilter({ filter: "alpha", view: null })).toBe("alpha");
    expect(tuiLensFilter({ filter: "  ", view: { name: "v", expr: "type:task" } })).toBe(
      "type:task",
    );
    expect(tuiLensFilter({ filter: "alpha", view: { name: "v", expr: "status:todo" } })).toBe(
      "status:todo alpha",
    );
  });

  it("the active view filters the cards through the kernel parser", () => {
    const view = tuiViewItems(VIEWS_SET, {
      filter: "",
      view: { name: "tasks", expr: "type:task" },
      sort: "id",
      readyOnly: false,
    });
    expect(view.map((i) => i.id)).toEqual(["alpha", "beta", "delta"]);
    // The view ANDs with the manual filter.
    const both = tuiViewItems(VIEWS_SET, {
      filter: "gam",
      view: { name: "bugs", expr: "type:bug" },
      sort: "id",
      readyOnly: false,
    });
    expect(both.map((i) => i.id)).toEqual(["gamma"]);
  });
});

describe("tuiViewOptions (task-tui-filter-language)", () => {
  it("loads x-views name-sorted, pre-validated against the loaded tree", () => {
    const root = newTree();
    writeFileSync(
      join(root, "tasks/.convention.yml"),
      'version: 0\nx-views:\n  open-bugs: "type:bug status:todo"\n  mine: "assignee:arggon"\n',
      "utf8",
    );
    const { items } = loadTuiItems(root);
    const options = tuiViewOptions(root, items);
    expect(options.map((o) => o.name)).toEqual(["mine", "open-bugs"]); // name-sorted cycle
    const bugs = options.find((o) => o.name === "open-bugs")!;
    expect(bugs.ok).toBe(true);
    expect(bugs.expr).toBe("type:bug status:todo");
    const mine = options.find((o) => o.name === "mine")!;
    expect(mine.ok).toBe(true); // story-login is claimed by arggon
  });

  it("an invalid view expression carries the kernel error instead of crashing", () => {
    const root = newTree();
    writeFileSync(
      join(root, "tasks/.convention.yml"),
      'version: 0\nx-views:\n  bad: "status:bogus"\n',
      "utf8",
    );
    const { items } = loadTuiItems(root);
    const options = tuiViewOptions(root, items);
    expect(options).toHaveLength(1);
    expect(options[0]!.ok).toBe(false);
    expect(options[0]!.error).toContain('unknown status "bogus"');
  });

  it("a missing or malformed convention degrades to no views", () => {
    const root = newTree();
    expect(tuiViewOptions(root, loadTuiItems(root).items)).toEqual([]);
    writeFileSync(
      join(root, "tasks/.convention.yml"),
      "version: 0\nx-views:\n  just-a-word\n",
      "utf8",
    );
    expect(tuiViewOptions(root, loadTuiItems(root).items)).toEqual([]);
  });
});

describe("handleKey saved views (task-tui-filter-language)", () => {
  const views = [
    { name: "a", expr: "type:task", ok: true },
    { name: "b", expr: "type:bug status:todo", ok: true },
    {
      name: "bad",
      expr: "status:nope",
      ok: false,
      error: 'unknown status "nope". Allowed: todo, in_progress, blocked, done, cancelled',
    },
  ];

  it("v cycles no view -> first -> last -> no view (valid views only)", () => {
    const valid = [views[0]!, views[1]!];
    let state = handleKey(initialTuiState(), "v", { views: valid });
    expect(state.view).toEqual({ name: "a", expr: "type:task" });
    expect(state.message).toBeNull();
    state = handleKey(state, "v", { views: valid });
    expect(state.view).toEqual({ name: "b", expr: "type:bug status:todo" });
    state = handleKey(state, "v", { views: valid });
    expect(state.view).toBeNull();
  });

  it("v with no saved views messages instead of crashing", () => {
    const state = handleKey(initialTuiState(), "v");
    expect(state.view).toBeNull();
    expect(state.message).toContain("no saved views");
  });

  it("an invalid view is refused with an inline hint, the previous lens stays", () => {
    let state = handleKey(initialTuiState(), "v", { views }); // a
    state = handleKey(state, "v", { views }); // b
    state = handleKey(state, "v", { views }); // bad -> refused
    expect(state.view).toEqual({ name: "b", expr: "type:bug status:todo" });
    expect(state.message).toContain("bad: unknown status");
    // Esc exits the (stuck) cycle and clears the lens.
    state = handleKey(state, "\x1b");
    expect(state.view).toBeNull();
    expect(state.message).toBeNull();
  });

  it("a stale active name (convention changed under it) cycles from the first view", () => {
    const state = { ...initialTuiState(), view: { name: "gone", expr: "type:task" } };
    const next = handleKey(state, "v", { views });
    expect(next.view).toEqual({ name: "a", expr: "type:task" });
  });

  it("v types into the search prompt like any other key", () => {
    let state = handleKey(initialTuiState(), "/");
    state = handleKey(state, "v");
    expect(state.searching).toBe(true);
    expect(state.filter).toBe("v");
    expect(state.view).toBeNull();
  });
});

describe("handleKey filter prompt verdict (task-tui-filter-language)", () => {
  it("enter with a refused draft stays at the prompt with the error inline", () => {
    let state = handleKey(initialTuiState(), "/");
    state = handleKey(state, "s");
    state = handleKey(state, "x");
    expect(state.filter).toBe("sx");
    state = handleKey(state, "\r", {
      filterVerdict: { ok: false, error: 'unknown filter field "x"' },
    });
    expect(state.searching).toBe(true); // stays at the prompt
    expect(state.filter).toBe("sx"); // draft kept for editing
    expect(state.filterError).toBe('unknown filter field "x"');
    // Editing the draft clears the stale error.
    state = handleKey(state, "\x7f");
    expect(state.filterError).toBeNull();
    expect(state.filter).toBe("s");
    // A passing verdict applies the draft.
    state = handleKey(state, "\r", { filterVerdict: { ok: true } });
    expect(state.searching).toBe(false);
    expect(state.filter).toBe("s");
    expect(state.filterError).toBeNull();
  });

  it("enter without a verdict applies the draft (pure-reducer path)", () => {
    let state = handleKey(initialTuiState(), "/");
    state = handleKey(state, "z");
    state = handleKey(state, "\r");
    expect(state.searching).toBe(false);
    expect(state.filter).toBe("z");
  });

  it("esc at the prompt cancels the draft and clears the filter and view", () => {
    let state: TuiState = {
      ...initialTuiState(),
      filter: "old",
      view: { name: "a", expr: "type:task" },
    };
    state = handleKey(state, "/");
    state = handleKey(state, "n");
    state = handleKey(state, "\x1b");
    expect(state.searching).toBe(false);
    expect(state.filter).toBe("");
    expect(state.view).toBeNull();
    expect(state.filterError).toBeNull();
  });

  it("esc on the board clears the filter and the view", () => {
    let state: TuiState = {
      ...initialTuiState(),
      filter: "old",
      view: { name: "a", expr: "type:task" },
    };
    state = handleKey(state, "\x1b");
    expect(state.filter).toBe("");
    expect(state.view).toBeNull();
  });
});

describe("renderTui saved view frame (task-tui-filter-language)", () => {
  it("the header names the active view with its expression and the cards follow it", () => {
    const state = {
      ...initialTuiState(200, 12),
      view: { name: "open-tasks", expr: "type:task status:todo" },
    };
    const got = lines(renderTui(THREE, state, { color: false }));
    expect(got[0]).toContain("view: open-tasks (type:task status:todo)");
    expect(got[1]).toContain("todo (1)");
    expect(got[1]).toContain("in_progress (0)");
    expect(got.join("\n")).toContain("task-alpha");
    expect(got.join("\n")).not.toContain("bug-beta");
    expect(got.join("\n")).not.toContain("story-gamma");
  });

  it("the footer carries the view, the filter and the matched totals", () => {
    const state = {
      ...initialTuiState(240, 12),
      filter: "alpha",
      view: { name: "tasks", expr: "type:task" },
    };
    const footer = lines(renderTui(THREE, state, { color: false }))[11];
    expect(footer).toContain("view: tasks");
    expect(footer).toContain("filter: alpha");
    expect(footer).toContain("1/3 match");
  });

  it("columns the lens empties render an (empty) mark under a 0 count", () => {
    const state = { ...initialTuiState(200, 12), filter: "alpha" };
    const got = lines(renderTui(THREE, state, { color: false }));
    expect(got[1]).toContain("in_progress (0)");
    expect(got[2]).toContain("(empty)");
    // With color the mark is dim-wrapped (still pre-padded to the column width).
    const colored = renderTui(THREE, state, { color: true });
    expect(colored).toContain("\x1b[2m  (empty)");
  });
});

describe("runTuiBoard saved views + filter verdict (task-tui-filter-language)", () => {
  it("v applies the saved view, the prompt refuses an invalid expression inline", async () => {
    const root = newTree();
    writeFileSync(
      join(root, "tasks/.convention.yml"),
      'version: 0\nx-views:\n  open-tasks: "type:task status:todo"\n',
      "utf8",
    );
    const term = fakeTerminal();
    term.output.columns = 200;
    const done = runTuiBoard({ cwd: root, input: term.input, output: term.output });
    const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    await wait(30);
    term.input.write("v"); // saved view on
    await wait(30);
    term.input.write("v"); // saved view off again
    await wait(30);
    term.input.write("/"); // prompt
    await wait(30);
    term.input.write("status:bogus");
    await wait(30);
    term.input.write("\r"); // refused inline
    await wait(60);
    term.input.write("\x1b"); // cancel (past the 50ms esc-flush)
    await wait(60);
    term.input.write("r"); // repaint the cleared board (the reducer stays pure)
    await wait(30);
    term.input.write("q");
    await done;
    const text = term.outputText();
    expect(text).toContain("view: open-tasks (type:task status:todo)");
    const frames = text.split("\x1b[H\x1b[2J");
    const viewFrame = frames.find((f) => f.includes("view: open-tasks")) ?? "";
    expect(viewFrame).toContain("(empty)"); // in_progress emptied by the view
    expect(viewFrame).toContain("T task-rate-limit");
    expect(viewFrame).not.toContain("S story-login");
    expect(viewFrame).toContain("1/6 match");
    // The invalid expression is refused at the prompt with the kernel's error.
    expect(text).toContain('unknown status "bogus"');
    const refusalFrame = frames.find((f) => f.includes('unknown status "bogus"')) ?? "";
    expect(refusalFrame).toContain("/status:bogus");
    // Esc cancelled the prompt: the last frame is the plain board, no lens.
    const last = frames[frames.length - 1] ?? "";
    expect(last).not.toContain("esc to cancel");
    expect(last).not.toContain("filter:");
    expect(last).not.toContain("view: open-tasks");
  });
});
