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
  boardTreeDisplay,
  boardTreeRoots,
  bootBoardTheme,
  buildBoardDetailMap,
  dropNeedsClaimPrompt,
  evaluateDrop,
  renderBoardDetail,
  renderBoardHtml,
  renderBoardTree,
  runBoard,
  summarizeChecks,
  trapBoardFocus,
  wireBoardDetail,
  wireBoardColumns,
  wireBoardKeyboardNav,
  wireBoardMoveMenu,
  wireBoardMovePrompt,
  wireBoardTheme,
  wireBoardView,
  buildBoardSummary,
  MAX_DETAIL_PROSE_BYTES,
  type BoardLensItem,
  type BoardSummary,
} from "./board.js";
import type { BoardDetailPayload, BoardGithub, PrInfo } from "./board.js";
// Ordering assertions go through assertOrder, never a bare `indexOf`
// comparison: `-1 < n` makes a renamed clause pass as if it were still
// ordered (bug-vacuous-substring-ordering-assertions).
import { assertOrder } from "../../test/assert-order.js";
import {
  acceptanceGate,
  findTasksDir,
  itemsById,
  loadItems,
  MAX_HUMAN_ERROR_CHARS,
  type ContractWorkItem as WorkItem,
  type KernelWorkItem,
} from "@arggondev/lib";
import { runCli } from "./test-spawn.js";
import { buildVersion } from "./build-info.js";

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

  it("orders cards by id on updated ties within a column", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-b", type: "task", status: "todo" }),
        item({ id: "task-a", type: "task", status: "todo" }),
      ],
      { generatedAt: GENERATED_AT },
    );
    assertOrder(html, "task-a", "task-b");
  });

  it("orders cards by most-recently-modified within a column, id on ties (task-board-columns-sort-cards-by-most-recently-modified)", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-old", type: "task", status: "todo", updated: "2026-09-01" }),
        item({ id: "task-new", type: "task", status: "todo", updated: "2026-10-12" }),
        item({ id: "task-mid", type: "task", status: "todo", updated: "2026-10-10" }),
      ],
      { generatedAt: GENERATED_AT },
    );
    assertOrder(html, "task-new", "task-mid");
    assertOrder(html, "task-mid", "task-old");
  });

  it("breaks updated ties by id deterministically", () => {
    const html = renderBoardHtml(
      [
        item({ id: "task-b", type: "task", status: "todo", updated: "2026-10-12" }),
        item({ id: "task-a", type: "task", status: "todo", updated: "2026-10-12" }),
        item({ id: "task-missing", type: "task", status: "todo", updated: null }),
      ],
      { generatedAt: GENERATED_AT },
    );
    assertOrder(html, "task-a", "task-b");
    assertOrder(html, "task-b", "task-missing");
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

  it("keeps every recorded non-text boundary at or above 3:1 (light)", () => {
    // The pairs recorded in the item body: [what, foreground, background].
    // The stylesheet names these colors through custom properties; the table
    // pins the values the light `:root` block binds (asserted verbatim below).
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

  it("keeps every dark-theme text pair at or above 4.5:1 (WCAG 1.4.3)", () => {
    // The dark `:root[data-theme="dark"]` block swaps values only; these are
    // its bindings, paired with every surface each value is painted on.
    const textPairs: Array<[string, string, string]> = [
      ["body text vs page", "#e6edf3", "#0d1117"], // 16.02
      ["body text vs column", "#e6edf3", "#161b22"], // 14.64
      ["body text vs card", "#e6edf3", "#22272e"], // 12.72
      ["body text vs dep-blocked card", "#e6edf3", "#1d232b"], // 13.39
      ["heading/assignee vs column", "#c9d1d9", "#161b22"], // 11.21
      ["heading/assignee vs card", "#c9d1d9", "#22272e"], // 9.73
      ["meta text vs card", "#8b949e", "#22272e"], // 4.88
      ["meta text vs dep-blocked card", "#8b949e", "#1d232b"], // 5.14
      ["meta text vs page", "#8b949e", "#0d1117"], // 6.15
      ["muted text vs column", "#9ea7b3", "#161b22"], // 7.11
      ["muted text vs card", "#9ea7b3", "#22272e"], // 6.18
      ["count text vs pill", "#c9d1d9", "#3d444d"], // 6.38
      ["label text vs chip", "#e6edf3", "#37414b"], // 8.80
      ["accent text vs card", "#4493f8", "#22272e"], // 4.85
      ["accent text vs column", "#4493f8", "#161b22"], // 5.58
      ["white on accent fill (p2/lens.active/confirm)", "#ffffff", "#1f6feb"], // 4.63
      ["white on p0 chip", "#ffffff", "#cf222e"], // 5.36
      ["white on p1 chip", "#ffffff", "#bc4c00"], // 5.03
      ["white on p3 chip", "#ffffff", "#59636e"], // 6.11
      ["white on toast", "#ffffff", "#424a53"], // 8.99
      ["open-pr green vs card", "#3fb950", "#22272e"], // 5.91
      ["closed/error red vs card", "#ff6a69", "#22272e"], // 5.38
      ["branch/merged purple vs card", "#ab7df8", "#22272e"], // 5.02
      ["blocked text vs blocked wash", "#f2a65a", "#3a2b1d"], // 6.72
      ["white on task type chip", "#ffffff", "#0c855d"], // 4.64
    ];
    for (const [what, fg, bg] of textPairs) {
      expect(ratio(fg, bg), what).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps every dark-theme non-text boundary at or above 3:1 (WCAG 1.4.11)", () => {
    const boundaries: Array<[string, string, string]> = [
      ["drop-target outline vs page", "#9ea7b3", "#0d1117"], // 7.78
      ["drop-target outline vs column", "#9ea7b3", "#161b22"], // 7.11
      ["count pill / drawer / move-menu border vs card", "#9ea7b3", "#22272e"], // 6.18
      ["lens chip border vs page", "#9ea7b3", "#0d1117"], // 7.78
      ["lens.active fill vs page", "#1f6feb", "#0d1117"], // 4.08
      ["lens.active fill vs column", "#1f6feb", "#161b22"], // 3.73
      ["lens.active fill vs card", "#1f6feb", "#22272e"], // 3.24
      ["focus ring / dragged outline vs card", "#4493f8", "#22272e"], // 4.85
    ];
    for (const [what, fg, bg] of boundaries) {
      expect(ratio(fg, bg), what).toBeGreaterThanOrEqual(3);
    }
  });

  it("binds the boundary grey through --muted in both themes (never the 1.3:1 #d0d4da light / 1.5:1 #30363d dark)", () => {
    // The light bindings: the recorded policy values.
    const lightRoot = rule(":root");
    expect(lightRoot).toContain("--muted: #666a6f");
    expect(lightRoot).toContain("--card: #fff");
    // The dark bindings.
    const darkRoot = css.match(/\[data-theme="dark"\] \{([^}]*)\}/)?.[1] ?? "";
    expect(darkRoot).not.toBe("");
    expect(darkRoot).toContain("--muted: #9ea7b3");
    expect(darkRoot).toContain("--card: #22272e");
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
      expect(rule(selector), selector).toContain("1px solid var(--muted)");
    }
    // The count pill is a passive indicator: its muted fill stays, the pill
    // edge is the recorded boundary, and its text pair (axe-enforced) is
    // 6.04:1 light / 6.38:1 dark.
    expect(rule(".column .count")).toContain("border: 1px solid var(--muted)");
    expect(ratio("#424a53", "#d0d4da")).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#c9d1d9", "#3d444d")).toBeGreaterThanOrEqual(4.5);
  });

  it("affords the dragged card with a lift, never a fade", () => {
    const dragging = rule(".card.dragging");
    expect(dragging).toContain("box-shadow");
    expect(dragging).toContain("outline: 2px solid var(--accent)");
    // No opacity declaration anywhere in the stylesheet: a fade composites
    // every descendant against the surface below it (measured 1.5-2.7:1), so
    // the state cue must come from surface, shadow and outline instead.
    expect(css).not.toMatch(/\bopacity\s*:/);
  });
});

describe("renderBoardHtml theme and density (task-board-theme-density)", () => {
  const renders = () => [
    ["static", renderBoardHtml([], { generatedAt: GENERATED_AT })] as const,
    [
      "serve",
      renderBoardHtml([], { generatedAt: GENERATED_AT, details: true, live: true }),
    ] as const,
  ];

  it("sets color-scheme per theme on the root so native controls match", () => {
    for (const [mode, html] of renders()) {
      expect(html, mode).toMatch(/:root \{[^}]*color-scheme: light/s);
      expect(html, mode).toMatch(/\[data-theme="dark"\] \{[^}]*color-scheme: dark/s);
    }
  });

  it("applies the theme/density before first paint (boot script in <head>)", () => {
    for (const [mode, html] of renders()) {
      const headEnd = html.indexOf("</head>");
      const boot = html.indexOf(bootBoardTheme.toString());
      expect(boot, mode).toBeGreaterThan(0);
      expect(boot, mode).toBeLessThan(headEnd);
      // The resolved attributes land on <html>, which the head script can
      // reach while the body is still empty.
      expect(html, mode).toContain("document.documentElement");
    }
  });

  it("renders the toggle pair in the filterbar of every board", () => {
    for (const [mode, html] of renders()) {
      expect(html, mode).toContain(
        '<button type="button" id="board-theme-toggle" class="layout-toggle">theme: auto</button>',
      );
      expect(html, mode).toContain(
        '<button type="button" id="board-density-toggle" class="layout-toggle" aria-pressed="false">compact density</button>',
      );
    }
  });

  it("embeds wireBoardTheme and calls it in every board's script", () => {
    for (const [mode, html] of renders()) {
      expect(html, mode).toContain(wireBoardTheme.toString());
      expect(html, mode).toContain("wireBoardTheme();");
    }
  });

  it("pins the localStorage keys and the corrupt-storage default fallback", () => {
    const boot = bootBoardTheme.toString();
    expect(boot).toContain('"arggon-board-theme-v1"');
    expect(boot).toContain('"arggon-board-density-v1"');
    expect(boot).toContain("prefers-color-scheme");
    expect(boot).toContain("localStorage.getItem");
    // Corrupt or missing storage degrades to auto/comfortable. Whitespace
    // varies between the tsc build and the tsx test transform, so match loose.
    expect(boot).toMatch(/theme\s*=\s*"auto"/);
    expect(boot).toMatch(/density\s*=\s*"comfortable"/);
    const wire = wireBoardTheme.toString();
    expect(wire).toContain("localStorage.setItem");
    // The theme cycle and the density flip drive the two buttons.
    expect(wire).toContain('"board-theme-toggle"');
    expect(wire).toContain('"board-density-toggle"');
  });

  it("swaps values only: dark and compact override custom properties, never rules", () => {
    for (const [mode, html] of renders()) {
      const css = (html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "").replace(
        /\/\*[\s\S]*?\*\//g,
        "",
      );
      // The dark block declares only custom properties (+ color-scheme).
      const dark = css.match(/\[data-theme="dark"\] \{([^}]*)\}/)?.[1] ?? "";
      expect(dark, mode).not.toBe("");
      for (const line of dark.split(";").filter((d) => d.trim() !== "")) {
        expect(line.trim(), mode).toMatch(/^(color-scheme|--[a-z-]+):/);
      }
      // Same for the compact block.
      const compact = css.match(/\[data-density="compact"\] \{([^}]*)\}/)?.[1] ?? "";
      expect(compact, mode).not.toBe("");
      for (const line of compact.split(";").filter((d) => d.trim() !== "")) {
        expect(line.trim(), mode).toMatch(/^--[a-z-]+:/);
      }
    }
  });

  it("keeps the density geometry var-driven and the card text readable", () => {
    for (const [mode, html] of renders()) {
      const css = (html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "").replace(
        /\/\*[\s\S]*?\*\//g,
        "",
      );
      const card = css.match(/\.card \{([^}]*)\}/)?.[1] ?? "";
      expect(card, mode).toContain("background: var(--card)");
      expect(card, mode).toContain("padding: var(--card-pad)");
      expect(card, mode).toContain("font-size: var(--card-font)");
      // Compact never drops the body text below 12px.
      expect(css).toMatch(/\[data-density="compact"\] \{[^}]*--card-font: 12px/s);
      // The grid itself is untouched by density: the column tracks and the
      // responsive fallback stay byte-identical.
      expect(css).toContain("grid-template-columns: repeat(5, minmax(220px, 1fr))");
      expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))");
    }
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
        acceptance_truncated: false,
        acceptance_complete: true,
        comments: [],
        hidden_comments: 0,
        dependencies: [],
        parent: null,
        children: [],
        open_descendants: 0,
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

  it("the drawer's `acceptance_complete` IS the gate's verdict, list or no list", () => {
    // The list and the verdict are two questions on purpose (ADR 0025): the rows
    // are rendered whole-body (history stays visible), while `acceptance_complete`
    // carries the done gate's own answer over the item's LIVE `## Acceptance`
    // section. These three items make the pair distinguishable in BOTH
    // directions, which is what a reviewer needs to see the drawer cannot
    // contradict the gate.
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-gate-"));
    const { conventionYml } = writeBranchedTree(dir);
    const storyDir = join(dir, "tasks/launch/auth/story-a");
    const bodies: Record<string, string> = {
      // ticked live section, unticked historical box in a dated comment
      "task-one":
        "# Task One\n\n## Acceptance\n\n- [x] real criterion\n\n## Notes\n\n### 2026-09-07 @user\n\n- [ ] original criterion\n",
      // untouched scaffold: no live criterion, every comment box ticked
      "task-two":
        "# Task Two\n\n## Acceptance\n\n<!-- The real acceptance criteria. -->\n\n## Notes\n\n### 2026-09-07 @user\n\n- [x] ticked in a comment\n",
      // unticked live criterion beside a ticked comment box
      "task-three":
        "# Task Three\n\n## Acceptance\n\n- [ ] open criterion\n\n## Notes\n\n- [x] history\n",
    };
    const expected = [
      { id: "task-one", complete: true, rows: ["[x] real criterion", "[ ] original criterion"] },
      { id: "task-two", complete: false, rows: ["[x] ticked in a comment"] },
      { id: "task-three", complete: false, rows: ["[ ] open criterion", "[x] history"] },
    ];
    for (const { id } of expected) {
      writeFileSync(
        join(storyDir, `${id}.md`),
        `---\ntype: task\nstatus: in_progress\nid: ${id}\nparent: story-a\nlabels: []\ncreated: "2026-09-07"\nupdated: "2026-09-07"\n---\n\n${bodies[id]}`,
        "utf8",
      );
    }
    const result = runBoard({
      cwd: dir,
      out: "out.html",
      generatedAt: GENERATED_AT,
      me: null,
      details: true,
    });
    const payloads = embeddedDetails(readFileSync(result.outPath, "utf8"));
    const byId = itemsById(loadItems(findTasksDir(dir)));
    for (const { id, complete, rows } of expected) {
      const detail = payloads[id]?.detail;
      expect(detail, id).toBeDefined();
      // The verdict field is the kernel's own answer — asserted against the
      // predicate, not against a copy of it.
      expect(detail?.acceptance_complete, id).toBe(!acceptanceGate(byId.get(id)!.body).gated);
      expect(detail?.acceptance_complete, `${id} (expected)`).toBe(complete);
      // The list still shows every row the item carries, history included.
      expect(
        detail?.acceptance.map((row) => `[${row.checked ? "x" : " "}] ${row.text}`.trim()),
        id,
      ).toEqual(rows);
    }
    expect(existsSync(conventionYml)).toBe(true);
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
    // ...and the acceptance rows come from the CANONICAL body, not the clipped
    // prose, so the prose cap cannot hide an unchecked criterion from the
    // drawer while the done gate still refuses (bug-three-acceptance-parsers-diverging).
    expect(detail.acceptance).toEqual([
      { text: "done row", checked: true, criterion: true },
      { text: "open row", checked: false, criterion: true },
    ]);
    expect(detail.acceptance_complete).toBe(false);
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

/**
 * Minimal dependency-free DOM stub for the drawer renderer tests below: this
 * repo ships no jsdom/happy-dom (dependency surface stays minimal), and
 * `renderBoardDetail` only needs createElement/appendChild/textContent plus
 * attribute and form-field property writes.
 */
type FakeElement = {
  tagName: string;
  className: string;
  children: FakeElement[];
  attributes: Record<string, string>;
  ownerDocument: FakeDocument | null;
  type: string;
  disabled: boolean;
  checked: boolean;
  href: string;
  target: string;
  rel: string;
  textContent: string;
  appendChild(child: FakeElement): FakeElement;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
};
type FakeDocument = { createElement(tag: string): FakeElement };

function makeFakeTree(): { container: FakeElement } {
  const doc: FakeDocument = {
    createElement(tag: string): FakeElement {
      const el: FakeElement = {
        tagName: tag.toUpperCase(),
        className: "",
        children: [],
        attributes: {},
        ownerDocument: doc,
        type: "",
        disabled: false,
        checked: false,
        href: "",
        target: "",
        rel: "",
        textContent: "",
        appendChild(child: FakeElement): FakeElement {
          el.children.push(child);
          return child;
        },
        setAttribute(name: string, value: string): void {
          el.attributes[name] = value;
        },
        getAttribute(name: string): string | null {
          return el.attributes[name] ?? null;
        },
      };
      return el;
    },
  };
  return { container: doc.createElement("div") };
}

function fakeDescendants(root: FakeElement): FakeElement[] {
  const out: FakeElement[] = [];
  const visit = (node: FakeElement): void => {
    for (const child of node.children) {
      out.push(child);
      visit(child);
    }
  };
  visit(root);
  return out;
}

function fakeRow(root: FakeElement, key: string): FakeElement | undefined {
  return fakeDescendants(root).find(
    (node) =>
      node.tagName === "DIV" &&
      node.className === "drawer-row" &&
      node.children.some((kid) => kid.tagName === "SPAN" && kid.textContent === key),
  );
}

function fakeSection(root: FakeElement, title: string): FakeElement | undefined {
  return fakeDescendants(root).find(
    (node) =>
      node.tagName === "SECTION" &&
      node.children.some((kid) => kid.tagName === "H3" && kid.textContent === title),
  );
}

function fakeDetailLinks(root: FakeElement): FakeElement[] {
  return fakeDescendants(root).filter(
    (node) => node.tagName === "A" && node.getAttribute("data-detail-id") !== null,
  );
}

describe("detail drawer hierarchy (task-web-board-hierarchy-links)", () => {
  function hierarchyPayload(
    detailOverrides: Partial<BoardDetailPayload["detail"]> = {},
    itemOverrides: Partial<WorkItem> = {},
  ): BoardDetailPayload {
    return {
      ok: true,
      item: item({
        id: "story-a",
        type: "story",
        status: "in_progress",
        title: "A",
        ...itemOverrides,
      }),
      detail: {
        prose: "body",
        prose_truncated: false,
        acceptance: [],
        acceptance_truncated: false,
        acceptance_complete: true,
        comments: [],
        hidden_comments: 0,
        dependencies: [],
        parent: null,
        children: [],
        open_descendants: 0,
        pr: null,
        ...detailOverrides,
      },
    };
  }

  function writeSiblingTree(dir: string): void {
    writeBranchedTree(dir);
    writeFileSync(
      join(dir, "tasks/launch/auth/story-a/task-two.md"),
      '---\ntype: task\nstatus: done\nid: task-two\nparent: story-a\nlabels: []\ncreated: "2026-09-07"\nupdated: "2026-09-07"\n---\n\n# Task Two\n',
      "utf8",
    );
  }

  it("resolves parent and children through the kernel parent edges", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-hierarchy-"));
    writeSiblingTree(dir);
    const items = loadItems(findTasksDir(dir));
    const map = buildBoardDetailMap({ root: dir, items });
    expect(map["task-one"].detail.parent).toEqual({ id: "story-a", status: "in_progress" });
    expect(map["task-one"].detail.children).toEqual([]);
    expect(map["story-a"].detail.parent).toEqual({ id: "launch", status: "todo" });
    expect(map["story-a"].detail.children).toEqual([
      { id: "task-one", status: "in_progress" },
      { id: "task-two", status: "done" },
    ]);
    expect(map["launch"].detail.parent).toBeNull();
    expect(map["launch"].detail.children).toEqual([{ id: "story-a", status: "in_progress" }]);
  });

  it("reports a dangling parent id with a null status instead of inventing one", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-hierarchy-dangling-"));
    writeSiblingTree(dir);
    writeFileSync(
      join(dir, "tasks/launch/auth/story-a/task-ghost.md"),
      '---\ntype: task\nstatus: todo\nid: task-ghost\nparent: ghost-parent\nlabels: []\ncreated: "2026-09-07"\nupdated: "2026-09-07"\n---\n\n# Task Ghost\n',
      "utf8",
    );
    const items = loadItems(findTasksDir(dir));
    const map = buildBoardDetailMap({ root: dir, items });
    expect(map["task-ghost"].detail.parent).toEqual({ id: "ghost-parent", status: null });
    expect(map["task-ghost"].detail.children).toEqual([]);
    // Nobody claims the ghost as a child.
    for (const payload of Object.values(map)) {
      expect(payload.detail.children.map((child) => child.id)).not.toContain("ghost-parent");
    }
  });

  it("links the parent and every child through data-detail-id anchors", () => {
    const { container } = makeFakeTree();
    renderBoardDetail(
      container as unknown as HTMLElement,
      hierarchyPayload(
        {
          parent: { id: "launch", status: "todo" },
          children: [
            { id: "task-one", status: "in_progress" },
            { id: "task-two", status: "done" },
          ],
        },
        { id: "story-a", type: "story", status: "in_progress", title: "A", parent: "launch" },
      ),
    );
    const parent = fakeRow(container, "parent");
    expect(parent).toBeDefined();
    const parentLinks = fakeDetailLinks(parent!);
    expect(parentLinks).toHaveLength(1);
    expect(parentLinks[0].getAttribute("data-detail-id")).toBe("launch");
    expect(parentLinks[0].getAttribute("href")).toBe("#launch");
    expect(parentLinks[0].textContent).toBe("launch · todo");
    const children = fakeSection(container, "children");
    expect(children).toBeDefined();
    const childLinks = fakeDetailLinks(children!);
    expect(childLinks.map((link) => link.getAttribute("data-detail-id"))).toEqual([
      "task-one",
      "task-two",
    ]);
    expect(childLinks.map((link) => link.textContent)).toEqual([
      "task-one · in_progress",
      "task-two · done",
    ]);
    // Every hierarchy anchor is keyboard-reachable through the drawer's
    // existing tab order: the focus trap collects exactly `a[href]`.
    for (const link of [...parentLinks, ...childLinks]) {
      expect(link.getAttribute("href")).not.toBeNull();
    }
  });

  it("renders honest empty states: parent none, children none, never a dead link", () => {
    const { container } = makeFakeTree();
    renderBoardDetail(
      container as unknown as HTMLElement,
      hierarchyPayload({ parent: null, children: [] }, { id: "launch", type: "initiative" }),
    );
    expect(fakeRow(container, "parent")?.children.map((kid) => kid.textContent)).toContain("none");
    const children = fakeSection(container, "children");
    expect(children).toBeDefined();
    expect(children?.children.map((kid) => kid.textContent)).toContain("none");
    expect(fakeDetailLinks(container)).toEqual([]);
  });

  it("renders a dangling parent as honest text, never a link", () => {
    const { container } = makeFakeTree();
    renderBoardDetail(
      container as unknown as HTMLElement,
      hierarchyPayload(
        { parent: { id: "ghost-parent", status: null }, children: [] },
        { id: "task-ghost", type: "task", status: "todo", parent: "ghost-parent" },
      ),
    );
    expect(fakeRow(container, "parent")?.children.map((kid) => kid.textContent)).toContain(
      "ghost-parent · missing",
    );
    expect(fakeDetailLinks(container)).toEqual([]);
  });

  it("renders hostile hierarchy ids as text, never markup", () => {
    const hostile = '<img src=x onerror="alert(1)">';
    const { container } = makeFakeTree();
    renderBoardDetail(
      container as unknown as HTMLElement,
      hierarchyPayload(
        { parent: { id: hostile, status: "todo" }, children: [{ id: hostile, status: "todo" }] },
        { id: "task-x", type: "task", status: "todo", parent: hostile },
      ),
    );
    const links = fakeDetailLinks(container);
    expect(links).toHaveLength(2);
    for (const link of links) {
      // Text node, not elements: nothing to execute, nothing to style-break.
      expect(link.children).toEqual([]);
      expect(link.textContent).toBe(hostile + " · todo");
      expect(link.getAttribute("href")).toBe("#" + encodeURIComponent(hostile));
      expect(link.getAttribute("data-detail-id")).toBe(hostile);
    }
    expect(
      fakeDescendants(container).some(
        (node) => node.tagName === "IMG" || node.tagName === "SCRIPT",
      ),
    ).toBe(false);
  });

  it("keeps hierarchy navigation in the text-only renderer and the delegated click", () => {
    expect(renderBoardDetail.toString()).toContain("data-detail-id");
    expect(renderBoardDetail.toString()).not.toContain("innerHTML");
    expect(wireBoardDetail.toString()).toContain("a[data-detail-id]");
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

  it("keeps the overlay failure bounded, so the trailing remedy is never clip-reachable", () => {
    // Recorded compliant by task-clip-class-sweep-remaining-sites (the sibling
    // item's F5 correction). The wrapper appends its
    // `(or run plain \`arggon board\` …)` remedy AFTER the kernel's detail,
    // which LOOKS like the remedy-after-detail clip class — but the detail
    // comes from the kernel's ghPrListJson, which runs gh with stderr IGNORED
    // (`stdio: ["ignore", "pipe", "ignore"]`), so it is Node's BOUNDED
    // `Command failed: gh … <argv>` echo — or the terse `gh not found (…)`
    // line when no gh binary exists — never an unbounded stderr tail. So this
    // drives the REAL wrapper (no `gh` injected: `opts.gh ?? defaultBoardGithub()`)
    // against a temp non-repo dir, where gh always fails, and pins the
    // composed bound on whichever bounded shape the environment produces.
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-gh-bounded-"));
    writeBranchedTree(dir);
    let message = "";
    try {
      runBoard({ cwd: dir, github: true, out: "out.html", generatedAt: GENERATED_AT, me: null });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    // The wrapper's own sentence and the kernel layer's remedy both arrive…
    expect(message).toContain("GitHub overlay unavailable:");
    expect(message).toContain("or run plain `arggon board`");
    expect(message).toContain("gh auth status");
    // …with more than 1000 chars of headroom under the human-channel clip, so
    // no ordering of these clauses can expose the remedy. The kernel-side
    // worst case (a 255-char branch / full argv echo) is measured in
    // lib/src/get-open-prs.test.ts and lib/src/cleanup.test.ts; a future edit
    // that interpolates anything unbounded into either layer fails here.
    expect(message.length).toBeLessThan(MAX_HUMAN_ERROR_CHARS);
    expect(MAX_HUMAN_ERROR_CHARS - message.length).toBeGreaterThan(1000);
  });
});

describe("renderBoardHtml dependency edges (spec-deps-022)", () => {
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
    expect(html).toContain('<div class="mgroup-head none">no story</div>');
    // Both story heads first, "no story" last within its column — one ordered
    // chain, with every clause pinned PRESENT by assertOrder (the two bare
    // `indexOf` comparisons it replaces passed vacuously on an absent needle).
    assertOrder(html, "⚑ story-a", "⚑ story-b", "no story");
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
      /unknown --group-by field 'priority' \(supported: milestone, story, tree\)/,
    );
  });
});

describe("renderBoardTree grouped ancestry (task-web-board-hierarchy-view)", () => {
  const chain = (): WorkItem[] => [
    item({ id: "ui", type: "epic", status: "todo", title: "UI" }),
    item({
      id: "story-board",
      type: "story",
      status: "in_progress",
      parent: "ui",
      title: "Board",
    }),
    item({
      id: "task-leaf",
      type: "task",
      status: "todo",
      parent: "story-board",
      title: "Leaf",
      priority: "p1",
    }),
    item({
      id: "bug-leaf",
      type: "bug",
      status: "blocked",
      parent: "story-board",
      title: "Bug",
      priority: "p0",
      blocked_reason: "waiting",
    }),
    item({ id: "story-z", type: "story", status: "done", parent: "ui", title: "Z" }),
  ];

  /**
   * The balanced `<li class="tree-node">…</li>` slice of one node, so nesting
   * is asserted structurally (a child id inside its parent's subtree is
   * nesting; a bare indexOf order would pass for a flat list too).
   */
  function treeNodeHtml(html: string, id: string): string {
    const at = html.indexOf(`data-id="${id}"`);
    expect(at, `tree node ${id} not rendered`).toBeGreaterThan(-1);
    const start = html.lastIndexOf("<li", at);
    expect(start).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = start; i < html.length; i++) {
      if (html.startsWith("<li", i)) {
        depth++;
        i += 2;
        continue;
      }
      if (html.startsWith("</li>", i)) {
        depth--;
        i += 4;
        if (depth === 0) return html.slice(start, i + 1);
      }
    }
    throw new Error(`unbalanced tree node markup for ${id}`);
  }

  it("nests every leaf under its story and story under epic, each level carrying id + status", () => {
    const html = renderBoardTree(chain());
    const story = treeNodeHtml(html, "story-board");
    expect(story).toContain('data-id="task-leaf"');
    expect(story).toContain('data-id="bug-leaf"');
    expect(story).not.toContain('data-id="story-z"');
    // Each level names its own type badge, id and status.
    expect(treeNodeHtml(html, "ui")).toContain(
      '<span class="type" data-type="epic" style="--type-color: #8458ea">epic</span>',
    );
    expect(story).toContain('<span class="status-chip in_progress">in_progress</span>');
    expect(treeNodeHtml(html, "bug-leaf")).toContain(
      '<span class="status-chip blocked">blocked</span>',
    );
    // Depth-first, id-sorted siblings — the shared view-model's walk order.
    assertOrder(
      html,
      'data-id="ui"',
      'data-id="story-board"',
      'data-id="bug-leaf"',
      'data-id="task-leaf"',
      'data-id="story-z"',
    );
  });

  it("nests the shared view-model's walk: roots, id-sorted children, cycle-safe", () => {
    const roots = boardTreeRoots(chain());
    expect(roots.map((node) => node.item.id)).toEqual(["ui"]);
    expect(roots[0].children.map((node) => node.item.id)).toEqual(["story-board", "story-z"]);
    expect(roots[0].children[0].children.map((node) => node.item.id)).toEqual([
      "bug-leaf",
      "task-leaf",
    ]);
    // A parent cycle renders as one root subtree (never lost, never doubled).
    const cyclic = boardTreeRoots([
      item({ id: "task-a", type: "task", status: "todo", parent: "task-b" }),
      item({ id: "task-b", type: "task", status: "todo", parent: "task-a" }),
    ]);
    expect(cyclic.map((node) => node.item.id)).toEqual(["task-a"]);
    expect(cyclic[0].children.map((node) => node.item.id)).toEqual(["task-b"]);
  });

  it("carries the leaf fields the columns carry: priority, assignee and the open-deps badge", () => {
    const html = renderBoardTree(
      chain().map((entry) => (entry.id === "bug-leaf" ? { ...entry, assignee: "alice" } : entry)),
      { openDeps: (entry) => (entry.id === "bug-leaf" ? ["task-leaf"] : []) },
    );
    const leaf = treeNodeHtml(html, "bug-leaf");
    expect(leaf).toContain('<span class="priority p0">p0</span>');
    expect(leaf).toContain('<span class="tree-assignee">@alice</span>');
    expect(leaf).toContain('<span class="tree-blocked">blocked by 1</span>');
    // The container has no open deps: no badge counter is invented. Its own
    // row is the slice before its children list (the subtree holds the leaf's
    // badge).
    const uiNode = treeNodeHtml(html, "ui");
    const uiRow = uiNode.slice(0, uiNode.indexOf('<ul class="tree-children">'));
    expect(uiRow).not.toContain("tree-blocked");
  });

  it("renders parentless and unknown-parent items as honest top-level rows", () => {
    const html = renderBoardTree([
      item({ id: "task-root", type: "task", status: "todo" }),
      item({ id: "task-orphan", type: "task", status: "todo", parent: "story-gone" }),
    ]);
    const orphan = treeNodeHtml(html, "task-orphan");
    expect(orphan).toContain("tree-node missing-parent");
    expect(orphan).toContain("↳ recorded parent story-gone (missing)");
    const root = treeNodeHtml(html, "task-root");
    expect(root).not.toContain("missing-parent");
    expect(root).not.toContain("(missing)");
    // No anchors anywhere: a dangling parent can never become a dead link.
    expect(html).not.toContain("<a ");
  });

  it("terminates on a parent cycle and renders each item exactly once", () => {
    const html = renderBoardTree([
      item({ id: "task-a", type: "task", status: "todo", parent: "task-b" }),
      item({ id: "task-b", type: "task", status: "todo", parent: "task-a" }),
    ]);
    expect(html.match(/data-id="task-a"/g)).toHaveLength(1);
    expect(html.match(/data-id="task-b"/g)).toHaveLength(1);
    expect(html).toContain('<ul class="tree-root">');
  });

  it("renders the columns' empty placeholder for an empty tracker", () => {
    expect(renderBoardTree([])).toBe('<div class="empty">—</div>');
  });

  it("escapes hostile ids, titles and parent ids like every other surface", () => {
    const html = renderBoardTree([
      item({
        id: "task-x",
        type: "task",
        status: "todo",
        title: "</script><img src=x onerror=alert(1)>",
        parent: '"><script>',
      }),
    ]);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;/script&gt;");
    expect(html).toContain("recorded parent &quot;&gt;&lt;script&gt; (missing)");
  });

  it("carries a disclosure control on every container row, a spacer on leaves (task-tree-rows-open-detail)", () => {
    const html = renderBoardTree(chain());
    // Containers: the column controls' `–`/`+` shape, named for the subtree.
    expect(treeNodeHtml(html, "story-board")).toContain(
      '<button type="button" class="tree-toggle" aria-expanded="true" aria-label="collapse story-board subtree">&ndash;</button>',
    );
    expect(treeNodeHtml(html, "ui")).toContain('class="tree-toggle"');
    // Leaves keep the id alignment without owning a fold they cannot make.
    const leaf = treeNodeHtml(html, "task-leaf");
    expect(leaf).toContain('<span class="tree-toggle-spacer" aria-hidden="true"></span>');
    expect(leaf).not.toContain('tree-toggle"');
    // The match marker ships hidden and empty: the client owns the count.
    expect(treeNodeHtml(html, "story-board")).toContain(
      '<span class="tree-matches" hidden></span>',
    );
    expect(html.match(/class="tree-matches"/g)).toHaveLength(2);
    // Still no anchors: folding adds a button, never a link.
    expect(html).not.toContain("<a ");
  });

  it("makes rows focusable and named only when interactive, inert otherwise", () => {
    const inert = renderBoardTree(chain());
    expect(inert).not.toContain("tabindex=");
    expect(inert).not.toContain('role="group"');

    const interactive = renderBoardTree(chain(), { interactive: true });
    // Exactly one roving anchor, like the cards; every row is named.
    expect(interactive.match(/tabindex="0"/g)).toHaveLength(1);
    expect(interactive.match(/role="group"/g)).toHaveLength(5);
    expect(interactive).toContain(
      'role="group" aria-label="epic ui: UI (todo, 3 open descendants)" tabindex="0"',
    );
    expect(interactive).toContain(
      'role="group" aria-label="story story-board: Board (in_progress, 2 open descendants)" tabindex="-1"',
    );
    // The first row in the pre-order walk is the anchor.
    const first = interactive.indexOf('data-id="ui"');
    const anchor = interactive.indexOf('tabindex="0"');
    expect(anchor).toBeGreaterThan(first);
    expect(anchor).toBeLessThan(interactive.indexOf('data-id="story-board"'));
  });
});

describe("renderBoardTree open-descendant disclosure (bug-tree-done-container-hides-open-work)", () => {
  /**
   * The measured shape the report described: a DONE container whose subtree
   * still holds open work, at every depth. `init` → `epic-a` → `story-a` are
   * all terminal, while the open items sit three levels down; `task-done` and
   * `bug-cancelled` are terminal and must not count. `epic-b` is the other
   * direction: a done container whose whole subtree is terminal (no badge).
   */
  const tree = (): WorkItem[] => [
    item({ id: "init", type: "initiative", status: "done", title: "Init" }),
    item({ id: "epic-a", type: "epic", status: "done", parent: "init", title: "A" }),
    item({ id: "story-a", type: "story", status: "done", parent: "epic-a", title: "S" }),
    item({ id: "task-open", type: "task", status: "todo", parent: "story-a", title: "Open" }),
    item({
      id: "task-wip",
      type: "task",
      status: "in_progress",
      parent: "story-a",
      assignee: "alice",
      title: "Wip",
    }),
    item({
      id: "bug-blocked",
      type: "bug",
      status: "blocked",
      parent: "story-a",
      title: "Blocked",
    }),
    item({ id: "task-done", type: "task", status: "done", parent: "story-a", title: "Done" }),
    item({
      id: "bug-cancelled",
      type: "bug",
      status: "cancelled",
      parent: "story-a",
      title: "Cancelled",
    }),
    item({ id: "epic-b", type: "epic", status: "done", parent: "init", title: "B" }),
    item({ id: "task-b-done", type: "task", status: "done", parent: "epic-b", title: "B done" }),
  ];

  /**
   * The node's OWN `<div class="tree-row">…</div>` slice: the badge on a
   * container must not be confused with a descendant's badge, and a leaf's
   * absence assertion must not read a sibling's. The row holds no nested div,
   * so the first `</div>` after the row's opening tag closes it.
   */
  function rowHtml(html: string, id: string): string {
    const at = html.indexOf(`data-id="${id}"`);
    expect(at, `tree node ${id} not rendered`).toBeGreaterThan(-1);
    const start = html.indexOf('<div class="tree-row"', at);
    expect(start, `tree row ${id} not rendered`).toBeGreaterThan(-1);
    return html.slice(start, html.indexOf("</div>", start));
  }

  /** The node's own `<li …>` opening tag (attributes only). */
  function nodeTag(html: string, id: string): string {
    const at = html.indexOf(`data-id="${id}"`);
    expect(at, `tree node ${id} not rendered`).toBeGreaterThan(-1);
    return html.slice(html.lastIndexOf("<li", at), html.indexOf(">", at));
  }

  it("discloses the open descendants of a terminal container at every depth, after the displayed status chip", () => {
    const html = renderBoardTree(tree());
    for (const id of ["init", "epic-a", "story-a"]) {
      const row = rowHtml(html, id);
      // Three open descendants: the todo task, the in_progress task and the
      // blocked bug. The done task and the cancelled bug are terminal.
      expect(row, id).toContain('<span class="tree-open">3 open</span>');
      // The chip carries the DISPLAYED status (task-board-no-done-over-open-work):
      // authored `done` + open work below reads `open`, never `done`.
      expect(row, id).toContain('<span class="status-chip open">open</span>');
      expect(row, id).not.toContain("status-chip done");
      // The badge sits right after the chip, before priority/title/assignee.
      assertOrder(
        row,
        '<span class="status-chip open">open</span>',
        '<span class="tree-open">3 open</span>',
        {
          text: '<span class="tree-title">',
          optional: true,
        },
      );
    }
    // The stored status stays on the node (the closure record every existing
    // reader sees); the derived one rides `data-display-status` beside it.
    expect(nodeTag(html, "init")).toContain('data-status="done" data-display-status="open"');
    // The open work is three levels below the initiative: a direct-children
    // count would have answered 0 here, so this pins "all depths".
    expect(rowHtml(html, "epic-a")).toContain("3 open");
  });

  it("renders no badge and the authored chip for a zero-open container or for any leaf row", () => {
    const html = renderBoardTree(tree());
    // A done epic whose whole subtree is terminal: nothing to disclose, and the
    // authored chip stays (the mask needs open work below).
    expect(rowHtml(html, "epic-b")).not.toContain("tree-open");
    expect(rowHtml(html, "epic-b")).toContain('<span class="status-chip done">done</span>');
    expect(nodeTag(html, "epic-b")).not.toContain("data-display-status");
    expect(rowHtml(html, "task-b-done")).not.toContain("tree-open");
    // Leaves never carry it, open or not.
    expect(rowHtml(html, "task-open")).not.toContain("tree-open");
    expect(rowHtml(html, "bug-blocked")).not.toContain("tree-open");
    // A container that is ITSELF open but whose descendants are all terminal
    // gets no badge either: the badge counts descendants, never the row.
    const openContainer = renderBoardTree([
      item({ id: "story-x", type: "story", status: "in_progress", title: "X" }),
      item({ id: "task-x", type: "task", status: "done", parent: "story-x", title: "X done" }),
    ]);
    expect(rowHtml(openContainer, "story-x")).not.toContain("tree-open");
    expect(rowHtml(openContainer, "story-x")).toContain(
      '<span class="status-chip in_progress">in_progress</span>',
    );
    expect(nodeTag(openContainer, "story-x")).not.toContain("data-display-status");
  });

  it("counts only open descendants: a cancelled subtree discloses nothing", () => {
    const html = renderBoardTree([
      item({ id: "story-c", type: "story", status: "done", title: "C" }),
      item({ id: "task-c", type: "task", status: "cancelled", parent: "story-c", title: "C task" }),
      item({ id: "bug-c", type: "bug", status: "cancelled", parent: "story-c", title: "C bug" }),
    ]);
    expect(rowHtml(html, "story-c")).toContain('<span class="status-chip done">done</span>');
    expect(rowHtml(html, "story-c")).not.toContain("tree-open");
    expect(nodeTag(html, "story-c")).not.toContain("data-display-status");
  });

  it("announces the displayed state and the disclosure in the row's accessible name (interactive), inert otherwise", () => {
    const inert = renderBoardTree(tree());
    expect(inert).toContain('<span class="tree-open">3 open</span>');
    expect(inert).not.toContain('role="group"');

    const interactive = renderBoardTree(tree(), { interactive: true });
    expect(interactive).toContain(
      'role="group" aria-label="initiative init: Init (open, 3 open descendants)" tabindex="0"',
    );
    // A zero-open container's name is byte-identical to the pre-disclosure one.
    expect(interactive).toContain('role="group" aria-label="epic epic-b: B (done)" tabindex="-1"');
  });

  it("renders the same disclosure and display in the static export and the served board, from the complete set", () => {
    const items = tree();
    const boards = [
      ["static", renderBoardHtml(items, { generatedAt: GENERATED_AT, groupBy: "tree" })],
      [
        "serve",
        renderBoardHtml(items, {
          generatedAt: GENERATED_AT,
          groupBy: "tree",
          details: true,
          live: true,
        }),
      ],
    ] as const;
    for (const [mode, html] of boards) {
      expect(html, mode).toContain('<span class="tree-open">3 open</span>');
      expect(html, mode).toContain('<span class="status-chip open">open</span>');
    }
    // The accessible name rides the interactive (details-mode) rows, which the
    // served board renders; the drawer-free static export stays inert. Scope
    // both to the tree section: the status columns' CARDS carry their own
    // `role="group"` labels on every board.
    const treeOf = (html: string): string => html.slice(html.indexOf('<section class="tree"'));
    expect(treeOf(boards[1][1])).toContain(
      'aria-label="initiative init: Init (open, 3 open descendants)"',
    );
    expect(treeOf(boards[0][1])).not.toContain('aria-label="initiative init:');
    // The count is baked into the markup at render: no client controller ever
    // writes the badge, so hiding terminal rows, a lens or a fold cannot move
    // it (the composition itself is pinned by the @smoke lane).
    for (const controller of [wireBoardColumns, wireBoardView, applyBoardFilter]) {
      expect(controller.toString()).not.toContain("tree-open");
    }
  });

  it("stays total on a parent cycle and counts the rendered subtree exactly once", () => {
    const html = renderBoardTree([
      item({ id: "task-a", type: "task", status: "todo", parent: "task-b" }),
      item({ id: "task-b", type: "task", status: "todo", parent: "task-a" }),
    ]);
    expect(html.match(/data-id="task-a"/g)).toHaveLength(1);
    expect(html.match(/data-id="task-b"/g)).toHaveLength(1);
    // Rendered as task-a → task-b (the shared walk's shape): one open
    // descendant below task-a, none below the last node of the cycle.
    expect(rowHtml(html, "task-a")).toContain('<span class="tree-open">1 open</span>');
    expect(rowHtml(html, "task-b")).not.toContain("tree-open");
  });
});

describe("derived displayed status (task-board-no-done-over-open-work)", () => {
  /**
   * The mask matrix in one tree: a `done` container over open work (masked), a
   * `done` container whose subtree is fully terminal (unmasked), an open
   * container (unmasked, authored), a `cancelled` container over open work
   * (deliberately unmasked) and leaf rows of every status.
   */
  const tree = (): WorkItem[] => [
    item({ id: "init", type: "initiative", status: "done", title: "Init" }),
    item({ id: "story-open", type: "story", status: "done", parent: "init", title: "Open work" }),
    item({ id: "task-open", type: "task", status: "todo", parent: "story-open", title: "Todo" }),
    item({
      id: "task-wip",
      type: "task",
      status: "in_progress",
      parent: "story-open",
      title: "Wip",
    }),
    item({
      id: "bug-blocked",
      type: "bug",
      status: "blocked",
      parent: "story-open",
      title: "Blocked",
    }),
    item({ id: "task-done", type: "task", status: "done", parent: "story-open", title: "Done" }),
    item({ id: "story-clean", type: "story", status: "done", parent: "init", title: "Clean" }),
    item({ id: "task-clean-done", type: "task", status: "done", parent: "story-clean" }),
    item({ id: "story-wip", type: "story", status: "in_progress", parent: "init", title: "Wip" }),
    item({ id: "task-wip-child", type: "task", status: "todo", parent: "story-wip" }),
    item({
      id: "story-cancelled",
      type: "story",
      status: "cancelled",
      parent: "init",
      title: "Canc",
    }),
    item({ id: "task-cancelled-child", type: "task", status: "todo", parent: "story-cancelled" }),
    item({
      id: "task-done-leaf",
      type: "task",
      status: "done",
      parent: "init",
      title: "Done leaf",
    }),
  ];

  function rowOf(html: string, id: string): string {
    const treeStart = html.indexOf('<section class="tree"');
    const tree = treeStart === -1 ? html : html.slice(treeStart);
    const at = tree.indexOf(`data-id="${id}"`);
    expect(at, `tree node ${id} not rendered`).toBeGreaterThan(-1);
    const start = tree.indexOf('<div class="tree-row"', at);
    expect(start, `tree row ${id} not rendered`).toBeGreaterThan(-1);
    return tree.slice(start, tree.indexOf("</div>", start));
  }

  function cardOf(html: string, id: string): string {
    const boardStart = html.indexOf('<main class="board"');
    const board = boardStart === -1 ? html : html.slice(boardStart);
    const at = board.indexOf(`data-id="${id}"`);
    expect(at, `card ${id} not rendered`).toBeGreaterThan(-1);
    const start = board.lastIndexOf("<div", at);
    return board.slice(start, board.indexOf("</div>", start));
  }

  function nodeTagOf(html: string, id: string): string {
    const at = html.indexOf(`data-id="${id}"`);
    expect(at, `tree node ${id} not rendered`).toBeGreaterThan(-1);
    return html.slice(html.lastIndexOf("<li", at), html.indexOf(">", at));
  }

  it("renders `open` for a done container with open work and `done` for a terminal subtree", () => {
    const html = renderBoardTree(tree());
    // Masked: the container itself and every done container above it. `init`
    // holds six open items across its subtree (three under `story-open`, the
    // wip story itself plus its child, and the cancelled story's open child);
    // `story-open` holds its own three.
    expect(rowOf(html, "init")).toContain('<span class="status-chip open">open</span>');
    expect(rowOf(html, "init")).toContain('<span class="tree-open">6 open</span>');
    expect(rowOf(html, "init")).not.toContain("status-chip done");
    expect(rowOf(html, "story-open")).toContain('<span class="status-chip open">open</span>');
    expect(rowOf(html, "story-open")).toContain('<span class="tree-open">3 open</span>');
    // Unmasked: a done container whose whole subtree is terminal keeps `done`.
    expect(rowOf(html, "story-clean")).toContain('<span class="status-chip done">done</span>');
    expect(rowOf(html, "story-clean")).not.toContain("tree-open");
    // Open containers keep their authored status (the mask is only `done`).
    expect(rowOf(html, "story-wip")).toContain(
      '<span class="status-chip in_progress">in_progress</span>',
    );
    // Cancelled is deliberately NOT masked: a cancelled scope reads abandoned,
    // not finished — even with open work inside it still discloses the count.
    expect(rowOf(html, "story-cancelled")).toContain(
      '<span class="status-chip cancelled">cancelled</span>',
    );
    expect(rowOf(html, "story-cancelled")).not.toContain("status-chip open");
    expect(rowOf(html, "story-cancelled")).toContain('<span class="tree-open">1 open</span>');
    // Leaves render their authored status, done and open alike.
    expect(rowOf(html, "task-done-leaf")).toContain('<span class="status-chip done">done</span>');
    expect(rowOf(html, "task-open")).toContain('<span class="status-chip todo">todo</span>');
    expect(rowOf(html, "task-wip")).toContain(
      '<span class="status-chip in_progress">in_progress</span>',
    );
    expect(rowOf(html, "bug-blocked")).toContain(
      '<span class="status-chip blocked">blocked</span>',
    );
  });

  it("keeps the stored status on data-status and only adds data-display-status when masked", () => {
    const html = renderBoardTree(tree());
    expect(html).toContain('data-status="done" data-display-status="open"');
    // Unmasked nodes carry no display attribute at all: their markup is the
    // pre-change shape, so no existing reader or test sees a new attribute.
    for (const id of ["story-clean", "story-wip", "story-cancelled", "task-done-leaf"]) {
      expect(nodeTagOf(html, id), id).not.toContain("data-display-status");
    }
  });

  it("applies the same mask to the column cards, with the chip, the count and the card name", () => {
    const html = renderBoardHtml(tree(), { generatedAt: GENERATED_AT, details: true });
    // The masked container's CARD (done column) reads open, carries the same
    // disclosure and announces the displayed state plus the count.
    const card = cardOf(html, "story-open");
    expect(card).toContain('<span class="status-chip open">open</span>');
    expect(card).toContain('<span class="tree-open">3 open</span>');
    expect(card).toContain('data-display-status="open"');
    expect(card).toContain('data-status="done"');
    expect(html).toContain('aria-label="story story-open: Open work (open, 3 open descendants)"');
    // Every other card is byte-identical to the pre-change shape: authored
    // chip-less markup, no display attribute.
    for (const id of ["story-clean", "story-cancelled", "task-done-leaf", "task-open"]) {
      const other = cardOf(html, id);
      expect(other, id).not.toContain("data-display-status");
      expect(other, id).not.toContain("status-chip");
    }
    // The tree and the columns read the SAME count from the same walk.
    expect(rowOf(html, "story-open")).toContain('<span class="tree-open">3 open</span>');
  });

  it("reads the displayed status in the terminal rule of both layouts", () => {
    // The controller is embedded verbatim; the pins below are its two reads:
    // the tree node's terminal verdict and the per-card hide in the columns.
    const source = wireBoardColumns.toString();
    expect(source).toContain(
      'node.getAttribute("data-display-status") || node.getAttribute("data-status")',
    );
    expect(source).toContain('card.classList.toggle("terminal-hidden", hide)');
    expect(source).toContain(
      'col.classList.toggle("terminal-hidden", terminalColumn && kept === 0)',
    );
    // The keyboard roving anchor never lands on a hidden card.
    expect(wireBoardKeyboardNav.toString()).toContain(
      ".card:not(.filtered-out):not(.terminal-hidden)",
    );
  });

  it("explains the effective status in the drawer payload while keeping the stored one", () => {
    // The payload carries the same server-side count (additive field), and the
    // renderer keeps the stored chip plus the explanation.
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-display-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 1\n", "utf8");
    writeFileSync(
      join(dir, "tasks", "story-a.md"),
      '---\ntype: story\nid: story-a\ntitle: A\nstatus: done\ncreated: "2026-09-15"\nupdated: "2026-09-15"\n---\n',
      "utf8",
    );
    writeFileSync(
      join(dir, "tasks", "task-a.md"),
      '---\ntype: task\nid: task-a\ntitle: A task\nstatus: todo\nparent: story-a\ncreated: "2026-09-15"\nupdated: "2026-09-15"\n---\n',
      "utf8",
    );
    const items = loadItems(findTasksDir(dir));
    const map = buildBoardDetailMap({ root: dir, items });
    expect(map["story-a"].detail.open_descendants).toBe(1);
    expect(map["task-a"].detail.open_descendants).toBe(0);

    const masked = makeFakeTree();
    renderBoardDetail(masked.container as unknown as HTMLElement, map["story-a"]);
    const maskedNodes = fakeDescendants(masked.container);
    expect(maskedNodes.find((node) => node.className === "status")?.textContent).toBe("done");
    expect(maskedNodes.find((node) => node.className === "drawer-reads-open")?.textContent).toBe(
      "reads open \u00b7 1 open below",
    );

    // An unmasked item renders no explanation at all.
    const plain = makeFakeTree();
    renderBoardDetail(plain.container as unknown as HTMLElement, map["task-a"]);
    expect(
      fakeDescendants(plain.container).some((node) => node.className === "drawer-reads-open"),
    ).toBe(false);
  });

  it("renders identically in the static export and the served board (shared renderer)", () => {
    const items = tree();
    const staticHtml = renderBoardHtml(items, { generatedAt: GENERATED_AT });
    const serveHtml = renderBoardHtml(items, {
      generatedAt: GENERATED_AT,
      details: true,
      live: true,
    });
    // Same mask, same counts in both modes: only the details chrome differs.
    for (const html of [staticHtml, serveHtml]) {
      expect(html).toContain('<span class="status-chip open">open</span>');
      expect(html).toContain('<span class="tree-open">3 open</span>');
    }
    expect(staticHtml).toContain(
      'aria-label="story story-open: Open work (open, 3 open descendants)"',
    );
    expect(serveHtml).toContain(
      'aria-label="story story-open: Open work (open, 3 open descendants)"',
    );
  });
});

describe("boardTreeDisplay (the lens inside the grouped-ancestry view)", () => {
  const items = [
    { id: "ini", parent: null },
    { id: "epic", parent: "ini" },
    { id: "story", parent: "epic" },
    { id: "task", parent: "story" },
    { id: "other", parent: null },
  ];

  it("keeps the matched rows plus the ancestor path, marking ancestors as context", () => {
    const display = boardTreeDisplay(items, ["task"]);
    expect(Object.keys(display.shown).sort()).toEqual(["epic", "ini", "story", "task"]);
    expect(Object.keys(display.context).sort()).toEqual(["epic", "ini", "story"]);
    // A match is never context, even when it also sits on another match's path.
    expect(display.context["task"]).toBeUndefined();
    expect(display.shown["other"]).toBeUndefined();
  });

  it("never reveals a matched container's non-matching descendants", () => {
    const display = boardTreeDisplay(items, ["story"]);
    expect(Object.keys(display.shown).sort()).toEqual(["epic", "ini", "story"]);
    expect(display.shown["task"]).toBeUndefined();
  });

  it("shows nothing when nothing matches", () => {
    const display = boardTreeDisplay(items, []);
    expect(Object.keys(display.shown)).toEqual([]);
    expect(Object.keys(display.context)).toEqual([]);
  });

  it("is cycle-safe and prototype-safe", () => {
    const display = boardTreeDisplay(
      [
        { id: "task-a", parent: "task-b" },
        { id: "task-b", parent: "task-a" },
        { id: "constructor", parent: null },
      ],
      ["task-a"],
    );
    expect(Object.keys(display.shown).sort()).toEqual(["task-a", "task-b"]);
    // `constructor` is an id, not a prototype hit: it shows only when matched.
    expect(display.shown["constructor"]).toBeUndefined();
  });
});

describe("renderBoardHtml grouped-ancestry view (task-web-board-hierarchy-view)", () => {
  const treeItems = (): WorkItem[] => [
    item({ id: "ui", type: "epic", status: "todo", title: "UI" }),
    item({ id: "story-a", type: "story", status: "todo", parent: "ui", title: "A" }),
    item({ id: "task-a", type: "task", status: "todo", parent: "story-a", title: "Leaf" }),
  ];

  it("opens in the ancestry tree with --group-by tree, and in the columns by default", () => {
    const tree = renderBoardHtml(treeItems(), { generatedAt: GENERATED_AT, groupBy: "tree" });
    expect(tree).toContain('<main class="board" aria-label="arggon board" hidden>');
    expect(tree).toContain(
      '<section class="tree" id="board-tree" aria-labelledby="board-tree-heading">',
    );
    expect(tree).toContain('aria-pressed="true">grouped ancestry</button>');

    const columns = renderBoardHtml(treeItems(), { generatedAt: GENERATED_AT });
    expect(columns).toContain('<main class="board" aria-label="arggon board">');
    expect(columns).toContain(
      '<section class="tree" id="board-tree" aria-labelledby="board-tree-heading" hidden>',
    );
    expect(columns).toContain('aria-pressed="false">grouped ancestry</button>');
  });

  it("gates tree-row interactivity on details mode, so a drawer-free export has no fake affordance", () => {
    const plain = renderBoardHtml(treeItems(), { generatedAt: GENERATED_AT });
    // No drawer payload, no endpoint, no focusable rows — but the fold control
    // still ships (it folds, it never opens). The pointer-cursor rule is inert
    // without the details body attribute.
    expect(plain).not.toContain('data-detail-endpoint="/api/item"');
    expect(plain).toContain("body[data-detail-endpoint] .tree-row { cursor: pointer; }");
    expect(plain).not.toContain('tabindex="0"');
    expect(plain).toContain('class="tree-toggle"');

    const serve = renderBoardHtml(treeItems(), {
      generatedAt: GENERATED_AT,
      details: true,
      live: true,
    });
    expect(serve).toContain('data-detail-endpoint="/api/item"');
    expect(serve).toContain(
      'role="group" aria-label="epic ui: UI (todo, 2 open descendants)" tabindex="0"',
    );
    // The drawer's delegated handlers accept rows beside cards; the id comes
    // from the node, so the row markup keeps exactly one data-id per item.
    expect(wireBoardDetail.toString()).toContain('.closest(".card, .tree-row")');
    expect(wireBoardDetail.toString()).toContain('closest(".tree-node")');
  });

  it("carries BOTH layouts on every board, so the in-page toggle needs no server", () => {
    const boards = [
      ["static", renderBoardHtml(treeItems(), { generatedAt: GENERATED_AT })],
      [
        "serve",
        renderBoardHtml(treeItems(), { generatedAt: GENERATED_AT, details: true, live: true }),
      ],
    ] as const;
    for (const [mode, html] of boards) {
      expect(html, mode).toContain('<ul class="tree-root">');
      expect(html, mode).toContain('id="board-tree-heading"');
      expect(html, mode).toContain('id="board-tree-count"');
      expect(html, mode).toContain(boardTreeDisplay.toString());
      expect(html, mode).toContain(wireBoardView.toString());
      expect(html, mode).toContain("wireBoardView(");
      // The tree subsumes nothing: the status columns stay rendered.
      expect(html, mode).toContain('data-status="todo"');
    }
  });

  it("keeps milestone/story within-column grouping working alongside the tree", () => {
    const html = renderBoardHtml(treeItems(), { generatedAt: GENERATED_AT, groupBy: "story" });
    expect(html).toContain("⚑ story-a");
    expect(html).toContain('<ul class="tree-root">');
    expect(html).toContain('<main class="board" aria-label="arggon board">');
  });

  it("round-trips the view through the URL hash, beside the lens filter", () => {
    const plain = renderBoardHtml([], { generatedAt: GENERATED_AT });
    expect(plain).toContain('var BOARD_VIEW_DEFAULT = "columns";');
    expect(plain).toContain('hashParam("view")');
    expect(plain).toContain('parts.push("view=" + view)');
    expect(plain).toContain("applyHashView()");
    const treeDefault = renderBoardHtml([], { generatedAt: GENERATED_AT, groupBy: "tree" });
    expect(treeDefault).toContain('var BOARD_VIEW_DEFAULT = "tree";');
  });

  it("counts the lens verdict, never the rendered rows (N of M stays honest)", () => {
    const html = renderBoardHtml(treeItems(), { generatedAt: GENERATED_AT });
    // The tree's context rows are display-only: the counter and the tree
    // heading both read the match count the lens returned.
    expect(html).toContain("refreshFilterCount(visibleIds.length)");
    expect(html).toContain("boardTreeDisplay(BOARD_ITEMS, visibleIds)");
  });

  it("runBoard accepts and reports groupBy tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-group-tree-"));
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
      groupBy: "tree",
      me: null,
    });
    expect(result.groupBy).toBe("tree");
    const html = readFileSync(result.outPath, "utf8");
    expect(html).toContain('<main class="board" aria-label="arggon board" hidden>');
    expect(html).toContain('<section class="tree" id="board-tree"');
  });

  it("keeps every status-chip pair and the open-descendant badge at or above 4.5:1 in both themes (WCAG 1.4.3)", () => {
    const html = renderBoardHtml([], { generatedAt: GENERATED_AT });
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
    function ratio(fg: string, bg: string): number {
      const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      return (l1 + 0.05) / (l2 + 0.05);
    }
    function block(selector: string): string {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = css.match(new RegExp(`${escaped} \\{([^}]*)\\}`));
      expect(match, `rule not found in rendered CSS: ${selector}`).toBeTruthy();
      return match![1];
    }
    function declared(blockText: string, property: string): string {
      const match = new RegExp(`${property}: (#[0-9a-f]{3,6})`).exec(blockText);
      expect(match, `property not found: ${property}`).toBeTruthy();
      return match![1];
    }
    // The derived displayed chip (task-board-no-done-over-open-work) is a real
    // status-chip modifier (`.status-chip.open`), so it is measured with the
    // same bar as the authored statuses.
    const statuses = ["todo", "in_progress", "blocked", "done", "cancelled", "open"];
    for (const [theme, selector] of [
      ["light", ":root"],
      ["dark", ':root[data-theme="dark"]'],
    ] as const) {
      const declarations = block(selector);
      for (const status of statuses) {
        const fg = declared(declarations, `--st-${status.replace(/_/g, "-")}-fg`);
        const bg = declared(declarations, `--st-${status.replace(/_/g, "-")}-bg`);
        expect(ratio(fg, bg), `${theme} ${status} chip (${fg} on ${bg})`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
      // The open-descendant badge (bug-tree-done-container-hides-open-work)
      // reuses the badge geometry on the neutral chip pair — resolve both
      // custom properties per theme and measure the same 10px bold bar. The
      // geometry is a grouped rule (`.tree-blocked, .tree-open`), so collect
      // every `.tree-open` rule and read the colors one.
      const badgeRules = [...css.matchAll(/\.tree-open \{([^}]*)\}/g)].map((match) => match[1]);
      expect(badgeRules, `${theme} .tree-open rules`).toHaveLength(2);
      const badge = badgeRules.find((rule) => rule.includes("color:")) ?? "";
      expect(badge, theme).toContain("color: var(--fg-soft)");
      expect(badge, theme).toContain("background: var(--chip)");
      const badgeFg = declared(declarations, "--fg-soft");
      const badgeBg = declared(declarations, "--chip");
      expect(
        ratio(badgeFg, badgeBg),
        `${theme} tree-open badge (${badgeFg} on ${badgeBg})`,
      ).toBeGreaterThanOrEqual(4.5);
    }
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
      // task-board-no-done-over-open-work: a card reads its own displayed
      // status, so the toggle hides it individually and keeps the column when
      // a masked container is inside it.
      expect(html, mode).toContain(".card.terminal-hidden { display: none; }");
      // bug-tree-ignores-hide-terminal-toggle: the same layout preference
      // hides terminal rows in the tree, mutes the terminal rows it must keep
      // as context, and gives an all-hidden tree the columns' `—` placeholder.
      expect(html, mode).toContain(
        ".tree-node.filtered-out, .tree-node.terminal-hidden { display: none; }",
      );
      expect(html, mode).toContain(
        ".tree-node.context > .tree-row, .tree-node.terminal-context > .tree-row",
      );
      expect(html, mode).toContain(".column .empty, .tree .empty");
    }
  });

  it("embeds wireBoardColumns and calls it in every board's script", () => {
    for (const [mode, html] of renders()) {
      expect(html, mode).toContain(wireBoardColumns.toString());
      expect(html, mode).toContain(
        "var boardColumns = wireBoardColumns(keyboardNav ? keyboardNav.ensureAnchor : null);",
      );
    }
  });

  it("composes the terminal rule into the tree through the lens-refresh handle", () => {
    // The columns are hidden by a class list the layout owns; the tree's rule
    // needs the lens verdict (a `context` ancestor must survive) and must be
    // recomputed after every lens refresh, hence the returned handle.
    for (const [mode, html] of renders()) {
      expect(html, mode).toContain("boardColumns.syncTree(hasLens)");
    }
    const source = wireBoardColumns.toString();
    expect(source).toContain('document.getElementById("board-tree")');
    expect(source).toContain(":scope > ul.tree-children > li.tree-node");
    expect(source).toContain("terminal-context");
    expect(source).toContain('node.classList.toggle("terminal-hidden"');
    expect(source).toContain('node.classList.contains("filtered-out")');
    expect(source).toContain("return { syncTree");
  });

  it("pins the localStorage key and the corrupt-storage default fallback", () => {
    const source = wireBoardColumns.toString();
    expect(source).toContain('"arggon-board-columns-v1"');
    expect(source).toContain("localStorage.getItem");
    expect(source).toContain("localStorage.setItem");
    // Corrupt or missing storage degrades to the default layout — the tree fold
    // included (both load paths carry the same defaults). Whitespace varies
    // between the tsc build and the tsx test transform, so match loose.
    expect(source).toMatch(/collapsed:\s*\[\],\s*terminalHidden:\s*false,\s*treeCollapsed:\s*\[\]/);
    expect(source.match(/treeCollapsed:\s*\[\]/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("folds and extends a tree subtree from the row's disclosure control (task-tree-rows-open-detail)", () => {
    const source = wireBoardColumns.toString();
    // The control is delegated like the column one, writes the fold into the
    // SAME layout preference, and the reset clears it with the rest.
    expect(source).toContain('target.closest(".tree-toggle")');
    expect(source).toContain('closest(".tree-node")');
    expect(source).toContain("state.treeCollapsed.push(id)");
    expect(source).toContain("state.treeCollapsed.indexOf(id)");
    expect(source).toMatch(/collapsed:\s*\[\],\s*terminalHidden:\s*false,\s*treeCollapsed:\s*\[\]/);
    // The fold is a display rule on the descendants and never feeds the
    // terminal verdict — a folded row the terminal rule keeps stays on screen.
    expect(source).toContain('node.classList.toggle("collapsed", collapsed)');
    expect(source).toContain('toggle.setAttribute("aria-expanded"');
    // A folded branch with a lens match inside is MARKED, with the lens verdict
    // as the count (matched rows only, never the context path).
    expect(source).toContain('row.querySelector(".tree-matches")');
    expect(source).toContain("matches inside");
    expect(source).toContain('classList.contains("context")');
    // The match count only means something with a lens expression active.
    expect(source).toContain('typeof hasLens === "boolean"');
  });
});

describe("transform-neutral page script (bug-tsx-board-dead-script)", () => {
  /**
   * The rendered page script is assembled from `Function.toString()` of the
   * controller functions. Under a keepNames transform (tsx/esbuild) those
   * sources can carry `__name(...)` helper calls the page cannot resolve —
   * the whole script block then dies on load (filter, drag, collapse, theme
   * and density controls included). `embeddedFunctionSource` strips the
   * artifacts at render time, so no rendered board may ever ship one.
   */
  it("renders embedded scripts without __name artifacts in every mode", () => {
    const htmls = [
      ["static", renderBoardHtml([], { generatedAt: GENERATED_AT })] as const,
      [
        "serve",
        renderBoardHtml([], { generatedAt: GENERATED_AT, details: true, live: true }),
      ] as const,
    ];
    for (const [mode, html] of htmls) {
      expect(html, mode).not.toContain("__name(");
      // The controllers are still there — the render did not degrade.
      expect(html, mode).toContain("function applyBoardFilter");
      expect(html, mode).toContain("function evaluateDrop");
    }
  });

  /**
   * The in-process assertions above run under vitest's oxc transform, whose
   * `toString()` is clean — they pass vacuously against the artifact shape.
   * This gate spawns the real tsx path (`node tsx cli/src/cli.ts board`,
   * exactly what `npm run arggon -- board` runs) so the keepNames-transformed
   * sources flow through `embeddedFunctionSource` and the OUTPUT is asserted.
   * The e2e `@smoke` spec adds the browser-level proof on the same path.
   */
  it("the tsx-rendered CLI output carries no __name artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-embed-tsx-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks", ".convention.yml"), "version: 1\n", "utf8");
    writeFileSync(
      join(dir, "tasks", "task-a.md"),
      '---\ntype: task\nid: task-a\ntitle: A\nstatus: todo\ncreated: "2026-09-15"\nupdated: "2026-09-15"\n---\n',
      "utf8",
    );
    const out = join(dir, "board.html");
    const proc = runCli(["--json", "board", "--out", out], dir, { timeout: 60_000 });
    expect(proc.status, proc.stderr).toBe(0);
    const html = readFileSync(out, "utf8");
    expect(html).not.toContain("__name(");
    expect(html).toContain("function applyBoardFilter");
    expect(html).toContain("function wireBoardTheme");
  });
});

describe("renderBoardHtml build stamp (task-board-build-stamp)", () => {
  const BUILD = "0.10.0 (abc1234, feat/task-board-build-stamp)";

  it("stamps the header meta and the page footer, readable without devtools", () => {
    const html = renderBoardHtml(
      [item({ id: "task-a", type: "task", status: "todo", title: "A" })],
      { generatedAt: GENERATED_AT, build: BUILD },
    );
    // Header meta names the build next to the freshness stamp.
    expect(html).toContain(`· build ${BUILD}`);
    // Footer carries the same identity with a stable id for the parity pin.
    expect(html).toContain(`<footer class="build" id="board-build">build ${BUILD}</footer>`);
  });

  it("renders no stamp when no build is passed (legacy bytes)", () => {
    const html = renderBoardHtml(
      [item({ id: "task-a", type: "task", status: "todo", title: "A" })],
      { generatedAt: GENERATED_AT },
    );
    // NOTE: the item id `task-board-build-stamp` appears in code comments,
    // so the negative pins the element ids, never the bare substring.
    expect(html).not.toContain('id="board-build"');
    expect(html).not.toContain('id="board-drawer-build"');
    expect(html).not.toContain("· build ");
  });

  it("renders the drawer build chrome with details, and none without the stamp", () => {
    const stamped = renderBoardHtml(
      [item({ id: "task-a", type: "task", status: "todo", title: "A" })],
      { generatedAt: GENERATED_AT, details: true, build: BUILD },
    );
    expect(stamped).toContain('id="board-drawer-build"');
    expect(stamped).toContain(
      `<div class="drawer-build" id="board-drawer-build">build ${BUILD}</div>`,
    );

    const unstamped = renderBoardHtml(
      [item({ id: "task-a", type: "task", status: "todo", title: "A" })],
      { generatedAt: GENERATED_AT, details: true },
    );
    expect(unstamped).toContain('id="board-drawer"');
    expect(unstamped).not.toContain("board-drawer-build");
  });

  it("escapes a hostile build string in every stamp surface", () => {
    const hostile = '"><script>alert(1)</script>';
    const html = renderBoardHtml(
      [item({ id: "task-a", type: "task", status: "todo", title: "A" })],
      { generatedAt: GENERATED_AT, details: true, build: hostile },
    );
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("build &quot;&gt;&lt;script&gt;");
  });

  it("runBoard stamps the export at export time from the build, never hand-maintained", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-board-build-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 1\n", "utf8");
    // Injected build: the export carries exactly what the build resolved.
    const injected = runBoard({
      cwd: dir,
      out: "injected.html",
      generatedAt: GENERATED_AT,
      me: null,
      build: BUILD,
    });
    // Friction-tolerant (task-board-footer-links-the-friction-report): the
    // footer may also carry the host's friction badge, so pin the build stamp
    // presence, not the exact closing tag.
    const injectedHtml = readFileSync(injected.outPath, "utf8");
    expect(injectedHtml).toContain('id="board-build"');
    expect(injectedHtml).toContain(`build ${BUILD}`);
    // Default path: the export carries the build's own identity
    // (`buildVersion()` — live git probe, else the baked dist/build-info.json
    // from cli/write-build-info.mjs), so the value is never hand-maintained.
    const stamped = runBoard({
      cwd: dir,
      out: "stamped.html",
      generatedAt: GENERATED_AT,
      me: null,
    });
    // Resolved the same way runBoard resolves it; the assertion pins the
    // wiring, not a literal hash (the worktree's HEAD moves).
    const expected = buildVersion();
    const stampedHtml = readFileSync(stamped.outPath, "utf8");
    expect(stampedHtml).toContain('id="board-build"');
    expect(stampedHtml).toContain(`build ${expected}`);
  });
});
