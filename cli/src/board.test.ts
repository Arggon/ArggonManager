import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { displayPath, escapeHtml, renderBoardHtml, runBoard } from "./board.js";
import type { WorkItem } from "./types.js";

const GENERATED_AT = "2026-09-07T00:00:00.000Z";

function item(overrides: Partial<WorkItem> & Pick<WorkItem, "id" | "type" | "status">): WorkItem {
  return {
    title: null,
    assignee: null,
    parent: null,
    labels: [],
    created: "2026-09-07",
    updated: "2026-09-07",
    path: `tasks/x/${overrides.id}.md`,
    blocked_reason: null,
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes markup-significant characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert('&')">'`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;&amp;&#39;)&quot;&gt;&#39;",
    );
  });
});

describe("renderBoardHtml", () => {
  it("renders one column per v0 status in enum order, even when empty", () => {
    const html = renderBoardHtml([], { generatedAt: GENERATED_AT });
    const positions = ["todo", "in_progress", "blocked", "done", "cancelled"].map((status) =>
      html.indexOf(`data-status="${status}"`),
    );
    expect(positions.every((pos) => pos >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain("0 item(s)");
  });

  it("renders statuses/types, title fallback, assignee, labels, parent and blocked reason", () => {
    const html = renderBoardHtml(
      [
        item({
          id: "task-a",
          type: "task",
          status: "in_progress",
          title: "Add rate limiting",
          assignee: "arggon",
          parent: "story-login",
          labels: ["security"],
        }),
        item({
          id: "bug-b",
          type: "bug",
          status: "blocked",
          parent: "story-login",
          blocked_reason: "Waiting on OAuth credentials",
        }),
        item({ id: "epic-c", type: "epic", status: "done" }),
        item({ id: "init-d", type: "initiative", status: "todo" }),
        item({ id: "story-e", type: "story", status: "cancelled" }),
      ],
      { generatedAt: GENERATED_AT, repoName: "demo" },
    );
    expect(html).toContain("arggon board — demo");
    expect(html).toContain("Add rate limiting");
    expect(html).toContain("@arggon");
    expect(html).toContain('data-type="task"');
    expect(html).toContain('data-type="bug"');
    expect(html).toContain('data-type="initiative"');
    expect(html).toContain('data-type="epic"');
    expect(html).toContain('data-type="story"');
    expect(html).toContain("story-login");
    expect(html).toContain("security");
    expect(html).toContain("Waiting on OAuth credentials");
    expect(html).toContain("unassigned");
    expect(html).not.toContain("rollup");
  });

  it("escapes hostile frontmatter values", () => {
    const html = renderBoardHtml(
      [
        item({
          id: "task-x",
          type: "task",
          status: "todo",
          title: "<script>alert(1)</script>",
          assignee: "we",
        }),
      ],
      { generatedAt: GENERATED_AT },
    );
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("orders cards lexicographically by id within a column", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-b", type: "task", status: "todo" }),
        item({ id: "task-a", type: "task", status: "todo" }),
      ],
      { generatedAt: GENERATED_AT },
    );
    expect(html.indexOf("task-a")).toBeLessThan(html.indexOf("task-b"));
  });
});

describe("runBoard", () => {
  it("writes a self-contained HTML board and reports the item count", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 0\n");
    const result = runBoard({ cwd: dir, out: "out.html", generatedAt: GENERATED_AT });
    expect(result.outPath).toBe(join(dir, "out.html"));
    expect(result.itemCount).toBe(0);
    expect(existsSync(result.outPath)).toBe(true);
    const html = readFileSync(result.outPath, "utf8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain(GENERATED_AT);
  });

  it("defaults the output to board.html at the repo root when cwd is a subdirectory", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-root-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 0\n");
    const sub = join(dir, "a", "b");
    mkdirSync(sub, { recursive: true });
    const result = runBoard({ cwd: sub, generatedAt: GENERATED_AT });
    expect(result.root).toBe(dir);
    expect(result.outPath).toBe(join(dir, "board.html"));
    expect(existsSync(result.outPath)).toBe(true);
  });
});

describe("displayPath", () => {
  it("returns a posix relative path inside cwd and absolute outside", () => {
    expect(displayPath("/tmp/repo/board.html", "/tmp/repo")).toBe("board.html");
    expect(displayPath("/tmp/other/board.html", "/tmp/repo")).toBe("/tmp/other/board.html");
  });
});
