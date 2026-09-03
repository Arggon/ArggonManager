import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runList, splitFrontmatter } from "./list.js";

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

Body without an H1 should fall back to id.
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

describe("splitFrontmatter", () => {
  it("parses YAML and body", () => {
    const result = splitFrontmatter(`---
type: task
title: Hello
---

# Body
`);
    expect(result.yamlError).toBeNull();
    expect(result.data?.type).toBe("task");
    expect(result.body).toContain("# Body");
  });
});

describe("runList", () => {
  it("walks nested tree and sorts lexicographically by id", () => {
    const dir = makeTree();
    const result = runList({ dir });
    expect(result.exitCode).toBe(0);
    const ids = result.stdout
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split(/\s{2,}/)[0]);
    expect(ids).toEqual([
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
    const result = runList({ dir, type: "task", status: "todo" });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("task-rate-limit");
    expect(result.stdout).toContain("task-h1-only");
    expect(result.stdout).not.toContain("task-mine");
    expect(result.stdout).not.toContain("bug-empty-password-500");
  });

  it("emits stable --json schema", () => {
    const dir = makeTree();
    const result = runList({ dir, json: true });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      schemaVersion: number;
      items: Array<Record<string, unknown>>;
    };
    expect(parsed.schemaVersion).toBe(0);
    const item = parsed.items.find((entry) => entry.id === "task-rate-limit");
    expect(item).toEqual({
      id: "task-rate-limit",
      type: "task",
      status: "todo",
      title: "Add login rate limiting",
      assignee: null,
      parent: "story-login",
      labels: ["security"],
      path: "tasks/launch-mvp/auth/story-login/task-rate-limit.md",
    });
    expect(Object.keys(item!)).toEqual([
      "id",
      "type",
      "status",
      "title",
      "assignee",
      "parent",
      "labels",
      "path",
    ]);
  });

  it("returns empty list with exit 0", () => {
    const dir = makeTree();
    const table = runList({ dir, type: "bug", status: "done" });
    expect(table.exitCode).toBe(0);
    expect(table.stdout).toBe("id  type  status  assignee  title\n");

    const json = runList({ dir, type: "bug", status: "done", json: true });
    expect(json.exitCode).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({ schemaVersion: 0, items: [] });
  });

  it("errors when tasks/ is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-list-empty-"));
    const result = runList({ dir });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/tasks\/ not found/);
  });

  it("errors on invalid enum values", () => {
    const dir = makeTree();
    const badType = runList({ dir, type: "feature" });
    expect(badType.exitCode).toBe(1);
    expect(badType.stderr).toMatch(/unknown type/);
    expect(badType.stderr).toMatch(/initiative/);

    const badStatus = runList({ dir, status: "wip" });
    expect(badStatus.exitCode).toBe(1);
    expect(badStatus.stderr).toMatch(/unknown status/);
    expect(badStatus.stderr).toMatch(/in_progress/);
  });

  it("falls back title: frontmatter, then H1, then id", () => {
    const dir = makeTree();
    const result = runList({ dir, json: true });
    const items = (JSON.parse(result.stdout) as { items: Array<{ id: string; title: string }> })
      .items;
    expect(items.find((i) => i.id === "launch-mvp")?.title).toBe("Launch MVP");
    expect(items.find((i) => i.id === "task-h1-only")?.title).toBe("Derived from H1");
    expect(items.find((i) => i.id === "task-no-title")?.title).toBe("task-no-title");
  });

  it("skips markdown without type:", () => {
    const dir = makeTree();
    const result = runList({ dir, json: true });
    const paths = (JSON.parse(result.stdout) as { items: Array<{ path: string }> }).items.map(
      (i) => i.path,
    );
    expect(paths.some((p) => p.endsWith("notes.md"))).toBe(false);
    expect(paths.some((p) => p.endsWith("README.md"))).toBe(false);
  });

  it("resolves @me via GITHUB_USER", () => {
    const dir = makeTree();
    const result = runList(
      { dir, assignee: "@me", json: true },
      { env: { ...process.env, GITHUB_USER: "me-user" } },
    );
    expect(result.exitCode).toBe(0);
    const items = (JSON.parse(result.stdout) as { items: Array<{ id: string }> }).items;
    expect(items.map((i) => i.id)).toEqual(["task-mine"]);
  });

  it("errors when @me cannot be resolved", () => {
    const dir = makeTree();
    const result = runList(
      { dir, assignee: "@me" },
      {
        env: { ...process.env, GITHUB_USER: "", GITHUB_ACTOR: "" },
        resolveMe: () => undefined,
      },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/@me/);
  });

  it("filters assigned vs unassigned", () => {
    const dir = makeTree();
    const assigned = runList({ dir, assignee: "alice", json: true });
    expect(
      (JSON.parse(assigned.stdout) as { items: Array<{ id: string }> }).items.map((i) => i.id),
    ).toEqual(["auth"]);

    const table = runList({ dir, type: "task", status: "todo" });
    expect(table.stdout).toMatch(/task-rate-limit\s+task\s+todo\s+-\s+/);
  });

  it("fails on broken YAML in a work-item-looking file", () => {
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
    const result = runList({ dir });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/task-broken\.md/);
    expect(result.stderr).toMatch(/invalid YAML/i);
  });

  it("shows unassigned as - in table and null in JSON", () => {
    const dir = makeTree();
    const table = runList({ dir, type: "task", status: "todo" });
    expect(table.stdout).toMatch(/task-h1-only\s+task\s+todo\s+-\s+Derived from H1/);
    const json = runList({ dir, type: "initiative", json: true });
    const item = (JSON.parse(json.stdout) as { items: Array<{ assignee: unknown }> }).items[0];
    expect(item.assignee).toBeNull();
  });
});
