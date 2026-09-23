import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  displayPath,
  escapeHtml,
  applyBoardFilter,
  evaluateDrop,
  renderBoardHtml,
  runBoard,
  summarizeChecks,
  type BoardLensItem,
} from "./board.js";
import type { BoardGithub, PrInfo } from "./board.js";
import { type ContractWorkItem as WorkItem } from "@arggondev/lib";

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

const GENERATED_AT = "2026-09-07T00:00:00.000Z";

function item(overrides: Partial<WorkItem> & Pick<WorkItem, "id" | "type" | "status">): WorkItem {
  return {
    title: null,
    assignee: null,
    branch: null,
    parent: null,
    labels: [],
    priority: null,
    created: "2026-09-07",
    updated: "2026-09-07",
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
    const result = runBoard({ cwd: dir, out: "out.html", generatedAt: GENERATED_AT, me: null });
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
    const result = runBoard({ cwd: sub, generatedAt: GENERATED_AT, me: null });
    expect(result.root).toBe(dir);
    expect(result.outPath).toBe(join(dir, "board.html"));
    expect(existsSync(result.outPath)).toBe(true);
  });
});

describe("runBoard saved views (task-board-filter-lenses)", () => {
  function writeTracker(dir: string, convention: string): void {
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks", ".convention.yml"), convention, "utf8");
  }

  it("renders x-views as lens chips and bakes the resolved @me at generation time", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-views-"));
    writeTracker(dir, 'version: 0\nx-views:\n  smoke: "label:smoke"\n  mine: "assignee:@me"\n');
    const result = runBoard({ cwd: dir, out: "out.html", generatedAt: GENERATED_AT, me: "arggon" });
    const html = readFileSync(result.outPath, "utf8");
    expect(html).toContain(
      'data-name="smoke" data-filter="label:smoke" title="smoke: label:smoke">smoke</button>',
    );
    // The chip keeps the raw expression (tooltip) and the page bakes the login
    // for `@me` — resolution is the caller's job, exactly like runList.
    expect(html).toContain(
      'data-name="mine" data-filter="assignee:@me" title="mine: assignee:@me"',
    );
    expect(html).toContain('var BOARD_ME = "arggon";');
  });

  it("degrades to no chips when x-views is absent or malformed", () => {
    const bare = mkdtempSync(join(tmpdir(), "arggon-board-noviews-"));
    writeTracker(bare, "version: 0\n");
    const bareHtml = readFileSync(
      runBoard({ cwd: bare, out: "out.html", generatedAt: GENERATED_AT, me: null }).outPath,
      "utf8",
    );
    expect(bareHtml).not.toContain('id="board-lenses"');
    expect(bareHtml).not.toContain('class="lens"');

    const broken = mkdtempSync(join(tmpdir(), "arggon-board-badviews-"));
    writeTracker(broken, "version: 0\nx-views: open\n");
    const brokenHtml = readFileSync(
      runBoard({ cwd: broken, out: "out.html", generatedAt: GENERATED_AT, me: null }).outPath,
      "utf8",
    );
    expect(brokenHtml).not.toContain('id="board-lenses"');
    expect(brokenHtml).not.toContain('class="lens"');
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

describe("applyBoardFilter (embedded board lens, task-board-filter-lenses)", () => {
  /**
   * Supported-subset table (v1), asserted 1:1 with the kernel in
   * cli/src/board-parity.test.ts:
   *   fields:    type, status, label, assignee, priority, ancestor
   *   free text: any token without ":" (case-insensitive id/title substring)
   *   excluded:  parent, depends-on, blocked-by, ready (kernel-only; refused
   *              with a pointer to `arggon list --filter`)
   */
  const lensItems: BoardLensItem[] = [
    {
      id: "launch",
      title: "Launch",
      type: "initiative",
      status: "todo",
      assignee: null,
      labels: ["core"],
      parent: null,
      priority: "p1",
    },
    {
      id: "epic-a",
      title: "Auth epic",
      type: "epic",
      status: "todo",
      assignee: null,
      labels: ["core", "security"],
      parent: "launch",
      priority: null,
    },
    {
      id: "story-a",
      title: "Login flow",
      type: "story",
      status: "todo",
      assignee: "alice",
      labels: ["security"],
      parent: "epic-a",
      priority: "p2",
    },
    {
      id: "task-one",
      title: "Fix login flow",
      type: "task",
      status: "in_progress",
      assignee: "alice",
      labels: ["security"],
      parent: "story-a",
      priority: "p1",
    },
    {
      id: "task-two",
      title: "Ship it",
      type: "task",
      status: "done",
      assignee: "bob",
      labels: [],
      parent: "story-a",
      priority: null,
    },
    {
      id: "bug-one",
      title: "Crash on empty",
      type: "bug",
      status: "todo",
      assignee: null,
      labels: ["bug"],
      parent: "story-a",
      priority: "p0",
    },
  ];

  function visible(expr: string, me?: string | null): string[] {
    const result = applyBoardFilter(lensItems, expr, me);
    if (!result.ok) throw new Error(result.error);
    return result.visible;
  }

  function errorOf(expr: string, me?: string | null): string {
    const result = applyBoardFilter(lensItems, expr, me);
    if (result.ok) throw new Error(`expected "${expr}" to be refused`);
    return result.error;
  }

  it("matches every item for an empty expression, in input order", () => {
    expect(visible("")).toEqual(lensItems.map((item) => item.id));
    expect(visible("   ")).toEqual(lensItems.map((item) => item.id));
  });

  it("free text matches id or title, case-insensitively, ANDing multiple tokens", () => {
    expect(visible("login")).toEqual(["story-a", "task-one"]);
    expect(visible("LOGIN")).toEqual(["story-a", "task-one"]);
    expect(visible("task-one")).toEqual(["task-one"]);
    expect(visible('"login flow"')).toEqual(["story-a", "task-one"]);
    expect(visible("login task-one")).toEqual(["task-one"]);
  });

  it("supports the documented predicate subset with kernel semantics", () => {
    expect(visible("type:task")).toEqual(["task-one", "task-two"]);
    expect(visible("status:done")).toEqual(["task-two"]);
    expect(visible("label:security")).toEqual(["epic-a", "story-a", "task-one"]);
    expect(visible("assignee:alice")).toEqual(["story-a", "task-one"]);
    expect(visible('assignee:"alice"')).toEqual(["story-a", "task-one"]);
    expect(visible("priority:p1")).toEqual(["launch", "task-one"]);
    expect(visible("priority:none")).toEqual(["epic-a", "task-two"]);
    expect(visible("status:todo label:security")).toEqual(["epic-a", "story-a"]);
  });

  it("walks the ancestor chain only (never the item itself, unknown ids never match)", () => {
    expect(visible("ancestor:launch")).toEqual([
      "epic-a",
      "story-a",
      "task-one",
      "task-two",
      "bug-one",
    ]);
    expect(visible("ancestor:epic-a")).toEqual(["story-a", "task-one", "task-two", "bug-one"]);
    expect(visible("ancestor:task-one")).toEqual([]);
    expect(visible("ancestor:missing")).toEqual([]);
    expect(visible("!ancestor:epic-a")).toEqual(["launch", "epic-a"]);
  });

  it("negates predicates and ANDs them with free text", () => {
    expect(visible("!type:task")).toEqual(["launch", "epic-a", "story-a", "bug-one"]);
    expect(visible("!label:security")).toEqual(["launch", "task-two", "bug-one"]);
    expect(visible("status:todo login")).toEqual(["story-a"]);
  });

  it("resolves assignee:@me through the caller and refuses an unresolved @me", () => {
    expect(visible("assignee:@me", "alice")).toEqual(["story-a", "task-one"]);
    expect(errorOf("assignee:@me", null)).toContain("could not resolve @me");
    expect(errorOf("assignee:@me")).toContain("could not resolve @me");
    // @me in another field is a literal value, exactly like the kernel.
    expect(visible("label:@me", "alice")).toEqual([]);
  });

  it("refuses the kernel-only dependency predicates with a pointer to list --filter", () => {
    for (const expr of ["parent:story-a", "depends-on:task-one", "blocked-by:task-one"]) {
      const message = errorOf(expr);
      expect(message).toContain(`does not support "${expr.split(":")[0]}:"`);
      expect(message).toContain("arggon list --filter");
    }
  });

  it("mirrors parseFilter's syntax and enum errors", () => {
    expect(errorOf("foo:bar")).toContain('unknown filter field "foo"');
    expect(errorOf("status:")).toBe('empty value in filter token "status:"');
    expect(errorOf("!login")).toContain('bad filter token "!login"');
    expect(errorOf('assignee:"Jane')).toContain("unterminated quote");
    expect(errorOf('assignee:"Jane"x')).toContain("mismatched quotes");
    expect(errorOf("status:bogus")).toBe(
      'unknown status "bogus". Allowed: todo, in_progress, blocked, done, cancelled',
    );
    expect(errorOf("type:bogus")).toBe(
      'unknown type "bogus". Allowed: initiative, epic, story, task, bug',
    );
    expect(errorOf("priority:p9")).toBe('unknown priority "p9". Allowed: p0, p1, p2, p3, none');
  });

  it("is cycle-safe on malformed parent chains and tolerates sparse items", () => {
    const cyclic: BoardLensItem[] = [
      { id: "a", type: "task", status: "todo", parent: "b" },
      { id: "b", type: "task", status: "todo", parent: "a" },
      { id: "c", type: "task", status: "todo", parent: "b" },
      { id: "d", type: "task", status: "todo" },
    ];
    expect(applyBoardFilter(cyclic, "ancestor:b")).toEqual({ ok: true, visible: ["a", "c"] });
    expect(applyBoardFilter(cyclic, "ancestor:a")).toEqual({ ok: true, visible: ["b", "c"] });
    expect(applyBoardFilter(cyclic, "missing")).toEqual({ ok: true, visible: [] });
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

describe("renderBoardHtml filter lens (task-board-filter-lenses)", () => {
  const lensItems = [
    item({ id: "task-a", type: "task", status: "todo", title: "A", labels: ["smoke"] }),
  ];

  it("renders the filter box and one chip per saved view with name + expression tooltip", () => {
    const html = renderBoardHtml(lensItems, {
      generatedAt: GENERATED_AT,
      lenses: { smoke: "label:smoke", mine: "assignee:@me" },
      me: "arggon",
    });
    expect(html).toContain('id="board-filter-input"');
    expect(html).toContain('id="board-filter-clear"');
    expect(html).toContain('id="board-filter-count"');
    expect(html).toContain('id="board-lenses"');
    expect(html).toContain(
      'data-name="smoke" data-filter="label:smoke" title="smoke: label:smoke">smoke</button>',
    );
    expect(html).toContain(
      'data-name="mine" data-filter="assignee:@me" title="mine: assignee:@me"',
    );
    expect(html).toContain('var BOARD_ME = "arggon";');
    expect(html).toContain(applyBoardFilter.toString());
  });

  it("renders no chips without x-views and defaults @me to unresolved", () => {
    const html = renderBoardHtml(lensItems, { generatedAt: GENERATED_AT });
    expect(html).not.toContain('id="board-lenses"');
    expect(html).not.toContain('class="lens"');
    expect(html).toContain("var BOARD_ME = null;");
  });

  it("renders identical HTML with empty lenses and an explicit null @me (unchanged export)", () => {
    const plain = renderBoardHtml(lensItems, { generatedAt: GENERATED_AT });
    const explicit = renderBoardHtml(lensItems, {
      generatedAt: GENERATED_AT,
      lenses: {},
      me: null,
    });
    expect(explicit).toBe(plain);
  });

  it("escapes hostile view names and expressions", () => {
    const html = renderBoardHtml(lensItems, {
      generatedAt: GENERATED_AT,
      lenses: { '"><script>alert(1)</script>': 'status:todo" onmouseover="alert(1)' },
    });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("embeds the item snapshot script-safely", () => {
    const html = renderBoardHtml(
      [
        item({
          id: "task-x",
          type: "task",
          status: "todo",
          title: "</script><script>alert(1)</script>",
        }),
      ],
      { generatedAt: GENERATED_AT },
    );
    expect(html).toContain("var BOARD_ITEMS = [");
    expect(html).toContain("\\u003cscript>alert(1)");
    expect(html).not.toContain("<script>alert(1)");
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

describe("renderBoardHtml review surface (task-board-review-surface, serve-only diff links)", () => {
  it("appends a /files diff link next to the PR badge only with diffLinks", () => {
    const items = [item({ id: "task-a", type: "task", status: "todo", branch: "feat/a" })];
    const prs = new Map([["feat/a", pr({ branch: "feat/a", number: 7 })]]);
    const serveHtml = renderBoardHtml(items, {
      generatedAt: GENERATED_AT,
      live: true,
      diffLinks: true,
      prs,
    });
    expect(serveHtml).toContain('href="https://github.com/o/r/pull/7/files"');
    expect(serveHtml).toContain(">diff</a>");

    // Static --github export (no diffLinks) stays without the diff link.
    const staticHtml = renderBoardHtml(items, { generatedAt: GENERATED_AT, live: true, prs });
    expect(staticHtml).not.toContain("/files");
    expect(staticHtml).not.toContain(">diff</a>");
  });

  it("renders no diff link for PRs without a url or cards without a matching PR", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-a", type: "task", status: "todo", branch: "feat/a" }),
        item({ id: "task-b", type: "task", status: "todo", branch: "feat/b" }),
      ],
      {
        generatedAt: GENERATED_AT,
        live: true,
        diffLinks: true,
        prs: new Map([["feat/a", pr({ branch: "feat/a", number: 7, url: "" })]]),
      },
    );
    expect(html).not.toContain('class="diff"');
    expect(html).toContain("○ no PR");
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
      me: null,
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

describe("renderBoardHtml dependency edges (spec-deps-001)", () => {
  it("shows a blocked-by line per open dependency and none for terminal deps", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-a", type: "task", status: "todo", depends_on: ["task-x", "done-y"] }),
        item({ id: "bug-b", type: "bug", status: "todo", depends_on: ["done-y"] }),
        item({ id: "task-c", type: "task", status: "todo", depends_on: ["done-y", "gone-z"] }),
        item({ id: "task-x", type: "task", status: "in_progress" }),
        item({ id: "done-y", type: "task", status: "done" }),
      ],
      { generatedAt: GENERATED_AT },
    );
    // Open deps render; done/cancelled deps do not.
    expect(html).toContain("↳ blocked by task-x");
    expect(html).not.toContain("↳ blocked by done-y");
    // Unknown dep ids count as open (validate reports UNKNOWN_DEPENDENCY).
    expect(html).toContain("↳ blocked by gone-z");
    // Cards without open deps carry no blocked-by line at all.
    expect(html.match(/↳ blocked by/g)).toHaveLength(2);
  });

  it("escapes dependency ids like every other card field", () => {
    const html = renderBoardHtml(
      [item({ id: "task-a", type: "task", status: "todo", depends_on: ['<b>&"x'] })],
      { generatedAt: GENERATED_AT },
    );
    expect(html).toContain("↳ blocked by &lt;b&gt;&amp;&quot;x");
    expect(html).not.toContain("<b>&");
  });
});

describe("renderBoardHtml blocked-card visuals (task-board-dependency-visuals)", () => {
  it("marks cards with open deps: dep-blocked class + blocked-by-N badge; clean cards stay plain", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-a", type: "task", status: "todo", depends_on: ["task-x", "gone-z"] }),
        item({ id: "task-b", type: "task", status: "todo", depends_on: ["done-y"] }),
        item({ id: "task-c", type: "task", status: "todo" }),
        item({ id: "task-x", type: "task", status: "in_progress" }),
        item({ id: "done-y", type: "task", status: "done" }),
      ],
      { generatedAt: GENERATED_AT },
    );
    // Blocked card: dimming class + one count badge (two open deps -> "2").
    expect(html).toContain('<div class="card dep-blocked" draggable="true" data-id="task-a"');
    expect(html).toContain('<span class="blocked-badge">blocked by 2</span>');
    // Deps that are only terminal do not block: no class, no badge.
    expect(html).not.toContain('data-id="task-b" class');
    expect(html.match(/class="card dep-blocked"/g)).toHaveLength(1);
    expect(html.match(/<span class="blocked-badge">/g)).toHaveLength(1);
    expect(html).toContain('<div class="card" draggable="true" data-id="task-b"');
    expect(html).toContain('<div class="card" draggable="true" data-id="task-c"');
  });
});

describe("renderBoardHtml --group-by story (task-board-dependency-visuals)", () => {
  it("groups cards under parent-story headers sorted ascending; parent-less cards last under 'no story' only when mixed", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-z", type: "task", status: "todo", parent: "story-b" }),
        item({ id: "task-a", type: "task", status: "todo", parent: "story-a" }),
        item({ id: "task-b", type: "task", status: "todo", parent: "story-a" }),
        item({ id: "task-c", type: "task", status: "todo" }),
        item({ id: "task-d", type: "task", status: "done", parent: "story-b" }),
      ],
      { generatedAt: GENERATED_AT, groupBy: "story" },
    );
    expect(html).toContain('<div class="mgroup-head">⚑ story-a</div>');
    expect(html).toContain('<div class="mgroup-head">⚑ story-b</div>');
    expect(html.indexOf("⚑ story-a")).toBeLessThan(html.indexOf("⚑ story-b"));
    expect(html).toContain('<div class="mgroup-head none">no story</div>');
    // "no story" renders last within its column.
    expect(html.indexOf("no story")).toBeGreaterThan(html.indexOf("⚑ story-b"));
    // task-c's card sits under the no-story header; task-d is in done.
    expect(html).toContain('data-id="task-c"');
  });

  it("hides group headers entirely when no card has a parent (renders as before)", () => {
    const html = renderBoardHtml([item({ id: "task-a", type: "task", status: "todo" })], {
      generatedAt: GENERATED_AT,
      groupBy: "story",
    });
    expect(html).not.toContain('<div class="mgroup-head');
    expect(html).not.toContain("no story");
    expect(html).toContain('data-id="task-a"');
  });

  it("escapes hostile parent ids like every other card field", () => {
    const html = renderBoardHtml(
      [item({ id: "task-a", type: "task", status: "todo", parent: '"><script>' })],
      { generatedAt: GENERATED_AT, groupBy: "story" },
    );
    expect(html).toContain("⚑ &quot;&gt;&lt;script&gt;");
    expect(html).not.toContain('"><script>');
  });
});

describe("runBoard --group-by story (task-board-dependency-visuals)", () => {
  it("accepts groupBy story, reports it, and rejects unknown fields naming both options", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-group-story-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 1\n", "utf8");
    writeFileSync(
      join(dir, "tasks", "task-a.md"),
      '---\ntype: task\nid: task-a\ntitle: A\nstatus: todo\nparent: story-x\ncreated: "2026-09-15"\nupdated: "2026-09-15"\n---\n',
      "utf8",
    );
    const result = runBoard({
      cwd: dir,
      out: join(dir, "board.html"),
      generatedAt: GENERATED_AT,
      groupBy: "story",
      me: null,
    });
    expect(result.groupBy).toBe("story");
    const html = readFileSync(result.outPath, "utf8");
    expect(html).toContain("⚑ story-x");
    expect(() => runBoard({ cwd: dir, groupBy: "priority" })).toThrow(
      /unknown --group-by field 'priority' \(supported: milestone, story\)/,
    );
  });
});
