import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toContractWorkItem } from "./contract.js";
import { formatListTable, runList } from "./list.js";

function write(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

function makeTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-list-"));
  mkdirSync(join(root, "tasks"), { recursive: true });
  write(root, "tasks/.convention.yml", "version: 0\n");
  write(root, "tasks/README.md", "# Not a work item\n");
  write(
    root,
    "tasks/launch-mvp/launch-mvp.md",
    `---
type: initiative
status: in_progress
id: launch-mvp
title: Launch MVP
labels: [phase-1]
created: "2026-09-03"
---

# Launch MVP
`,
  );
  write(
    root,
    "tasks/launch-mvp/z-later/z-later.md",
    `---
type: epic
status: todo
id: z-later
parent: launch-mvp
---

# Z later
`,
  );
  write(
    root,
    "tasks/launch-mvp/auth/auth.md",
    `---
type: epic
status: in_progress
id: auth
parent: launch-mvp
assignee: alice
---

# Authentication
`,
  );
  write(
    root,
    "tasks/launch-mvp/auth/story-login/story-login.md",
    `---
type: story
status: todo
id: story-login
parent: auth
---

# Login story
`,
  );
  write(
    root,
    "tasks/launch-mvp/auth/story-login/task-rate-limit.md",
    `---
type: task
status: todo
id: task-rate-limit
parent: story-login
labels: [security]
---

# Add login rate limiting
`,
  );
  write(
    root,
    "tasks/launch-mvp/auth/story-login/bug-empty-password-500.md",
    `---
type: bug
status: blocked
id: bug-empty-password-500
parent: story-login
assignee: bob
blocked_reason: Waiting on repro
labels: [bug]
---

# Empty password returns 500
`,
  );
  write(
    root,
    "tasks/launch-mvp/auth/story-login/notes.md",
    `# Notes without type

This should be skipped.
`,
  );
  write(
    root,
    "tasks/launch-mvp/auth/story-login/task-no-title.md",
    `---
type: task
status: done
id: task-no-title
parent: story-login
x-custom: keep-me
---

Body without an H1 has no title (contract null).
`,
  );
  write(
    root,
    "tasks/launch-mvp/auth/story-login/task-h1-only.md",
    `---
type: task
status: todo
id: task-h1-only
parent: story-login
---

# Derived from H1
`,
  );
  write(
    root,
    "tasks/launch-mvp/auth/story-login/task-mine.md",
    `---
type: task
status: in_progress
id: task-mine
parent: story-login
assignee: me-user
---

# Mine
`,
  );
  return root;
}

describe("runList", () => {
  it("walks nested tree and sorts lexicographically by id", () => {
    const dir = makeTree();
    const { items } = runList({ cwd: dir });
    expect(items.map((i) => i.id)).toEqual([
      "auth",
      "bug-empty-password-500",
      "launch-mvp",
      "story-login",
      "task-h1-only",
      "task-mine",
      "task-no-title",
      "task-rate-limit",
      "z-later",
    ]);
  });

  it("composes filters with AND", () => {
    const dir = makeTree();
    const { items } = runList({ cwd: dir, type: "task", status: "todo" });
    const ids = items.map((i) => i.id);
    expect(ids).toContain("task-rate-limit");
    expect(ids).toContain("task-h1-only");
    expect(ids).not.toContain("task-mine");
    expect(ids).not.toContain("bug-empty-password-500");
  });

  it("returns kernel items with stable fields", () => {
    const dir = makeTree();
    const { root, items } = runList({ cwd: dir });
    expect(root).toBe(dir);
    const task = items.find((i) => i.id === "task-rate-limit");
    expect(task).toMatchObject({
      type: "task",
      status: "todo",
      parent: "story-login",
      labels: ["security"],
    });
    expect(task?.title).toBeUndefined();
    const bug = items.find((i) => i.id === "bug-empty-password-500");
    expect(bug).toMatchObject({ assignee: "bob", blockedReason: "Waiting on repro" });
  });

  it("maps to the full contract shape with nulls", () => {
    const dir = makeTree();
    const { root, items } = runList({ cwd: dir });
    const task = toContractWorkItem(
      items.find((i) => i.id === "task-rate-limit")!,
      root,
    );
    expect(task).toEqual({
      id: "task-rate-limit",
      type: "task",
      status: "todo",
      title: null,
      assignee: null,
      branch: null,
      parent: "story-login",
      labels: ["security"],
      created: null,
      updated: null,
      path: "tasks/launch-mvp/auth/story-login/task-rate-limit.md",
      blocked_reason: null,
      milestone: null,
      depends_on: [],
    });
  });

  it("returns an empty list (no failure)", () => {
    const dir = makeTree();
    const { items } = runList({ cwd: dir, type: "bug", status: "done" });
    expect(items).toEqual([]);
    expect(formatListTable(items)).toBe("id  type  status  assignee  branch  title\n");
  });

  it("errors when tasks/ is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-list-empty-"));
    expect(() => runList({ cwd: dir })).toThrow(/No tasks\/ convention/);
  });

  it("errors on invalid enum values", () => {
    const dir = makeTree();
    expect(() => runList({ cwd: dir, type: "feature" })).toThrow(/unknown type/);
    expect(() => runList({ cwd: dir, type: "feature" })).toThrow(/initiative/);
    expect(() => runList({ cwd: dir, status: "wip" })).toThrow(/unknown status/);
    expect(() => runList({ cwd: dir, status: "wip" })).toThrow(/in_progress/);
  });

  it("leaves title undefined when frontmatter has none (no H1 fallback)", () => {
    const dir = makeTree();
    const { root, items } = runList({ cwd: dir });
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("launch-mvp")?.title).toBe("Launch MVP");
    expect(byId.get("task-h1-only")?.title).toBeUndefined();
    expect(byId.get("task-no-title")?.title).toBeUndefined();
    // Contract renders them as null; tables fall back to id.
    expect(toContractWorkItem(byId.get("task-h1-only")!, root).title).toBeNull();
    expect(formatListTable([byId.get("task-h1-only")!])).toContain("task-h1-only  task");
  });

  it("skips markdown without type:", () => {
    const dir = makeTree();
    const { items } = runList({ cwd: dir });
    const paths = items.map((i) => i.filePath);
    expect(paths.some((p) => p.endsWith("notes.md"))).toBe(false);
    expect(paths.some((p) => p.endsWith("README.md"))).toBe(false);
  });

  it("round-trips branch through table and contract", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-list-branch-"));
    mkdirSync(join(dir, "tasks"), { recursive: true });
    write(dir, "tasks/.convention.yml", "version: 1\n");
    write(
      dir,
      "tasks/a/a.md",
      `---
type: initiative
status: in_progress
id: a
title: A
branch: feat/a
---

# A
`,
    );
    const { root, items } = runList({ cwd: dir });
    expect(items[0]?.branch).toBe("feat/a");
    expect(formatListTable(items)).toContain("feat/a");
    expect(toContractWorkItem(items[0]!, root).branch).toBe("feat/a");
  });

  it("resolves @me via GITHUB_USER", () => {
    const dir = makeTree();
    const { items } = runList(
      { cwd: dir, assignee: "@me" },
      { env: { ...process.env, GITHUB_USER: "me-user" } },
    );
    expect(items.map((i) => i.id)).toEqual(["task-mine"]);
  });

  it("errors when @me cannot be resolved", () => {
    const dir = makeTree();
    expect(() =>
      runList(
        { cwd: dir, assignee: "@me" },
        {
          env: { ...process.env, GITHUB_USER: "", GITHUB_ACTOR: "" },
          resolveMe: () => undefined,
        },
      ),
    ).toThrow(/@me/);
  });

  it("filters assigned vs unassigned", () => {
    const dir = makeTree();
    const { items: assigned } = runList({ cwd: dir, assignee: "alice" });
    expect(assigned.map((i) => i.id)).toEqual(["auth"]);

    const { items: todos } = runList({ cwd: dir, type: "task", status: "todo" });
    expect(formatListTable(todos)).toMatch(/task-rate-limit\s+task\s+todo\s+-\s+/);
  });

  it("applies --filter expressions with AND, negation, label, and parent", () => {
    const dir = makeTree();
    const { items: todos } = runList({ cwd: dir, filter: "status:todo type:task" });
    expect(todos.map((i) => i.id)).toEqual(["task-h1-only", "task-rate-limit"]);

    const { items: notDone } = runList({ cwd: dir, filter: "type:task !status:done" });
    expect(notDone.map((i) => i.id)).toEqual(["task-h1-only", "task-mine", "task-rate-limit"]);

    const { items: labeled } = runList({ cwd: dir, filter: "label:phase-1" });
    expect(labeled.map((i) => i.id)).toEqual(["launch-mvp"]);

    const { items: children } = runList({ cwd: dir, filter: "parent:story-login" });
    expect(children.map((i) => i.id).sort()).toEqual([
      "bug-empty-password-500",
      "task-h1-only",
      "task-mine",
      "task-no-title",
      "task-rate-limit",
    ]);

    const { items: mine } = runList(
      { cwd: dir, filter: "assignee:@me" },
      { env: { ...process.env, GITHUB_USER: "me-user" } },
    );
    expect(mine.map((i) => i.id)).toEqual(["task-mine"]);
  });

  it("rejects bad filter expressions with usage errors", () => {
    const dir = makeTree();
    expect(() => runList({ cwd: dir, filter: "title:foo" })).toThrow(/unknown filter field/);
    expect(() => runList({ cwd: dir, filter: "status:bogus" })).toThrow(/unknown status/);
    expect(() => runList({ cwd: dir, filter: "type:bogus" })).toThrow(/unknown type/);
  });

  describe("--view (saved views from x-views)", () => {
    function makeViewTree(): string {
      const dir = makeTree();
      write(
        dir,
        "tasks/.convention.yml",
        [
          "version: 0",
          "x-views:",
          '  open-tasks: "type:task status:todo"',
          "  mine: assignee:@me",
          "",
        ].join("\n"),
      );
      return dir;
    }

    it("resolves a saved view as a filter expression", () => {
      const dir = makeViewTree();
      const { items } = runList({ cwd: dir, view: "open-tasks" });
      expect(items.map((i) => i.id)).toEqual(["task-h1-only", "task-rate-limit"]);
    });

    it("combines explicit flags with the view filter (AND)", () => {
      const dir = makeViewTree();
      const { items } = runList({ cwd: dir, view: "open-tasks", status: "done" });
      expect(items).toEqual([]);

      const { items: negated } = runList({ cwd: dir, view: "open-tasks", type: "story" });
      expect(negated).toEqual([]);
    });

    it("ANDs --view with --filter and resolves @me inside views like the flags", () => {
      const dir = makeViewTree();
      const { items } = runList(
        { cwd: dir, view: "mine", filter: "status:in_progress" },
        { env: { ...process.env, GITHUB_USER: "me-user" } },
      );
      expect(items.map((i) => i.id)).toEqual(["task-mine"]);
    });

    it("fails on unknown view names listing the known views", () => {
      const dir = makeViewTree();
      expect(() => runList({ cwd: dir, view: "nope" })).toThrow(
        /unknown view "nope"\. Known views: open-tasks, mine/,
      );
    });

    it("fails on any view name when no views are defined", () => {
      const dir = makeTree();
      expect(() => runList({ cwd: dir, view: "nope" })).toThrow(
        /no saved views defined in tasks\/\.convention\.yml x-views/,
      );
    });

    it("validates view expressions with the same usage errors as --filter", () => {
      const dir = makeTree();
      write(dir, "tasks/.convention.yml", "x-views:\n  bad: status:bogus\n");
      expect(() => runList({ cwd: dir, view: "bad" })).toThrow(/unknown status/);
    });
  });

  it("fails on invalid items with file context", () => {
    const dir = makeTree();
    write(
      dir,
      "tasks/launch-mvp/auth/story-login/task-broken.md",
      `---
type: task
status: [unterminated
id: task-broken
---

# Broken
`,
    );
    expect(() => runList({ cwd: dir })).toThrow(/task-broken\.md/);
  });

  it("shows unassigned as - in table and null in contract", () => {
    const dir = makeTree();
    const { root, items: todos } = runList({ cwd: dir, type: "task", status: "todo" });
    expect(formatListTable(todos)).toMatch(/task-h1-only\s+task\s+todo\s+-\s+-\s+task-h1-only/);
    const { items: initiatives } = runList({ cwd: dir, type: "initiative" });
    expect(toContractWorkItem(initiatives[0]!, root).assignee).toBeNull();
  });
});

describe("runList dependency predicates (spec-deps-001)", () => {
  function depTree(): string {
    const root = mkdtempSync(join(tmpdir(), "arggon-list-deps-"));
    mkdirSync(join(root, "tasks"), { recursive: true });
    write(root, "tasks/.convention.yml", "version: 3\n");
    const md = (frontmatter: string) =>
      `---\n${frontmatter}---\n\n# item\n`;
    write(
      root,
      "tasks/x/task-aaa.md",
      md('type: task\nstatus: todo\nid: task-aaa\ndepends_on: ["task-x", "done-y"]\nlabels: []\ncreated: "2026-09-11"\n'),
    );
    write(
      root,
      "tasks/x/bug-bbb.md",
      md('type: bug\nstatus: todo\nid: bug-bbb\ndepends_on: ["task-aaa"]\nlabels: []\ncreated: "2026-09-11"\n'),
    );
    write(
      root,
      "tasks/x/task-ccc.md",
      md('type: task\nstatus: todo\nid: task-ccc\nlabels: []\ncreated: "2026-09-11"\n'),
    );
    write(
      root,
      "tasks/x/task-x.md",
      md('type: task\nstatus: in_progress\nid: task-x\nassignee: alice\nlabels: []\ncreated: "2026-09-11"\n'),
    );
    write(
      root,
      "tasks/x/done-y.md",
      md('type: task\nstatus: done\nid: done-y\nlabels: []\ncreated: "2026-09-11"\n'),
    );
    return root;
  }

  it("depends-on:<id> matches items listing id in depends_on", () => {
    const { items } = runList({ cwd: depTree(), filter: "depends-on:task-x" });
    expect(items.map((i) => i.id)).toEqual(["task-aaa"]);
  });

  it("blocked-by:<id> matches the computed inverse (items depended on by id)", () => {
    const { items } = runList({ cwd: depTree(), filter: "blocked-by:task-aaa" });
    expect(items.map((i) => i.id)).toEqual(["bug-bbb"]);
  });

  it("composes with other predicates and negation", () => {
    const { items } = runList({ cwd: depTree(), filter: "type:task !depends-on:done-y" });
    // task-aaa depends on done-y (negated out); the other tasks have no deps.
    expect(items.map((i) => i.id)).toEqual(["done-y", "task-ccc", "task-x"]);
  });

  it("blocked-by with no dependents returns empty, not an error", () => {
    const { items } = runList({ cwd: depTree(), filter: "blocked-by:task-ccc" });
    expect(items).toEqual([]);
  });
});
