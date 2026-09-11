import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  displayPath,
  escapeHtml,
  evaluateDrop,
  renderBoardHtml,
  runBoard,
  summarizeChecks,
} from "./board.js";
import type { BoardGithub, PrInfo } from "./board.js";
import type { WorkItem } from "./types.js";

const GENERATED_AT = "2026-09-07T00:00:00.000Z";

function item(overrides: Partial<WorkItem> & Pick<WorkItem, "id" | "type" | "status">): WorkItem {
  return {
    title: null,
    assignee: null,
    branch: null,
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

  it("renders a branch badge when set and none otherwise", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-a", type: "task", status: "in_progress", branch: "feat/task-a" }),
        item({ id: "task-b", type: "task", status: "todo" }),
      ],
      { generatedAt: GENERATED_AT },
    );
    expect(html).toContain("⑂ feat/task-a");
    expect(html).not.toContain("⑂ -");
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

describe("evaluateDrop", () => {
  const card = (overrides: Partial<Parameters<typeof evaluateDrop>[0]> = {}) => ({
    id: "task-a",
    type: "task",
    status: "todo",
    assignee: null as string | null,
    ...overrides,
  });

  it("allows transitions the CLI update path allows", () => {
    expect(evaluateDrop(card({ assignee: "arggon" }), "in_progress")).toEqual({
      ok: true,
      reason: "",
    });
    expect(evaluateDrop(card(), "cancelled")).toEqual({ ok: true, reason: "" });
    expect(evaluateDrop(card({ status: "in_progress", assignee: "arggon" }), "done")).toEqual({
      ok: true,
      reason: "",
    });
    expect(evaluateDrop(card({ status: "done" }), "todo")).toEqual({ ok: true, reason: "" });
    expect(evaluateDrop(card({ status: "cancelled" }), "todo")).toEqual({
      ok: true,
      reason: "",
    });
  });

  it("refuses illegal transitions with the CLI rule message", () => {
    expect(evaluateDrop(card(), "done")).toEqual({
      ok: false,
      reason: "cannot transition todo -> done (allowed: in_progress, cancelled)",
    });
    expect(evaluateDrop(card({ status: "blocked" }), "done")).toEqual({
      ok: false,
      reason: "cannot transition blocked -> done (allowed: in_progress, cancelled)",
    });
  });

  it("refuses drops into the card's own column", () => {
    expect(evaluateDrop(card(), "todo")).toEqual({
      ok: false,
      reason: "task-a is already in that column",
    });
  });

  it("enforces the claim rule on claimable types but not containers", () => {
    expect(evaluateDrop(card({ type: "story" }), "in_progress")).toEqual({
      ok: false,
      reason:
        "story 'task-a' with status in_progress requires --assignee (claim first: arggon update task-a --assignee <login>)",
    });
    expect(evaluateDrop(card({ assignee: "arggon" }), "in_progress")).toEqual({
      ok: true,
      reason: "",
    });
    expect(evaluateDrop(card({ type: "epic" }), "in_progress")).toEqual({
      ok: true,
      reason: "",
    });
    expect(evaluateDrop(card({ type: "initiative" }), "in_progress")).toEqual({
      ok: true,
      reason: "",
    });
  });

  it("lets blocked through (the reason prompt is drop-flow UI) and refuses unknown statuses", () => {
    expect(evaluateDrop(card({ status: "in_progress", assignee: "arggon" }), "blocked")).toEqual({
      ok: true,
      reason: "",
    });
    expect(evaluateDrop(card({ status: "archived" }), "todo").ok).toBe(false);
  });

  it("rejects reassignment of a claimed item with the CLI claim-conflict message", () => {
    const claimed = { status: "in_progress", assignee: "alice" };
    expect(evaluateDrop(card(claimed), "blocked", { assignee: "bob" })).toEqual({
      ok: false,
      reason:
        "claim conflict: 'task-a' is claimed by 'alice' (status in_progress). " +
        "Unclaim first (arggon update task-a --status todo) or coordinate.",
    });
  });

  it("refuses force on the board route, even smuggled past a claim conflict", () => {
    expect(evaluateDrop(card(), "in_progress", { assignee: "bob", force: true })).toEqual({
      ok: false,
      reason: "--force is CLI-only: board edits route through the update path without force",
    });
    const claimed = { status: "in_progress", assignee: "alice" };
    const smuggled = evaluateDrop(card(claimed), "blocked", { assignee: "bob", force: true });
    expect(smuggled.ok).toBe(false);
    expect(smuggled.reason).toContain("is CLI-only");
  });

  it("allows claiming via the board by passing the prompted assignee", () => {
    expect(evaluateDrop(card(), "in_progress", { assignee: "bob" })).toEqual({
      ok: true,
      reason: "",
    });
    expect(evaluateDrop(card({ type: "epic" }), "in_progress", { assignee: null })).toEqual({
      ok: true,
      reason: "",
    });
    expect(evaluateDrop(card({ type: "story" }), "in_progress", { assignee: null }).ok).toBe(false);
  });
});

describe("renderBoardHtml drag-and-drop", () => {
  it("marks cards draggable with id/type/status/assignee data attributes", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-a", type: "task", status: "in_progress", assignee: "arggon" }),
        item({ id: "task-b", type: "task", status: "todo" }),
      ],
      { generatedAt: GENERATED_AT },
    );
    expect(html).toContain(
      '<div class="card" draggable="true" data-id="task-a" data-type="task" data-status="in_progress" data-assignee="arggon">',
    );
    expect(html).toContain(
      '<div class="card" draggable="true" data-id="task-b" data-type="task" data-status="todo">',
    );
    expect(html).not.toContain('data-status="todo" data-assignee');
  });

  it("embeds the drop rules and update endpoint in the page script", () => {
    const html = renderBoardHtml([item({ id: "task-a", type: "task", status: "todo" })], {
      generatedAt: GENERATED_AT,
    });
    expect(html).toContain("<script>");
    expect(html).toContain(evaluateDrop.toString());
    expect(html).toContain('"/api/update"');
    expect(html).toContain("blocked_reason");
    expect(html).toContain('id="board-toast"');
  });

  it("wires the claim prompt into the drop flow and never sends force", () => {
    const html = renderBoardHtml([item({ id: "task-a", type: "task", status: "todo" })], {
      generatedAt: GENERATED_AT,
    });
    expect(html).toContain("--assignee required to claim ");
    expect(html).toContain("body.assignee = edit.assignee;");
    expect(html).not.toMatch(/body\.force/);
    expect(html).toContain("requires --assignee");
  });

  it("keeps counts re-computable by tagging the meta counts span", () => {
    const html = renderBoardHtml([item({ id: "task-a", type: "task", status: "todo" })], {
      generatedAt: GENERATED_AT,
    });
    expect(html).toContain(
      '<span id="status-counts">todo: 1 · in_progress: 0 · blocked: 0 · done: 0 · cancelled: 0</span>',
    );
  });
});

describe("displayPath", () => {
  it("returns a posix relative path inside cwd and absolute outside", () => {
    expect(displayPath("/tmp/repo/board.html", "/tmp/repo")).toBe("board.html");
    expect(displayPath("/tmp/other/board.html", "/tmp/repo")).toBe("/tmp/other/board.html");
  });
});

function pr(overrides: Partial<PrInfo> & Pick<PrInfo, "branch" | "number">): PrInfo {
  return {
    url: `https://github.com/o/r/pull/${overrides.number}`,
    state: "OPEN",
    isDraft: false,
    checks: "unknown",
    ...overrides,
  };
}

describe("summarizeChecks", () => {
  it("aggregates statusCheckRollup into passing/failing/pending/unknown", () => {
    expect(summarizeChecks([])).toBe("unknown");
    expect(
      summarizeChecks([
        { status: "COMPLETED", conclusion: "SUCCESS" },
        { status: "COMPLETED", conclusion: "SKIPPED" },
      ]),
    ).toBe("passing");
    expect(summarizeChecks([{ status: "COMPLETED", conclusion: "FAILURE" }])).toBe("failing");
    expect(summarizeChecks([{ status: "COMPLETED", conclusion: "TIMED_OUT" }])).toBe("failing");
    expect(summarizeChecks([{ status: "IN_PROGRESS", conclusion: null }])).toBe("pending");
    expect(summarizeChecks([{ status: "COMPLETED", conclusion: null }])).toBe("pending");
  });
});

describe("renderBoardHtml github overlay", () => {
  it("badges draft/ready/merged PRs and neutral for missing branch or no PR", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-d", type: "task", status: "in_progress", branch: "feat/task-d" }),
        item({ id: "task-o", type: "task", status: "in_progress", branch: "feat/task-o" }),
        item({ id: "task-m", type: "task", status: "done", branch: "feat/task-m" }),
        item({ id: "task-n", type: "task", status: "todo", branch: "feat/task-n" }),
        item({ id: "task-b", type: "task", status: "todo" }),
      ],
      {
        generatedAt: GENERATED_AT,
        live: true,
        prs: new Map([
          ["feat/task-d", pr({ branch: "feat/task-d", number: 12, isDraft: true })],
          ["feat/task-o", pr({ branch: "feat/task-o", number: 34, checks: "passing" })],
          ["feat/task-m", pr({ branch: "feat/task-m", number: 56, state: "MERGED" })],
        ]),
      },
    );
    expect(html).toContain("#12 · draft");
    expect(html).toContain("#34 · open · ✓");
    expect(html).toContain("#56 · merged");
    expect(html).toContain("live GitHub overlay (3 PR(s))");
    // Branch without a matching PR and card without branch: neutral badge, twice.
    expect(html.match(/○ no PR/g)?.length).toBe(2);
  });

  it("renders failing and pending checks markers", () => {
    const html = renderBoardHtml(
      [item({ id: "task-a", type: "task", status: "todo", branch: "feat/a" })],
      {
        generatedAt: GENERATED_AT,
        live: true,
        prs: new Map([["feat/a", pr({ branch: "feat/a", number: 7, checks: "failing" })]]),
      },
    );
    expect(html).toContain("#7 · open · ✗");
  });

  it("stays badge-free without the live overlay (offline snapshot)", () => {
    const html = renderBoardHtml(
      [item({ id: "task-a", type: "task", status: "todo", branch: "feat/a" })],
      { generatedAt: GENERATED_AT },
    );
    expect(html).not.toContain('class="pr');
    expect(html).not.toContain("no PR");
  });
});

function writeBranchedTree(dir: string): { taskMd: string; conventionYml: string } {
  mkdirSync(join(dir, "tasks/launch/auth/story-a"), { recursive: true });
  writeFileSync(join(dir, "tasks/.convention.yml"), "version: 1\n");
  writeFileSync(
    join(dir, "tasks/launch/launch.md"),
    '---\ntype: initiative\nstatus: todo\nid: launch\ntitle: Launch\nlabels: []\ncreated: "2026-09-07"\nupdated: "2026-09-07"\n---\n\n# Launch\n',
  );
  writeFileSync(
    join(dir, "tasks/launch/auth/story-a/story-a.md"),
    '---\ntype: story\nstatus: in_progress\nid: story-a\nparent: launch\nlabels: []\ncreated: "2026-09-07"\nupdated: "2026-09-07"\n---\n\n# Story A\n',
  );
  const taskMd = join(dir, "tasks/launch/auth/story-a/task-one.md");
  writeFileSync(
    taskMd,
    '---\ntype: task\nstatus: in_progress\nid: task-one\nparent: story-a\nbranch: feat/task-one\nlabels: []\ncreated: "2026-09-07"\nupdated: "2026-09-07"\n---\n\n# Task One\n',
  );
  return { taskMd, conventionYml: join(dir, "tasks/.convention.yml") };
}

describe("runBoard github overlay", () => {
  it("links branches to PRs and never writes to tasks/", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-gh-"));
    const { taskMd, conventionYml } = writeBranchedTree(dir);
    const beforeTask = readFileSync(taskMd, "utf8");
    const beforeConvention = readFileSync(conventionYml, "utf8");
    const seen: string[] = [];
    const gh: BoardGithub = {
      listPrs: (cwd: string) => {
        seen.push(cwd);
        return [pr({ branch: "feat/task-one", number: 42 })];
      },
    };
    const result = runBoard({
      cwd: dir,
      out: "out.html",
      generatedAt: GENERATED_AT,
      github: true,
      gh,
    });
    expect(result.prCount).toBe(1);
    expect(seen).toEqual([dir]);
    const html = readFileSync(result.outPath, "utf8");
    expect(html).toContain("#42 · open");
    expect(readFileSync(taskMd, "utf8")).toBe(beforeTask);
    expect(readFileSync(conventionYml, "utf8")).toBe(beforeConvention);
  });

  it("fails clearly without gh auth, suggesting plain board", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-gh-auth-"));
    writeBranchedTree(dir);
    const gh: BoardGithub = {
      listPrs: () => {
        throw new Error(
          "GitHub overlay unavailable: auth required (check `gh auth status`, or run plain `arggon board` for the offline snapshot)",
        );
      },
    };
    expect(() => runBoard({ cwd: dir, github: true, gh })).toThrow(/plain `arggon board`/);
  });
});
