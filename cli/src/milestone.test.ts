/**
 * Milestone prototype tests (story-milestones, ADR 0003).
 *
 * The `milestone` key is forward-declared: it loads through the kernel,
 * round-trips, and does not raise UNKNOWN_KEY warnings in v0 trees. The
 * board groups by it behind the opt-in `--group-by milestone` flag;
 * ungrouped rendering stays byte-identical to the pre-prototype output.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runBoard, renderBoardHtml } from "./board.js";
import { toContractWorkItem } from "./contract.js";
import { runCreate } from "./create.js";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { softTryLoadItem } from "./items.js";
import { runValidate } from "./validate.js";

const GENERATED_AT = "2026-09-11T00:00:00.000Z";

function primedTree(): {
  dir: string;
  taskPaths: { a: string; b: string; c: string };
  storyPath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "arggon-milestone-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP" });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp" });
  const story = runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login" });
  const taskA = runCreate({ cwd: dir, type: "task", title: "First", parent: "story-login", id: "task-a" });
  const taskB = runCreate({ cwd: dir, type: "task", title: "Second", parent: "story-login", id: "task-b" });
  const taskC = runCreate({ cwd: dir, type: "task", title: "Third", parent: "story-login", id: "task-c" });
  return {
    dir,
    taskPaths: { a: taskA.path, b: taskB.path, c: taskC.path },
    storyPath: story.path,
  };
}

/** Set frontmatter keys on an item file via the real parser/serializer. */
function setFrontmatter(path: string, keys: Record<string, string>): void {
  const { data, body } = parseFrontmatter(readFileSync(path, "utf8"));
  for (const [k, v] of Object.entries(keys)) data[k] = v;
  writeFileSync(path, stringifyFrontmatter(data, body), "utf8");
}

describe("milestone kernel read path", () => {
  it("loads milestone and does not flag it as an unknown key", () => {
    const { taskPaths } = primedTree();
    setFrontmatter(taskPaths.a, { milestone: "2026-12-31", custom: "x" });
    const loaded = softTryLoadItem(taskPaths.a);
    expect(loaded.kind).toBe("item");
    if (loaded.kind !== "item") return;
    expect(loaded.item.milestone).toBe("2026-12-31");
    expect(loaded.unknownKeys).toEqual(["custom"]);
  });

  it("keeps a v0 tree valid with milestone keys (no UNKNOWN_KEY warning)", () => {
    const { dir, taskPaths, storyPath } = primedTree();
    setFrontmatter(taskPaths.a, { milestone: "2026-12-31" });
    setFrontmatter(storyPath, { milestone: "2027-01-15" });
    const result = runValidate({ cwd: dir });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("validates the same tree without milestones (unchanged)", () => {
    const { dir } = primedTree();
    const result = runValidate({ cwd: dir });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("maps milestone through the contract item", () => {
    const { dir, taskPaths } = primedTree();
    setFrontmatter(taskPaths.a, { milestone: "2026-12-31" });
    const loaded = softTryLoadItem(taskPaths.a);
    if (loaded.kind !== "item") throw new Error("expected item");
    expect(toContractWorkItem(loaded.item, dir).milestone).toBe("2026-12-31");
  });
});

const BARE = (id: string) => ({
  id,
  type: "task" as const,
  status: "todo" as const,
  title: id,
  assignee: null,
  branch: null,
  parent: null,
  labels: [],
  created: "2026-09-11",
  updated: "2026-09-11",
  path: `tasks/x/${id}.md`,
  blocked_reason: null,
  milestone: null,
  depends_on: [],
  claimed_at: null,
});

describe("board milestone grouping", () => {
  const dated = (id: string, milestone: string) => ({ ...BARE(id), milestone });

  it("groups by milestone ascending and puts no-milestone items last", () => {
    const html = renderBoardHtml(
      [
        dated("task-late", "2027-01-15"),
        BARE("task-bare"),
        dated("task-soon", "2026-11-01"),
        dated("task-mid", "2026-12-31"),
      ],
      { generatedAt: GENERATED_AT, groupBy: "milestone" },
    );
    const todoColumn = html.slice(html.indexOf('data-status="todo"'), html.indexOf('data-status="in_progress"'));
    const order = ["task-soon", "task-mid", "task-late", "task-bare"].map((id) => todoColumn.indexOf(id));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(todoColumn).toContain("no milestone");
    expect(todoColumn).toContain("⚑ 2026-11-01");
  });

  it("renders a milestone-less column without a no-milestone header", () => {
    const html = renderBoardHtml([BARE("task-a")], {
      generatedAt: GENERATED_AT,
      groupBy: "milestone",
    });
    expect(html).not.toContain('<div class="mgroup-head');
    expect(html).toContain("task-a");
  });

  it("renders no group headers without the flag (default board unchanged)", () => {
    const html = renderBoardHtml([dated("task-a", "2026-12-31")], {
      generatedAt: GENERATED_AT,
    });
    expect(html).not.toContain('<div class="mgroup-head');
    // The milestone chip still shows on the card itself.
    expect(html).toContain("⚑ 2026-12-31");
  });

  it("escapes hostile milestone values", () => {
    const html = renderBoardHtml([dated("task-x", '"><script>')], {
      generatedAt: GENERATED_AT,
      groupBy: "milestone",
    });
    expect(html).not.toContain('"><script>');
    expect(html).toContain("⚑ &quot;&gt;&lt;script&gt;");
  });
});

describe("runBoard --group-by", () => {
  it("rejects unsupported group-by fields", () => {
    const { dir } = primedTree();
    expect(() => runBoard({ cwd: dir, generatedAt: GENERATED_AT, groupBy: "priority" })).toThrow(
      /unknown --group-by field 'priority' \(supported: milestone\)/,
    );
  });

  it("writes a grouped self-contained board and reports the groupBy field", () => {
    const { dir, taskPaths } = primedTree();
    setFrontmatter(taskPaths.a, { milestone: "2026-12-31" });
    const result = runBoard({
      cwd: dir,
      out: join(dir, "board.html"),
      generatedAt: GENERATED_AT,
      groupBy: "milestone",
    });
    expect(result.groupBy).toBe("milestone");
    const html = readFileSync(result.outPath, "utf8");
    expect(html).toContain('<div class="mgroup-head');
    expect(html).toContain("<!doctype html>");
    expect(html).not.toContain("src=");
    expect(html).not.toContain("href=\"http");
  });
});
