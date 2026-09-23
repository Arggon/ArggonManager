/**
 * Parity guard (task-parity-guard-for-board-drop-rules-vs-statusts).
 *
 * The board page embeds a hand-copied drop-rule function (evaluateDrop,
 * toString-embedded into the page script) while the server route runs the
 * kernel update path (runUpdate). Nothing in the build links them, so this
 * suite proves the chain 1:1:
 *
 *   1. embedded page script  ===  TS evaluateDrop  (same function source,
 *      executed in a vm sandbox, same verdicts over the full case matrix)
 *   2. TS evaluateDrop  ===  kernel runUpdate      (accept/refuse parity per
 *      transition pair, claim rule, and blocked-reason rule)
 *   3. the one intentional divergence (force) is asserted explicitly
 *
 * A deliberate edit to either copy makes part of this suite fail.
 */
import { mkdirSync, mkdtempSync as _mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyBoardFilter, evaluateDrop, renderBoardHtml, type BoardLensItem } from "./board.js";
import { parseFilter, runList, runUpdate, visibleItems } from "@arggondev/lib";

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

type Card = { id: string; type: string; status: string; assignee?: string | null };
type Verdict = { ok: boolean; reason: string };

/** Recover the embedded evaluateDrop source from the rendered page. */
function embeddedEvaluateDropSource(): string {
  const html = renderBoardHtml([], { generatedAt: "test" });
  const start = html.indexOf("function evaluateDrop");
  // The board lens function follows; its start sentinel bounds this slice.
  const end = html.indexOf("/* board-filter:start */");
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end).trim();
}

/** Recover the embedded board-lens source from the rendered page. */
function embeddedBoardLensSource(): string {
  const html = renderBoardHtml([], { generatedAt: "test" });
  const start = html.indexOf("/* board-filter:start */");
  const end = html.indexOf("/* board-filter:end */");
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return html.slice(start + "/* board-filter:start */".length, end).trim();
}

function embeddedBoardLens(): (
  items: BoardLensItem[],
  expr: string,
  me?: string | null,
) => ReturnType<typeof applyBoardFilter> {
  const fn = new Function(`${embeddedBoardLensSource()}\nreturn applyBoardFilter;`);
  return fn() as (
    items: BoardLensItem[],
    expr: string,
    me?: string | null,
  ) => ReturnType<typeof applyBoardFilter>;
}

function embeddedEvaluateDrop(): (card: Card, to: string, edit?: object) => Verdict {
  const fn = new Function(`${embeddedEvaluateDropSource()}\nreturn evaluateDrop;`);
  return fn() as (card: Card, to: string, edit?: object) => Verdict;
}

const STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;

/** Full (from, to) case matrix with claim states; excludes same-status drops (UI nicety). */
function cases(): Array<{ card: Card; to: string; edit: object }> {
  const out: Array<{ card: Card; to: string; edit: object }> = [];
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      if (to === from) continue; // board refuses same-column drops as UI flow
      for (const claimed of [false, true]) {
        out.push({
          card: {
            id: "task-x",
            type: "story",
            status: from,
            assignee: claimed ? "alice" : null,
          },
          to,
          // Claiming an unclaimed card via drop prompts for the assignee;
          // the prompt result is what the update path receives.
          edit: to === "in_progress" && !claimed ? { assignee: "carol" } : {},
        });
      }
    }
  }
  return out;
}

describe("parity: embedded page script vs TS evaluateDrop", () => {
  it("renders the same function source that exists in board.ts", () => {
    expect(embeddedEvaluateDropSource()).toBe(evaluateDrop.toString().trim());
  });

  it("gives identical verdicts over the full case matrix in a vm sandbox", () => {
    const embedded = embeddedEvaluateDrop();
    for (const { card, to, edit } of cases()) {
      const a = embedded(structuredClone(card), to, structuredClone(edit));
      const b = evaluateDrop(structuredClone(card), to, structuredClone(edit));
      expect(a, `${card.status}->${to} claimed=${card.assignee ?? "no"}`).toEqual(b);
    }
  });

  it("blocks hostile globals: the sandboxed function cannot reach the update path", () => {
    const embedded = embeddedEvaluateDrop();
    expect(typeof embedded).toBe("function");
    expect(embeddedEvaluateDropSource().includes("fetch")).toBe(false);
  });
});

// ---------- kernel parity (TS evaluateDrop vs runUpdate) ----------

function itemFile(
  root: string,
  id: string,
  type: "story" | "epic",
  status: string,
  assignee?: string,
): string {
  const rel =
    type === "story" ? `tasks/launch/epic-a/${id}/${id}.md` : `tasks/launch/${id}/${id}.md`;
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(
    full,
    `---
type: ${type}
status: ${status}
id: ${id}
assignee: ${assignee ?? "null"}
parent: ${type === "story" ? "epic-a" : "launch"}
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---

# ${id}
`,
    "utf8",
  );
  return full;
}

function newTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-drop-parity-"));
  mkdirSync(join(root, "tasks"), { recursive: true });
  writeFileSync(join(root, "tasks/.convention.yml"), "version: 0\n", "utf8");
  const container = (rel: string, type: string, id: string) => {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(
      full,
      `---\ntype: ${type}\nstatus: todo\nid: ${id}\nlabels: []\ncreated: "2026-09-11"\nupdated: "2026-09-11"\n---\n\n# ${id}\n`,
      "utf8",
    );
  };
  container("tasks/launch/launch.md", "initiative", "launch");
  container("tasks/launch/epic-a/epic-a.md", "epic", "epic-a");
  return root;
}

/** Kernel verdict for the same drop, with the drop-flow inputs the page would send. */
function kernelAccepts(
  root: string,
  card: Card,
  to: string,
  edit: { assignee?: string; force?: boolean },
): boolean {
  itemFile(root, card.id, card.type as "story" | "epic", card.status, card.assignee ?? undefined);
  try {
    runUpdate({
      cwd: root,
      id: card.id,
      status: to,
      assignee:
        edit.assignee ?? (to === "in_progress" && card.type !== "epic" ? "carol" : undefined),
      blockedReason: to === "blocked" ? "blocked on ci" : undefined,
      force: edit.force === true,
    });
    return true;
  } catch {
    return false;
  } finally {
    rmSync(join(root, "tasks/launch"), { recursive: true, force: true });
    mkdirSync(join(root, "tasks/launch"), { recursive: true });
  }
}

describe("parity: TS evaluateDrop vs kernel runUpdate", () => {
  it("accepts exactly the transitions the CLI update path accepts (drop-flow inputs)", () => {
    const root = newTree();
    for (const { card, to, edit } of cases()) {
      const board = evaluateDrop(structuredClone(card), to, structuredClone(edit));
      const kernel = kernelAccepts(root, card, to, edit as { assignee?: string });
      expect(
        { verdict: board.ok, from: card.status, to },
        `board=${board.ok} kernel=${kernel} for ${card.status}->${to} edit=${JSON.stringify(edit)}`,
      ).toEqual({ verdict: kernel, from: card.status, to });
    }
  });

  it("agrees on containers (epics claim without assignee)", () => {
    const root = newTree();
    for (const [from, to] of [
      ["todo", "in_progress"],
      ["todo", "done"],
      ["done", "todo"],
    ] as const) {
      const card: Card = { id: "task-x", type: "epic", status: from, assignee: null };
      const board = evaluateDrop(card, to);
      const kernel = kernelAccepts(root, card, to, {});
      expect(board.ok).toBe(kernel);
    }
  });

  it("refuses claim steals the same way the update path does (no force on the board)", () => {
    const root = newTree();
    const card: Card = { id: "task-x", type: "story", status: "in_progress", assignee: "alice" };
    expect(evaluateDrop(card, "done", { assignee: "bob" }).ok).toBe(false);
    expect(kernelAccepts(root, card, "done", { assignee: "bob" })).toBe(false);
    // Force is CLI-only: the board refuses what the CLI would allow.
    expect(evaluateDrop(card, "done", { force: true }).ok).toBe(false);
    expect(kernelAccepts(root, card, "done", { force: true })).toBe(true);
  });

  it("agrees on the claim flow: unclaimed card + prompted assignee", () => {
    const root = newTree();
    const card: Card = { id: "task-x", type: "story", status: "todo", assignee: null };
    expect(evaluateDrop(card, "in_progress", { assignee: "carol" }).ok).toBe(true);
    expect(kernelAccepts(root, card, "in_progress", { assignee: "carol" })).toBe(true);
  });
});

// ---------- board lens parity (task-board-filter-lenses) ----------

/**
 * Supported-subset parity table. Every expression here must keep the same ids
 * in the embedded board lens and the kernel (`runList --filter`): fields
 * `type`, `status`, `label`, `assignee`, `priority`, `ancestor`, `!` negation,
 * quoting and free text (id/title substring). The kernel-only dependency
 * predicates (`parent:`, `depends-on:`, `blocked-by:` — and readiness) are
 * asserted as an explicit, documented divergence below.
 */
const LENS_PARITY_EXPRESSIONS = [
  "",
  "status:todo",
  "status:done !type:bug",
  "type:task",
  "type:initiative",
  "label:security",
  "!label:security",
  "assignee:alice",
  "assignee:@me",
  "!assignee:alice",
  "priority:p1",
  "priority:none",
  "ancestor:launch",
  "ancestor:epic-a",
  "ancestor:task-one",
  "!ancestor:epic-a",
  "status:todo label:security",
  "type:task !status:done",
] as const;

/**
 * Free-text cases (a board extension: the kernel parser refuses bare tokens).
 * Compared against the shared `visibleItems` helper, which is the kernel's
 * own substring rule.
 */
const LENS_FREE_TEXT_EXPRESSIONS = [
  "login",
  '"login flow"',
  "login task-one",
  "status:todo login",
] as const;

/** Item snapshot for the sandbox comparison (same shape the page embeds). */
const LENS_SANDBOX_ITEMS: BoardLensItem[] = [
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

/** Frontmatter for one lens-parity fixture item. */
function lensItemFile(fields: {
  type: string;
  id: string;
  status: string;
  title: string;
  parent?: string;
  assignee?: string;
  labels?: string[];
  priority?: string;
}): string {
  const lines = [
    "---",
    `type: ${fields.type}`,
    `status: ${fields.status}`,
    `id: ${fields.id}`,
    `title: "${fields.title}"`,
    ...(fields.parent ? [`parent: ${fields.parent}`] : []),
    `assignee: ${fields.assignee ?? "null"}`,
    `labels: [${(fields.labels ?? []).map((label) => `"${label}"`).join(", ")}]`,
    ...(fields.priority ? [`priority: ${fields.priority}`] : []),
    'created: "2026-09-22"',
    'updated: "2026-09-22"',
    "---",
    "",
    `# ${fields.title}`,
    "",
  ];
  return lines.join("\n");
}

/** A real tracker mirroring the sandbox items (legacy tasks/ layout). */
function newLensTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-lens-parity-"));
  mkdirSync(join(root, "tasks"), { recursive: true });
  writeFileSync(
    join(root, "tasks/.convention.yml"),
    'version: 1\nx-views:\n  smoke: "label:security"\n  mine: "assignee:@me"\n',
    "utf8",
  );
  const write = (rel: string, fields: Parameters<typeof lensItemFile>[0]): void => {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, lensItemFile(fields), "utf8");
  };
  write("tasks/launch/launch.md", {
    type: "initiative",
    id: "launch",
    status: "todo",
    title: "Launch",
    labels: ["core"],
    priority: "p1",
  });
  write("tasks/launch/epic-a/epic-a.md", {
    type: "epic",
    id: "epic-a",
    status: "todo",
    title: "Auth epic",
    parent: "launch",
    labels: ["core", "security"],
  });
  write("tasks/launch/epic-a/story-a/story-a.md", {
    type: "story",
    id: "story-a",
    status: "todo",
    title: "Login flow",
    parent: "epic-a",
    labels: ["security"],
    assignee: "alice",
    priority: "p2",
  });
  write("tasks/launch/epic-a/story-a/task-one.md", {
    type: "task",
    id: "task-one",
    status: "in_progress",
    title: "Fix login flow",
    parent: "story-a",
    labels: ["security"],
    assignee: "alice",
    priority: "p1",
  });
  write("tasks/launch/epic-a/story-a/task-two.md", {
    type: "task",
    id: "task-two",
    status: "done",
    title: "Ship it",
    parent: "story-a",
    labels: [],
    assignee: "bob",
  });
  write("tasks/launch/epic-a/story-a/bug-one.md", {
    type: "bug",
    id: "bug-one",
    status: "todo",
    title: "Crash on empty",
    parent: "story-a",
    labels: ["bug"],
    priority: "p0",
  });
  return root;
}

describe("parity: embedded board lens vs kernel filter", () => {
  it("embeds the same function source that exists in board.ts", () => {
    expect(embeddedBoardLensSource()).toBe(applyBoardFilter.toString().trim());
  });

  it("gives identical verdicts over the parity table in a vm sandbox", () => {
    const embedded = embeddedBoardLens();
    const expressions = [
      ...LENS_PARITY_EXPRESSIONS,
      ...LENS_FREE_TEXT_EXPRESSIONS,
      "parent:story-a",
      "status:",
      "!login",
    ];
    for (const expr of expressions) {
      expect(
        embedded(structuredClone(LENS_SANDBOX_ITEMS), expr, "alice"),
        `expression "${expr}"`,
      ).toEqual(applyBoardFilter(LENS_SANDBOX_ITEMS, expr, "alice"));
    }
  });

  it("agrees with runList on a real tracker for every supported expression", () => {
    const root = newLensTree();
    const all = runList({ cwd: root }).items;
    for (const expr of LENS_PARITY_EXPRESSIONS) {
      const kernel = runList({ cwd: root, filter: expr }, { resolveMe: () => "alice" }).items.map(
        (entry) => entry.id,
      );
      const board = applyBoardFilter(all, expr, "alice");
      expect(board.ok, `board refused "${expr}": ${board.ok ? "" : board.error}`).toBe(true);
      expect(board.ok ? board.visible : [], `expression "${expr}"`).toEqual(kernel);
    }
  });

  it("agrees with the shared substring helper on free text", () => {
    const root = newLensTree();
    const all = runList({ cwd: root }).items;
    const freeText: Array<[string, string[]]> = [
      ["login", ["login"]],
      ['"login flow"', ["login flow"]],
      ["login task-one", ["login", "task-one"]],
    ];
    for (const [expr, needles] of freeText) {
      const expected = all
        .filter((entry) => needles.every((needle) => visibleItems([entry], needle).length === 1))
        .map((entry) => entry.id);
      expect(applyBoardFilter(all, expr, null), `expression "${expr}"`).toEqual({
        ok: true,
        visible: expected,
      });
    }
    // Mixed free text + predicate ANDs the two, like the board's token loop.
    const expected = all
      .filter((entry) => entry.status === "todo" && visibleItems([entry], "login").length === 1)
      .map((entry) => entry.id);
    expect(applyBoardFilter(all, "status:todo login", null)).toEqual({
      ok: true,
      visible: expected,
    });
  });

  it("refuses the kernel-only dependency predicates the kernel accepts (documented v1 divergence)", () => {
    const root = newLensTree();
    const all = runList({ cwd: root }).items;
    for (const expr of ["parent:story-a", "depends-on:task-one", "blocked-by:task-one"]) {
      // The kernel accepts these (possibly matching nothing); board v1 refuses
      // them instead of silently dropping the dependency semantics.
      expect(() => runList({ cwd: root, filter: expr })).not.toThrow();
      const board = applyBoardFilter(all, expr, null);
      expect(board.ok, `board must refuse "${expr}"`).toBe(false);
      if (!board.ok) expect(board.error).toContain("arggon list --filter");
    }
  });

  it("refuses malformed expressions exactly where the kernel parser does", () => {
    for (const expr of ["status:", "foo:bar", "!login", 'assignee:"Jane', 'assignee:"Jane"x']) {
      expect(() => parseFilter(expr), `kernel should refuse "${expr}"`).toThrow();
      expect(applyBoardFilter([], expr, null).ok, `board should refuse "${expr}"`).toBe(false);
    }
    // Enum validation lives in runList (not parseFilter); the board mirrors runList.
    const root = newLensTree();
    for (const expr of ["status:bogus", "type:bogus", "priority:p9"]) {
      expect(() => parseFilter(expr)).not.toThrow();
      expect(() => runList({ cwd: root, filter: expr })).toThrow();
      expect(applyBoardFilter([], expr, null).ok).toBe(false);
    }
  });
});
