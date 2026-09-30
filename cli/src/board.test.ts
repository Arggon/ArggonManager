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
  dropNeedsClaimPrompt,
  evaluateDrop,
  renderBoardDetail,
  renderBoardHtml,
  runBoard,
  summarizeChecks,
  trapBoardFocus,
  wireBoardDetail,
  wireBoardColumns,
  wireBoardKeyboardNav,
  wireBoardMoveMenu,
  wireBoardMovePrompt,
  buildBoardSummary,
  MAX_DETAIL_PROSE_BYTES,
  type BoardLensItem,
  type BoardSummary,
} from "./board.js";
import type { BoardDetailPayload, BoardGithub, PrInfo } from "./board.js";
import {
  findTasksDir,
  loadItems,
  type ContractWorkItem as WorkItem,
  type KernelWorkItem,
} from "@arggondev/lib";

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
   * Supported predicate table, asserted 1:1 with the kernel in
   * cli/src/board-parity.test.ts:
   *   fields:    type, status, label, assignee, priority, ancestor,
   *              parent, depends-on, blocked-by, ready
   *              (task-board-filter-dep-predicates)
   *   free text: any token without ":" (case-insensitive id/title substring)
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
      depends_on: ["ghost"],
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
      depends_on: ["task-one"],
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
      depends_on: ["task-two"],
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

  it("supports the kernel dependency predicates (task-board-filter-dep-predicates)", () => {
    // parent: exact match on the parent id; parentless items never match.
    expect(visible("parent:launch")).toEqual(["epic-a"]);
    expect(visible("parent:story-a")).toEqual(["task-one", "task-two", "bug-one"]);
    expect(visible("!parent:story-a")).toEqual(["launch", "epic-a", "story-a"]);
    expect(visible("parent:story-a !type:task")).toEqual(["bug-one"]);
    // depends-on: membership in the item's own depends_on.
    expect(visible("depends-on:task-one")).toEqual(["story-a"]);
    expect(visible("depends-on:ghost")).toEqual(["epic-a"]);
    expect(visible("!depends-on:task-one")).toEqual([
      "launch",
      "epic-a",
      "task-one",
      "task-two",
      "bug-one",
    ]);
    // blocked-by: the computed inverse, indexed over the WHOLE input.
    expect(visible("blocked-by:task-one")).toEqual(["story-a"]);
    expect(visible("blocked-by:task-two")).toEqual(["bug-one"]);
    expect(visible("blocked-by:nobody")).toEqual([]);
    // readiness: every dep terminal (done/cancelled); an unknown dep is open.
    expect(visible("ready:true")).toEqual(["launch", "task-one", "task-two", "bug-one"]);
    expect(visible("ready:false")).toEqual(["epic-a", "story-a"]);
    expect(visible("!ready:true")).toEqual(["epic-a", "story-a"]);
    // ANDed with the older predicates, like every other field.
    expect(visible("ready:true type:bug")).toEqual(["bug-one"]);
  });

  it("reads dependencies in the kernel precedence when both shapes ride along", () => {
    // dependsOn wins when an item carries both (task-ui-viewmodel-contract-deps):
    // item-a's kernel field hides the contract dep, item-b reads depends_on.
    const dual = applyBoardFilter(
      [
        {
          id: "task-a",
          type: "task",
          status: "todo",
          labels: [],
          dependsOn: ["task-done"],
          depends_on: ["task-open"],
        },
        { id: "task-b", type: "task", status: "todo", labels: [], depends_on: ["task-open"] },
        { id: "task-done", type: "task", status: "done", labels: [] },
        { id: "task-open", type: "task", status: "todo", labels: [] },
      ],
      "blocked-by:task-open",
      null,
    );
    expect(dual).toEqual({ ok: true, visible: ["task-b"] });
    const ready = applyBoardFilter(
      [
        {
          id: "task-a",
          type: "task",
          status: "todo",
          labels: [],
          dependsOn: ["task-done"],
          depends_on: ["task-open"],
        },
        { id: "task-done", type: "task", status: "done", labels: [] },
      ],
      "ready:true",
      null,
    );
    // task-a's kernel field hides the open contract dep; task-done itself has
    // no deps, so it is ready too.
    expect(ready).toEqual({ ok: true, visible: ["task-a", "task-done"] });
  });

  it("refuses an unknown readiness value", () => {
    expect(errorOf("ready:bogus")).toBe('unknown readiness "bogus". Allowed: true, false');
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
      '<div class="card" role="group" aria-label="task task-a: task-a (in_progress, @arggon)" draggable="true" data-id="task-a" data-type="task" data-status="in_progress" data-assignee="arggon">',
    );
    expect(html).toContain(
      '<div class="card" role="group" aria-label="task task-b: task-b (todo)" draggable="true" data-id="task-b" data-type="task" data-status="todo">',
    );
    expect(html).not.toContain('data-status="todo" data-assignee');
  });

  it("names every card for assistive tech, escaping hostile titles (task-board-keyboard-a11y)", () => {
    const html = renderBoardHtml(
      [item({ id: "task-x", type: "bug", status: "blocked", title: '</title>"<script>' })],
      { generatedAt: GENERATED_AT },
    );
    expect(html).toContain(
      'role="group" aria-label="bug task-x: &lt;/title&gt;&quot;&lt;script&gt; (blocked)"',
    );
    // The hostile title never survives unescaped anywhere in the page.
    expect(html).not.toContain('</title>"<script>');
  });

  it("renders named column landmarks and a labeled board (task-board-keyboard-a11y)", () => {
    const html = renderBoardHtml([], { generatedAt: GENERATED_AT });
    for (const status of ["todo", "in_progress", "blocked", "done", "cancelled"]) {
      expect(html).toContain(`aria-labelledby="board-column-${status}"`);
      expect(html).toContain(`<h2 id="board-column-${status}">`);
    }
    expect(html).toContain('<main class="board" aria-label="arggon board">');
  });

  it("renders no duplicate ids anywhere in the export (task-board-keyboard-a11y)", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-a", type: "task", status: "todo", title: "A" }),
        item({ id: "task-b", type: "bug", status: "done", title: "B" }),
      ],
      { generatedAt: GENERATED_AT, details: true },
    );
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
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

  it("replaces both window.prompt calls with the in-page move dialog (task-board-move-dialogs)", () => {
    for (const details of [false, true]) {
      const html = renderBoardHtml([item({ id: "task-a", type: "task", status: "todo" })], {
        generatedAt: GENERATED_AT,
        details,
      });
      // No prompt call survives anywhere in the page, static or serve.
      expect(html).not.toContain("window.prompt");
      // The dialog shell, its wiring and the focus trap ride with the drop flow.
      expect(html).toContain('id="board-move-prompt"');
      expect(html).toContain(wireBoardMovePrompt.toString());
      expect(html).toContain(trapBoardFocus.toString());
      expect(html).toContain("var askMoveValue = wireBoardMovePrompt();");
      // Claim mode and blocked mode collect through the same dialog.
      expect(html).toContain('"--assignee required to claim " + id');
      expect(html).toContain('"--blocked-reason required to block " + id');
    }
  });

  it("wires dialog validation and focus handling into the move prompt", () => {
    const source = wireBoardMovePrompt.toString();
    // Inline validation: whitespace-only input keeps the dialog open.
    expect(source).toContain("trim()");
    expect(source).toContain("a value is required");
    // Esc cancels, focus is trapped in the panel and restored on close.
    expect(source).toContain("trapBoardFocus(");
    expect(source).toContain('"Escape"');
    expect(source).toContain("opener.focus()");
    // The embedded copy never falls back to a blocking prompt.
    expect(source).not.toContain("window.prompt");
    // The error row announces itself (role=alert) and the input is labeled.
    const html = renderBoardHtml([item({ id: "task-a", type: "task", status: "todo" })], {
      generatedAt: GENERATED_AT,
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-labelledby="board-move-prompt-title"');
  });

  it("offers undo from the success toast only when the reverse move is legal", () => {
    const html = renderBoardHtml([item({ id: "task-a", type: "task", status: "todo" })], {
      generatedAt: GENERATED_AT,
    });
    // The toast carries an action button; undo re-enters attemptMove (the same
    // parity rules, dialogs included) and the legality check runs evaluateDrop.
    expect(html).toContain('label: "Undo"');
    expect(html).toContain("attemptMove(card, from)");
    expect(html).toContain(".toast-action");
    // The undo offer classifies the reverse transition with the drag flow's
    // own rule — never a second legality implementation.
    const page = html.slice(html.indexOf("function evaluateDrop"));
    expect(page).toContain("var reverse = evaluateDrop(");
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

describe("renderBoardHtml search landmark (task-axe-board-drawer-and-lens-coverage)", () => {
  it("carries the filter bar as a named search landmark on every board", () => {
    const html = renderBoardHtml(
      [item({ id: "task-a", type: "task", status: "todo", title: "A" })],
      { generatedAt: GENERATED_AT },
    );
    // The axe gate's `region` fix: the filter bar (label, input, count) sits in
    // a role="search" landmark, so the page content is fully landmarked. The
    // unit pin keeps a refactor from silently dropping the attribute between
    // browser runs.
    expect(html).toContain(
      '<div class="filterbar" id="board-filterbar" role="search" aria-label="board filters">',
    );
  });
});

describe("renderBoardHtml non-text contrast (WCAG 1.4.11, task-board-non-text-contrast-and-drag-affordance)", () => {
  // axe has no automated rule for 1.4.11, so the @smoke lane cannot catch a
  // non-text regression. These assertions pin the decision on the rendered CSS
  // instead: every interactive-control boundary clears 3:1 on the surfaces it
  // touches, and no opacity fade exists anywhere in the stylesheet.
  const html = renderBoardHtml([item({ id: "task-a", type: "task", status: "todo" })], {
    generatedAt: GENERATED_AT,
    details: true,
  });
  const css = (html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  /** Relative luminance per WCAG 2.x. */
  function luminance(hex: string): number {
    const [r, g, b] = [0, 2, 4].map((i) => {
      const v = parseInt(hex.replace("#", "").slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  /** WCAG contrast ratio between two hex colors. */
  function ratio(fg: string, bg: string): number {
    const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
  }
  /** The declarations of one rule from the rendered stylesheet. */
  function rule(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`${escaped} \\{([^}]*)\\}`));
    expect(match, `rule not found in rendered CSS: ${selector}`).toBeTruthy();
    return match![1];
  }

  it("keeps every recorded non-text boundary at or above 3:1", () => {
    // The pairs recorded in the item body: [what, foreground, background].
    const boundaries: Array<[string, string, string]> = [
      ["drop-target outline vs column", "#666a6f", "#ebecf0"], // 4.61
      ["count pill border vs column", "#666a6f", "#ebecf0"], // 4.61
      ["lens chip border vs page", "#666a6f", "#f4f5f7"], // 4.99
      ["lens chip border vs chip fill", "#666a6f", "#ffffff"], // 5.45
      ["lens.active fill vs page", "#0550ae", "#f4f5f7"], // 6.96
      ["drawer border vs drawer fill", "#666a6f", "#ffffff"], // 5.45
      ["move-menu border vs panel fill", "#666a6f", "#ffffff"], // 5.45
    ];
    for (const [what, fg, bg] of boundaries) {
      expect(ratio(fg, bg), what).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses the boundary grey on every interactive control (never the 1.3:1 #d0d4da)", () => {
    for (const selector of [
      "#board-filter-input",
      "#board-filter-clear",
      ".lens",
      ".col-toggle",
      ".layout-toggle",
      ".card-move",
      ".drawer-close",
      ".drawer-panel",
      ".move-menu-panel",
      ".move-menu-target",
      ".move-menu-cancel",
    ]) {
      expect(rule(selector), selector).toContain("1px solid #666a6f");
    }
    // The count pill is a passive indicator: its muted fill stays, the pill
    // edge is the recorded boundary, and its text pair (axe-enforced) is 6.04:1.
    expect(rule(".column .count")).toContain("border: 1px solid #666a6f");
    expect(ratio("#424a53", "#d0d4da")).toBeGreaterThanOrEqual(4.5);
  });

  it("affords the dragged card with a lift, never a fade", () => {
    const dragging = rule(".card.dragging");
    expect(dragging).toContain("box-shadow");
    expect(dragging).toContain("outline: 2px solid #0550ae");
    // No opacity declaration anywhere in the stylesheet: a fade composites
    // every descendant against the surface below it (measured 1.5-2.7:1), so
    // the state cue must come from surface, shadow and outline instead.
    expect(css).not.toMatch(/\bopacity\s*:/);
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

describe("renderBoardHtml item detail drawer (task-board-item-detail, serve-only)", () => {
  const items = [item({ id: "task-a", type: "task", status: "todo", title: "A" })];

  it("renders the drawer shell, focusable cards and /api/item wiring only with details: true", () => {
    const html = renderBoardHtml(items, { generatedAt: GENERATED_AT, details: true });
    expect(html).toContain('id="board-drawer"');
    expect(html).toContain('id="board-drawer-body"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-detail-endpoint="/api/item"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain(renderBoardDetail.toString());
    expect(html).toContain(wireBoardDetail.toString());
    // Serve mode embeds no snapshot map: BOARD_DETAILS is null and the drawer
    // keeps the /api/item fetch path (task-board-static-details).
    expect(html).toContain("var BOARD_DETAILS = null;");
    expect(html).toContain("wireBoardDetail(toast, renderBoardDetail, BOARD_DETAILS);");
  });

  it("seeds the roving tabindex on exactly the first card (task-board-keyboard-a11y)", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-a", type: "task", status: "todo", title: "A" }),
        item({ id: "task-b", type: "task", status: "todo", title: "B" }),
        item({ id: "task-c", type: "task", status: "done", title: "C" }),
      ],
      { generatedAt: GENERATED_AT, details: true },
    );
    expect(html).toContain('aria-label="task task-a: A (todo)" draggable="true" tabindex="0"');
    expect(html).toContain('aria-label="task task-b: B (todo)" draggable="true" tabindex="-1"');
    expect(html).toContain('aria-label="task task-c: C (done)" draggable="true" tabindex="-1"');
    expect(html).toContain(wireBoardKeyboardNav.toString());
    expect(html).toContain("var keyboardNav = wireBoardKeyboardNav()");
    expect(html).toContain("keyboardNav.ensureAnchor()");
  });

  it("renders the card move menu shell and wiring only with details: true (task-board-keyboard-a11y)", () => {
    const html = renderBoardHtml(items, { generatedAt: GENERATED_AT, details: true });
    expect(html).toContain('id="board-move-menu"');
    expect(html).toContain('aria-label="move card"');
    expect(html).toContain('class="card-move" aria-label="move task-a"');
    expect(html).toContain(wireBoardMoveMenu.toString());
    expect(html).toContain(trapBoardFocus.toString());
    // The menu classifies targets through the drag flow's own rule and prompt
    // predicate — never a second legality implementation.
    expect(wireBoardMoveMenu.toString()).toContain("evaluateDrop(");
    expect(wireBoardMoveMenu.toString()).toContain("dropNeedsClaimPrompt(");
    expect(html).toContain("wireBoardMoveMenu(attemptMove);");
  });

  it("classifies only the missing-assignee refusal as completable by the claim prompt", () => {
    expect(dropNeedsClaimPrompt({ ok: true, reason: "" })).toBe(false);
    expect(
      dropNeedsClaimPrompt({
        ok: false,
        reason: "task 'a' with status in_progress requires --assignee (claim first)",
      }),
    ).toBe(true);
    expect(dropNeedsClaimPrompt({ ok: false, reason: "cannot transition todo -> done" })).toBe(
      false,
    );
    expect(
      dropNeedsClaimPrompt({
        ok: false,
        reason: "claim conflict: 'a' is claimed by 'alice' (status in_progress).",
      }),
    ).toBe(false);
  });

  it("keeps the static export lean and byte-identical without details", () => {
    const plain = renderBoardHtml(items, { generatedAt: GENERATED_AT });
    const explicit = renderBoardHtml(items, { generatedAt: GENERATED_AT, details: false });
    expect(explicit).toBe(plain);
    expect(plain).not.toContain("board-drawer");
    expect(plain).not.toContain("/api/item");
    // Cards stay unfocusable in the static export (the drawer's tabindex is
    // serve-only); the focus trap's SELECTOR STRING rides along now that the
    // move dialog shares it, so the assertion pins the attribute, not the word.
    expect(plain).not.toContain('tabindex="0"');
    expect(plain).not.toContain("renderBoardDetail");
    // task-board-keyboard-a11y: the interactive surface stays serve-only.
    expect(plain).not.toContain("board-move-menu");
    expect(plain).not.toContain("card-move");
    expect(plain).not.toContain("wireBoardMoveMenu");
    expect(plain).not.toContain("wireBoardKeyboardNav");
  });

  it("runBoard's static export stays drawer-free (no --details opt-in in this item)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-nodrawer-"));
    writeBranchedTree(dir);
    const result = runBoard({ cwd: dir, out: "out.html", generatedAt: GENERATED_AT, me: null });
    const html = readFileSync(result.outPath, "utf8");
    expect(html).toContain("task-one");
    expect(html).not.toContain("board-drawer");
    expect(html).not.toContain("/api/item");
  });

  it("embeds detail renderers that never turn untrusted text into HTML", () => {
    for (const source of [renderBoardDetail.toString(), wireBoardDetail.toString()]) {
      expect(source).not.toContain("innerHTML");
      expect(source).not.toContain("insertAdjacentHTML");
      expect(source).not.toContain("outerHTML");
    }
    // The renderer writes values through textContent/DOM text nodes.
    expect(renderBoardDetail.toString()).toContain("textContent");
    // PR links are only wired for absolute http(s) URLs.
    expect(renderBoardDetail.toString()).toContain("/^https?:\\/\\//");
  });
});

describe("static export --details (task-board-static-details)", () => {
  const items = [item({ id: "task-a", type: "task", status: "todo", title: "A" })];

  function detailPayload(
    overrides: Partial<BoardDetailPayload["detail"]> = {},
    itemOverrides: Partial<WorkItem> = {},
  ): BoardDetailPayload {
    return {
      ok: true,
      item: item({ id: "task-a", type: "task", status: "todo", title: "A", ...itemOverrides }),
      detail: {
        prose: "body",
        prose_truncated: false,
        acceptance: [],
        comments: [],
        hidden_comments: 0,
        dependencies: [],
        pr: null,
        ...overrides,
      },
    };
  }

  /** Extract and parse the embedded `var BOARD_DETAILS = {...};` snapshot. */
  function embeddedDetails(html: string): Record<string, BoardDetailPayload> {
    const line = html.split("\n").find((candidate) => candidate.includes("var BOARD_DETAILS = "));
    expect(line).toBeDefined();
    const json = line!.replace(/^.*var BOARD_DETAILS = /, "").replace(/;$/, "");
    return JSON.parse(json) as Record<string, BoardDetailPayload>;
  }

  it("embeds the snapshot map and wires the drawer to it instead of the fetch", () => {
    const html = renderBoardHtml(items, {
      generatedAt: GENERATED_AT,
      details: true,
      staticDetails: { "task-a": detailPayload() },
    });
    expect(html).toContain('id="board-drawer"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('var BOARD_DETAILS = {"task-a":');
    expect(html).toContain("wireBoardDetail(toast, renderBoardDetail, BOARD_DETAILS);");
    // The map's payload round-trips verbatim.
    const parsed = embeddedDetails(html);
    expect(parsed["task-a"].detail.prose).toBe("body");
    // The client renders the snapshot without a server: no fetch endpoint is
    // needed (the body attribute stays for the serve path only).
    expect(wireBoardDetail.toString()).toContain("embeddedDetails[id]");
  });

  it("keeps the export byte-identical without the flag — even when a map is passed", () => {
    const plain = renderBoardHtml(items, { generatedAt: GENERATED_AT });
    const explicitOff = renderBoardHtml(items, { generatedAt: GENERATED_AT, details: false });
    const mapWithoutFlag = renderBoardHtml(items, {
      generatedAt: GENERATED_AT,
      staticDetails: { "task-a": detailPayload() },
    });
    expect(explicitOff).toBe(plain);
    expect(mapWithoutFlag).toBe(plain);
    expect(plain).not.toContain("BOARD_DETAILS");
    expect(plain).not.toContain("board-drawer");
  });

  it("embeds hostile detail text script-safely", () => {
    const hostile = "</script><script>alert(1)</script>";
    const html = renderBoardHtml(items, {
      generatedAt: GENERATED_AT,
      details: true,
      staticDetails: {
        "task-a": detailPayload({
          prose: hostile,
          comments: [{ date: "2026-09-07", author: '"><script>', text: hostile, truncated: false }],
        }),
      },
    });
    expect(html).not.toContain("<script>alert(1)");
    const parsed = embeddedDetails(html);
    expect(parsed["task-a"].detail.prose).toBe(hostile);
    expect(parsed["task-a"].detail.comments[0].author).toBe('"><script>');
  });

  it("runBoard --details embeds clipped prose, the 3-comment tail and acceptance rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-details-"));
    const { taskMd } = writeBranchedTree(dir);
    const padded = "x".repeat(9 * 1024); // past MAX_DETAIL_PROSE_BYTES
    const comments = [1, 2, 3, 4, 5]
      .map((n) => `### 2026-09-0${n} @user${n}\ncomment ${n}\n`)
      .join("\n");
    const previous = readFileSync(taskMd, "utf8");
    const frontmatterEnd = previous.indexOf("---", 1);
    writeFileSync(
      taskMd,
      `${previous.slice(0, frontmatterEnd + 3)}\n\n# Task One\n\n## Acceptance\n\n- [x] done row\n- [ ] open row\n\n${padded}\n\n${comments}`,
      "utf8",
    );
    const result = runBoard({
      cwd: dir,
      out: "out.html",
      generatedAt: GENERATED_AT,
      me: null,
      details: true,
    });
    expect(result.detailBytes).toBeGreaterThan(0);
    const html = readFileSync(result.outPath, "utf8");
    expect(html).toContain('id="board-drawer"');
    const payloads = embeddedDetails(html);
    // Every rendered item gets a payload — initiatives and stories included.
    expect(Object.keys(payloads).sort()).toEqual(["launch", "story-a", "task-one"]);
    const detail = payloads["task-one"].detail;
    // Prose is clipped at the documented per-item cap...
    expect(detail.prose_truncated).toBe(true);
    expect(Buffer.byteLength(detail.prose, "utf8")).toBeLessThanOrEqual(MAX_DETAIL_PROSE_BYTES);
    // ...acceptance rows are parsed from the clipped prose...
    expect(detail.acceptance).toEqual([
      { text: "done row", checked: true },
      { text: "open row", checked: false },
    ]);
    // ...and comments are the kernel tail (last 3 of 5).
    expect(detail.comments.map((comment) => comment.text)).toEqual([
      "comment 3",
      "comment 4",
      "comment 5",
    ]);
    expect(detail.hidden_comments).toBe(2);
    expect(detail.pr).toBeNull();
    // detailBytes is the exact embedded JSON size (the README payload figure).
    const line = html.split("\n").find((candidate) => candidate.includes("var BOARD_DETAILS = "));
    const json = line!.replace(/^.*var BOARD_DETAILS = /, "").replace(/;$/, "");
    expect(result.detailBytes).toBe(Buffer.byteLength(json, "utf8"));
  });

  it("runBoard without --details keeps the export drawer-free and byte-identical (regression)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-nodetails-"));
    writeBranchedTree(dir);
    const plain = runBoard({ cwd: dir, out: "plain.html", generatedAt: GENERATED_AT, me: null });
    const explicit = runBoard({
      cwd: dir,
      out: "explicit.html",
      generatedAt: GENERATED_AT,
      me: null,
      details: false,
    });
    expect(readFileSync(explicit.outPath, "utf8")).toBe(readFileSync(plain.outPath, "utf8"));
    expect(plain.detailBytes).toBeUndefined();
    const html = readFileSync(plain.outPath, "utf8");
    expect(html).not.toContain("BOARD_DETAILS");
    expect(html).not.toContain("board-drawer");
    expect(html).not.toContain("/api/item");
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
    expect(html).toContain('<div class="card dep-blocked" role="group"');
    expect(/<div class="card dep-blocked"[^>]*data-id="task-a"/.test(html)).toBe(true);
    expect(html).toContain('<span class="blocked-badge">blocked by 2</span>');
    // Deps that are only terminal do not block: no class, no badge.
    expect(html).not.toContain('data-id="task-b" class');
    expect(html.match(/class="card dep-blocked"/g)).toHaveLength(1);
    expect(html.match(/<span class="blocked-badge">/g)).toHaveLength(1);
    expect(/<div class="card"[^>]*data-id="task-b"/.test(html)).toBe(true);
    expect(/<div class="card"[^>]*data-id="task-c"/.test(html)).toBe(true);
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
    // Group heads carry the story completion fraction (task-board-progress-header):
    // story-a 0/2 (two todo cards), story-b 1/2 (done task-z counts, done card + todo).
    expect(html).toContain('⚑ story-a <span class="completion">0/2</span>');
    expect(html).toContain('⚑ story-b <span class="completion">1/2</span>');
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

  it("shows the report's completion fraction on story group heads (task-board-progress-header)", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-a", type: "task", status: "done", parent: "story-a" }),
        item({ id: "task-b", type: "task", status: "cancelled", parent: "story-a" }),
        item({ id: "task-c", type: "task", status: "todo", parent: "story-a" }),
        item({ id: "task-d", type: "task", status: "in_progress", parent: "story-b" }),
        item({ id: "task-e", type: "task", status: "todo" }),
      ],
      { generatedAt: GENERATED_AT, groupBy: "story" },
    );
    // done + cancelled over the whole group (the kernel report's rule): story-a
    // 2/3, story-b 0/1. Fractions count cards across ALL columns.
    expect(html).toContain('⚑ story-a <span class="completion">2/3</span>');
    expect(html).toContain('⚑ story-b <span class="completion">0/1</span>');
    // The key-less head carries no fraction.
    expect(html).toContain('<div class="mgroup-head none">no story</div>');
  });

  it("renders no fraction under milestone grouping (fraction is a story-group feature)", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-a", type: "task", status: "done", parent: "story-a", milestone: "M1" }),
        item({ id: "task-b", type: "task", status: "todo", parent: "story-a", milestone: "M1" }),
      ],
      { generatedAt: GENERATED_AT, groupBy: "milestone" },
    );
    expect(html).toContain('<div class="mgroup-head">⚑ M1</div>');
    expect(html).not.toContain('class="completion"');
  });
});

describe("renderBoardHtml summary header (task-board-progress-header)", () => {
  const items = [item({ id: "task-a", type: "task", status: "todo", title: "A" })];
  const summary: BoardSummary = {
    epics: [{ id: "epic-a", title: "Epic A", done: 3, total: 7 }],
    wip: 2,
    blockedTotal: 1,
    blocked: [{ id: "bug-b", reason: "Waiting on OAuth credentials" }],
    priorities: { p0: 1, p1: 0, p2: 2, p3: 4, none: 30 },
  };

  it("renders the rollup panel: per-epic completion, WIP, priority mix, blocked with reasons", () => {
    const html = renderBoardHtml(items, { generatedAt: GENERATED_AT, summary });
    expect(html).toContain(
      '<section class="summary" id="board-summary" aria-label="progress summary">',
    );
    expect(html).toContain('<span class="epic" title="Epic A">epic-a 3/7</span>');
    expect(html).toContain('id="board-summary-wip">2</span>');
    expect(html).toContain("p0 1");
    expect(html).toContain('id="board-summary-priorities">p0 1<span class="sep"> · </span>p1 0');
    expect(html).toContain("none 30");
    // Blocked: the count and the reason text (what the card already shows).
    expect(html).toContain(
      'id="board-summary-blocked">1 — bug-b: Waiting on OAuth credentials</span>',
    );
  });

  it("escapes hostile epic ids/titles and blocked reasons", () => {
    const hostile: BoardSummary = {
      epics: [{ id: "<script>", title: "</script><script>alert(1)</script>", done: 0, total: 1 }],
      wip: 0,
      blockedTotal: 1,
      blocked: [{ id: "bug-x", reason: '" onmouseover="alert(1)' }],
      priorities: { p0: 0, p1: 0, p2: 0, p3: 0, none: 1 },
    };
    const html = renderBoardHtml(items, { generatedAt: GENERATED_AT, summary: hostile });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain('" onmouseover=');
    expect(html).toContain("&lt;script&gt; 0/1");
    expect(html).toContain("bug-x: &quot; onmouseover=&quot;alert(1)");
  });

  it("degrades to zeros/none for an empty tracker and stays out without the option", () => {
    const empty: BoardSummary = {
      epics: [],
      wip: 0,
      blockedTotal: 0,
      blocked: [],
      priorities: { p0: 0, p1: 0, p2: 0, p3: 0, none: 0 },
    };
    const html = renderBoardHtml([], { generatedAt: GENERATED_AT, summary: empty });
    expect(html).toContain('id="board-summary-epics"><span class="sep">none</span>');
    expect(html).toContain('id="board-summary-blocked">0</span>');

    const plain = renderBoardHtml([], { generatedAt: GENERATED_AT });
    expect(plain).not.toContain("board-summary");
    expect(plain).not.toContain('class="summary"');
  });

  it("buildBoardSummary computes from the kernel aggregation on a fixture tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-summary-"));
    writeBranchedTree(dir);
    // writeBranchedTree: launch (initiative) -> story-a (in_progress) -> task-one
    // (in_progress, claimable). Both claimable items are open and unprioritized;
    // the tree has no epic, so the epics row degrades to none.
    const summary = buildBoardSummary(loadItems(findTasksDir(dir)) as KernelWorkItem[]);
    expect(summary.epics).toEqual([]);
    expect(summary.wip).toBe(2);
    expect(summary.blockedTotal).toBe(0);
    expect(summary.blocked).toEqual([]);
    expect(summary.priorities).toEqual({ p0: 0, p1: 0, p2: 0, p3: 0, none: 2 });
  });

  it("runBoard renders the summary panel on the static export (static + serve parity)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-summary-static-"));
    writeBranchedTree(dir);
    const result = runBoard({ cwd: dir, out: "out.html", generatedAt: GENERATED_AT, me: null });
    const html = readFileSync(result.outPath, "utf8");
    expect(html).toContain('id="board-summary"');
    expect(html).toContain('id="board-summary-wip">2</span>');
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

describe("column controls (task-board-column-controls)", () => {
  // Static and serve must behave the same, so the assertions run on both
  // renders: the plain static export and the serve-mode (details) page.
  const renders = () => [
    ["static", renderBoardHtml([], { generatedAt: GENERATED_AT })] as const,
    [
      "serve",
      renderBoardHtml([], { generatedAt: GENERATED_AT, details: true, live: true }),
    ] as const,
  ];

  it("renders a collapse toggle in every column heading, count badge beside it", () => {
    for (const [mode, html] of renders()) {
      for (const status of ["todo", "in_progress", "blocked", "done", "cancelled"]) {
        const heading = `<h2 id="board-column-${status}">${status}`;
        expect(html, mode).toContain(heading);
        expect(html, mode).toContain(
          `<button type="button" class="col-toggle" data-status="${status}" aria-expanded="true" aria-label="collapse the ${status} column">&ndash;</button>`,
        );
      }
      // The count badge stays inside the heading: visible when collapsed.
      expect(html, mode).toMatch(
        /<span class="count">\d+<\/span><button type="button" class="col-toggle"/,
      );
    }
  });

  it("renders the terminal-column toggle and the layout reset in the filterbar", () => {
    for (const [mode, html] of renders()) {
      expect(html, mode).toContain(
        '<button type="button" id="board-terminal-toggle" class="layout-toggle" aria-pressed="false">hide done/cancelled</button>',
      );
      expect(html, mode).toContain(
        '<button type="button" id="board-layout-reset" class="layout-toggle">reset layout</button>',
      );
    }
  });

  it("keeps headers sticky and pins the collapsed/terminal-hidden CSS", () => {
    for (const [mode, html] of renders()) {
      expect(html, mode).toContain("position: sticky; top: 0; z-index: 5;");
      expect(html, mode).toContain(".column.collapsed .card");
      expect(html, mode).toContain(".column.terminal-hidden { display: none; }");
    }
  });

  it("embeds wireBoardColumns and calls it in every board's script", () => {
    for (const [mode, html] of renders()) {
      expect(html, mode).toContain(wireBoardColumns.toString());
      expect(html, mode).toContain(
        "wireBoardColumns(keyboardNav ? keyboardNav.ensureAnchor : null);",
      );
    }
  });

  it("pins the localStorage key and the corrupt-storage default fallback", () => {
    const source = wireBoardColumns.toString();
    expect(source).toContain('"arggon-board-columns-v1"');
    expect(source).toContain("localStorage.getItem");
    expect(source).toContain("localStorage.setItem");
    // Corrupt or missing storage degrades to the default layout. Whitespace
    // varies between the tsc build and the tsx test transform, so match loose.
    expect(source).toMatch(/collapsed:\s*\[\],\s*terminalHidden:\s*false/);
  });
});
