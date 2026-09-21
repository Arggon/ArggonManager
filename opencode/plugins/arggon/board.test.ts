/**
 * W5 task-native-tui: the board/status data path is display-only and
 * kernel-backed. These tests exercise it against a real tracker fixture
 * (v5 `ArggonManager/` layout) without any OpenCode runtime: snapshot reading,
 * readiness/dependency marks, the deterministic tree flattening, the plain-text
 * panel/sidebar renderers and the active-item correlation. The TUI wiring
 * (slots/commands/panel) is covered by `tui.test.ts`; the real runtime load is
 * covered by `npm run smoke:tui` (PTY) and the manual checklist in
 * `ArggonManager/docs/opencode2.md`.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ARGON_BOARD_PANEL,
  activeBoardId,
  boardCountsLine,
  boardHeaderLine,
  boardItemLine,
  boardRoot,
  boardSnapshot,
  boardTreeEntries,
  boardTreeLines,
  clipBoardLine,
  sidebarStatusLine,
  type BoardItem,
  type BoardSnapshot,
} from "./board.js";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function write(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

function item(id: string, fields: Record<string, string>, title: string): string {
  const frontmatter = Object.entries({ type: "task", status: "todo", id, title, ...fields })
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return `---\n${frontmatter}\n---\n\n# ${title}\n`;
}

/**
 * Fixture tree (v5 layout):
 *   launch (initiative)
 *   └─ core (epic)
 *      └─ story-a (story)
 *         ├─ bug-three (bug, in_progress @Arggon)
 *         ├─ task-one (todo, ready)
 *         └─ task-two (todo, depends_on task-one → open dep)
 */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-board-"));
  tmpDirs.push(root);
  write(root, "ArggonManager/.convention.yml", "version: 5\n");
  write(root, "ArggonManager/README.md", "# Not a work item\n");
  const base = "ArggonManager/arggon-manager";
  write(
    root,
    `${base}/launch/launch.md`,
    item("launch", { type: "initiative", status: "in_progress", parent: "" }, "Launch"),
  );
  write(
    root,
    `${base}/launch/core/core.md`,
    item("core", { type: "epic", parent: "launch" }, "Core"),
  );
  write(
    root,
    `${base}/launch/core/story-a/story-a.md`,
    item("story-a", { type: "story", parent: "core" }, "Story A"),
  );
  write(
    root,
    `${base}/launch/core/story-a/task-one.md`,
    item("task-one", { parent: "story-a", priority: "p1" }, "First task"),
  );
  write(
    root,
    `${base}/launch/core/story-a/task-two.md`,
    item("task-two", { parent: "story-a", depends_on: "[task-one]" }, "Second task"),
  );
  write(
    root,
    `${base}/launch/core/story-a/bug-three.md`,
    item(
      "bug-three",
      { type: "bug", status: "in_progress", parent: "story-a", assignee: "Arggon" },
      "Open bug",
    ),
  );
  return root;
}

describe("board snapshot (kernel-backed, display-only)", () => {
  it("reads the tree, counts, readiness and the kernel next suggestion", () => {
    const root = fixture();
    const snapshot = boardSnapshot(root);

    expect(snapshot.error).toBeNull();
    expect(snapshot.root).toBe(root);
    expect(snapshot.items.map((entry) => entry.id)).toEqual([
      "bug-three",
      "core",
      "launch",
      "story-a",
      "task-one",
      "task-two",
    ]);
    expect(snapshot.counts).toEqual({
      todo: 4,
      in_progress: 2,
      blocked: 0,
      done: 0,
      cancelled: 0,
    });
    // Kernel readiness: task-two waits for task-one; task-one is ready.
    expect(snapshot.items.find((entry) => entry.id === "task-two")?.openDeps).toEqual(["task-one"]);
    expect(snapshot.items.find((entry) => entry.id === "task-one")?.openDeps).toEqual([]);
    // Kernel next ranking (priority-major, downstream weight, id): task-one.
    expect(snapshot.nextId).toBe("task-one");
    expect(snapshot.activeId).toBeNull();
  });

  it("resolves the active item from ARGON_ITEM, then the convention branch", () => {
    const root = fixture();
    const fromEnv = boardSnapshot(root, { envItem: "story-a" });
    expect(fromEnv.activeId).toBe("story-a");
    expect(fromEnv.items.find((entry) => entry.id === "story-a")?.active).toBe(true);

    const fromBranch = boardSnapshot(root, { branch: "feat/task-two" });
    expect(fromBranch.activeId).toBe("task-two");
    const other = boardSnapshot(root, { branch: "feat/task-does-not-exist" });
    expect(other.activeId).toBeNull();
  });

  it("degrades to an error snapshot when there is no tracker (never throws)", () => {
    const empty = mkdtempSync(join(tmpdir(), "arggon-board-empty-"));
    tmpDirs.push(empty);
    expect(boardRoot(empty)).toBeNull();
    const snapshot = boardSnapshot(empty);
    expect(snapshot.root).toBeNull();
    expect(snapshot.items).toEqual([]);
    expect(snapshot.error).toContain("no ArggonManager tracker");
    expect(boardTreeLines(snapshot)).toEqual([
      "arggon board · no ArggonManager tracker found here",
    ]);
    expect(sidebarStatusLine(snapshot)).toBe("arggon · no tracker");
  });

  it("never writes to the tracker (pure read)", () => {
    const root = fixture();
    const before = readdirSync(join(root, "ArggonManager"), { recursive: true }).sort();
    const bytes = readdirSync(join(root, "ArggonManager"), { recursive: true })
      .filter((entry) => String(entry).endsWith(".md"))
      .map((entry) => readFileSync(join(root, "ArggonManager", String(entry)), "utf8"));
    boardSnapshot(root, { branch: "feat/task-one" });
    expect(readdirSync(join(root, "ArggonManager"), { recursive: true }).sort()).toEqual(before);
    expect(
      readdirSync(join(root, "ArggonManager"), { recursive: true })
        .filter((entry) => String(entry).endsWith(".md"))
        .map((entry) => readFileSync(join(root, "ArggonManager", String(entry)), "utf8")),
    ).toEqual(bytes);
  });
});

describe("board tree flattening", () => {
  it("is depth-first, id-sorted and cycle-safe", () => {
    const root = fixture();
    const snapshot = boardSnapshot(root);
    expect(boardTreeEntries(snapshot.items).map((entry) => [entry.item.id, entry.depth])).toEqual([
      ["launch", 0],
      ["core", 1],
      ["story-a", 2],
      ["bug-three", 3],
      ["task-one", 3],
      ["task-two", 3],
    ]);
  });

  it("renders orphans as roots and tolerates cycles", () => {
    const items: BoardItem[] = [
      boardItem("b", { parent: "missing" }),
      boardItem("a", { parent: "b" }),
      boardItem("cycle-1", { parent: "cycle-2" }),
      boardItem("cycle-2", { parent: "cycle-1" }),
    ];
    expect(boardTreeEntries(items).map((entry) => entry.item.id)).toEqual([
      "b",
      "a",
      "cycle-1",
      "cycle-2",
    ]);
  });
});

function boardItem(id: string, overrides: Partial<BoardItem> = {}): BoardItem {
  return {
    id,
    type: "task",
    title: `Title ${id}`,
    status: "todo",
    parent: null,
    assignee: null,
    priority: null,
    blockedReason: null,
    dependsOn: [],
    openDeps: [],
    active: false,
    ...overrides,
  };
}

describe("board text renderers", () => {
  it("renders header, counters and indented tree lines", () => {
    const root = fixture();
    const snapshot = boardSnapshot(root, { branch: "feat/task-one" });
    const lines = boardTreeLines(snapshot);
    expect(lines[0]).toBe("arggon board · 6 item(s) · next: task-one");
    expect(lines[1]).toBe("todo 4 · in_progress 2 · blocked 0 · done 0 · cancelled 0");
    expect(lines[2]).toContain("I launch");
    expect(lines[3]).toContain("· E core");
    expect(lines[4]).toContain("· S story-a");
    expect(lines[5]).toContain("▸ B bug-three @Arggon — Open bug");
    // Active marker + open dependency mark (⌫task-one).
    const taskTwo = lines.find((line) => line.includes("task-two")) ?? "";
    expect(taskTwo).toContain("⌫task-one");
    const taskOne = lines.find((line) => line.includes("T task-one")) ?? "";
    expect(taskOne.startsWith("      ▶· T task-one")).toBe(true);
  });

  it("clips to the panel width and bounds the visible tree", () => {
    const root = fixture();
    const snapshot = boardSnapshot(root);
    const clipped = boardTreeLines(snapshot, { width: 24 });
    for (const line of clipped) expect(line.length).toBeLessThanOrEqual(24);
    const limited = boardTreeLines(snapshot, { limit: 2 });
    expect(limited).toHaveLength(5); // header + counters + 2 entries + remainder
    expect(limited[4]).toBe("… 4 more item(s)");
    expect(clipBoardLine("abcdef", 3)).toBe("ab…");
    expect(clipBoardLine("abc", 3)).toBe("abc");
    expect(clipBoardLine("abc", 0)).toBe("");
  });

  it("escapes repo-controlled bytes on every line", () => {
    const hostile = boardItem("task-\u001b[31mred\nnext", {
      title: "boom\u001b]0;pwn\u0007",
      assignee: "a\u001b[0m",
      openDeps: ["dep\u001b[2m"],
    });
    const line = boardItemLine({ item: hostile, depth: 0 });
    expect(line).not.toContain("\u001b");
    expect(line).not.toContain("\n");
    expect(line).toContain("task-\\u001b[31mred\\u000anext");
    expect(boardHeaderLine(hostileSnapshot())).not.toContain("\u001b");
  });

  function hostileSnapshot(): BoardSnapshot {
    return {
      root: "/tmp/x",
      items: [],
      counts: { todo: 0, in_progress: 0, blocked: 0, done: 0, cancelled: 0 },
      activeId: null,
      nextId: "task-\u001b[1mbad",
      error: null,
    };
  }

  it("summarizes the sidebar from the active item or the ready count", () => {
    const root = fixture();
    expect(sidebarStatusLine(boardSnapshot(root))).toBe("arggon · 1 ready · next task-one");
    expect(sidebarStatusLine(boardSnapshot(root, { branch: "feat/bug-three" }))).toBe(
      "arggon ▶ bug-three in_progress",
    );
    expect(boardCountsLine(boardSnapshot(root))).toContain("todo 4");
    expect(ARGON_BOARD_PANEL).toBe("arggon.board");
  });

  it("resolves active ids purely (env wins, unknown ids never resolve)", () => {
    const items = [boardItem("task-a"), boardItem("bug-b")];
    expect(activeBoardId(items)).toBeNull();
    expect(activeBoardId(items, { branch: "feat/task-a" })).toBe("task-a");
    expect(activeBoardId(items, { branch: "fix/bug-b" })).toBe("bug-b");
    expect(activeBoardId(items, { branch: "chore/task-a" })).toBeNull();
    expect(activeBoardId(items, { branch: "feat/ghost" })).toBeNull();
    expect(activeBoardId(items, { branch: "feat/ghost", envItem: "bug-b" })).toBe("bug-b");
    expect(activeBoardId(items, { branch: "feat/task-a", envItem: "ghost" })).toBe("task-a");
  });
});
