import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runSync } from "./sync-command.js";
import { runInit } from "./init.js";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";

type MockFn = ReturnType<typeof vi.fn>;

/** Create a mock for the gh executor that returns the given PR list. */
function createGhMock(prs: Array<{ number: number; title: string; headRefName: string; url: string }>): MockFn {
  return vi.fn((cmd: string, args: string[]) => {
    if (cmd === "gh" && args[0] === "pr" && args[1] === "list") {
      return JSON.stringify(prs);
    }
    if (cmd === "git" && args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
      return "https://github.com/test/test.git";
    }
    throw new Error(`Unexpected command: ${cmd} ${args.join(" ")}`);
  });
}

/** Find `<id>.md` anywhere under `<dir>/tasks` (placement rules differ per type). */
function filePath(dir: string, id: string): string {
  const found: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === `${id}.md`) found.push(full);
    }
  };
  walk(join(dir, "tasks"));
  if (found.length !== 1) throw new Error(`expected one ${id}.md, found ${found.length}`);
  return found[0]!;
}

/** Rewrite an item's frontmatter with the given field overrides. */
function setFrontmatter(path: string, overrides: Record<string, unknown>): void {
  const parsed = parseFrontmatter(readFileSync(path, "utf8"));
  const data = { ...parsed.data, ...overrides } as Record<string, unknown>;
  const lines = Object.entries(data)
    .map(([k, v]) => {
      if (v === null || v === undefined) return `${k}: null`;
      if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`;
      return `${k}: ${typeof v === "string" ? JSON.stringify(v) : String(v)}`;
    })
    .join("\n");
  writeFileSync(path, `---\n${lines}\n---\n\n${parsed.body}`);
}

function readFrontmatter(path: string): Record<string, unknown> {
  return parseFrontmatter(readFileSync(path, "utf8")).data as Record<string, unknown>;
}

describe("sync command", () => {
  function createTestRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), "arggon-sync-"));
    runInit({ dir, force: false });
    const now = new Date("2026-01-01");
    runCreate({ cwd: dir, type: "initiative", title: "Test Initiative", now });
    runCreate({ cwd: dir, type: "epic", title: "Test Epic", parent: "test-initiative", now });
    runCreate({ cwd: dir, type: "story", title: "Test Story", parent: "test-epic", id: "story-test", now });
    return dir;
  }

  /** Create a task under the story, then force its branch field (null keeps it unset). */
  function createTask(dir: string, id: string, branch: string | null): string {
    runCreate({ cwd: dir, type: "task", title: `Task ${id}`, parent: "story-test", id, now: new Date("2026-01-01") });
    const path = filePath(dir, id);
    setFrontmatter(path, { branch });
    return path;
  }

  it("reports an error when tasks/ doesn't exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-sync-"));
    const execGh = vi.fn();

    const result = runSync({ check: true, cwd: dir }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(1);
    expect(result.errors[0]).toMatch(/No tasks\/ convention found/);
    expect(execGh).not.toHaveBeenCalled();
  });

  it("throws when --check and --write are combined", () => {
    const dir = createTestRepo();
    expect(() => runSync({ check: true, write: true, cwd: dir })).toThrow(
      /either --check or --write/
    );
  });

  it("sync --check with only containers reports nothing", () => {
    const dir = createTestRepo();
    const execGh = createGhMock([]);

    const result = runSync({ check: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(0);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([]);
    expect(result.pending).toEqual([]);
    expect(result.ambiguous).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("sync --check matches items with branch to PRs", () => {
    const dir = createTestRepo();
    createTask(dir, "task-with-branch", "feat/task-with-branch");

    const execGh = createGhMock([
      {
        number: 42,
        title: "Feature PR",
        headRefName: "feat/task-with-branch",
        url: "https://github.com/test/test/pull/42",
      },
    ]);

    const result = runSync({ check: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(0);
    expect(result.matched).toEqual(["task-with-branch"]);
    expect(result.unmatched).toEqual([]);
    expect(result.pending).toEqual([]);
    expect(result.suggestions).toEqual([]);
  });

  it("sync --check reports unmatched for items with branch but no PR", () => {
    const dir = createTestRepo();
    createTask(dir, "task-no-pr", "feat/no-pr");

    const execGh = createGhMock([]);

    const result = runSync({ check: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(0);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual(["task-no-pr"]);
  });

  it("sync --check reports pending + suggestion for a fillable empty branch", () => {
    const dir = createTestRepo();
    const path = createTask(dir, "task-no-branch", null);

    const execGh = createGhMock([
      {
        number: 43,
        title: "No branch PR",
        headRefName: "feat/task-no-branch",
        url: "https://github.com/test/test/pull/43",
      },
    ]);

    const result = runSync({ check: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(1);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([]);
    expect(result.pending).toEqual(["task-no-branch"]);
    expect(result.suggestions).toEqual([
      { id: "task-no-branch", branch: "feat/task-no-branch", pr: 43 },
    ]);
    expect(readFrontmatter(path).branch).toBeNull();
  });

  it("sync --check ignores branchless tasks when no PR references them", () => {
    const dir = createTestRepo();
    createTask(dir, "task-quiet", null);

    // One open PR exists, but its branch belongs to an already-recorded task.
    createTask(dir, "task-set", "feat/task-set");
    const execGh = createGhMock([
      {
        number: 50,
        title: "Unrelated",
        headRefName: "feat/task-set",
        url: "https://github.com/test/test/pull/50",
      },
    ]);

    const result = runSync({ check: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(0);
    expect(result.pending).toEqual([]);
    expect(result.unmatched).toEqual([]);
    expect(result.matched).toEqual(["task-set"]);
  });

  it("sync --check reports ambiguous for multiple PRs with same headRefName", () => {
    const dir = createTestRepo();
    createTask(dir, "task-ambig", "feat/shared");

    const execGh = createGhMock([
      {
        number: 44,
        title: "PR One",
        headRefName: "feat/shared",
        url: "https://github.com/test/test/pull/44",
      },
      {
        number: 45,
        title: "PR Two",
        headRefName: "feat/shared",
        url: "https://github.com/test/test/pull/45",
      },
    ]);

    const result = runSync({ check: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(1);
    expect(result.matched).toEqual([]);
    expect(result.ambiguous).toEqual([{ id: "task-ambig", branch: "feat/shared", prs: [44, 45] }]);
  });

  it("sync --check never guesses between disagreeing candidates", () => {
    const dir = createTestRepo();
    createTask(dir, "task-split", null);

    const execGh = createGhMock([
      {
        number: 60,
        title: "Feat side",
        headRefName: "feat/task-split",
        url: "https://github.com/test/test/pull/60",
      },
      {
        number: 61,
        title: "Fix side",
        headRefName: "fix/task-split",
        url: "https://github.com/test/test/pull/61",
      },
    ]);

    const result = runSync({ check: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(1);
    expect(result.pending).toEqual(["task-split"]);
    expect(result.suggestions).toEqual([]);
    expect(readFrontmatter(filePath(dir, "task-split")).branch).toBeNull();
  });

  it("does not confuse task-a1 with a PR for task-a12", () => {
    const dir = createTestRepo();
    createTask(dir, "task-a1", null);
    createTask(dir, "task-a12", null);

    const execGh = createGhMock([
      {
        number: 70,
        title: "For task-a12 only",
        headRefName: "feat/task-a12",
        url: "https://github.com/test/test/pull/70",
      },
    ]);

    const result = runSync({ check: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.pending).toEqual(["task-a12"]);
    expect(result.suggestions).toEqual([{ id: "task-a12", branch: "feat/task-a12", pr: 70 }]);
  });

  it("sync --write fills empty branch from PR", () => {
    const dir = createTestRepo();
    const path = createTask(dir, "task-to-fill", null);

    const execGh = createGhMock([
      {
        number: 46,
        title: "Fill PR",
        headRefName: "feat/task-to-fill",
        url: "https://github.com/test/test/pull/46",
      },
    ]);

    const result = runSync({ write: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(0);
    expect(result.matched).toEqual(["task-to-fill"]);
    expect(result.filled).toEqual({ "task-to-fill": "feat/task-to-fill" });
    expect(result.pending).toEqual([]);
    expect(readFrontmatter(path).branch).toBe("feat/task-to-fill");
  });

  it("sync --write only fills the empty field — status and pre-set branches untouched", () => {
    const dir = createTestRepo();
    const fillPath = createTask(dir, "task-fill-me", null);
    const keepPath = createTask(dir, "task-existing", "feat/existing");

    const execGh = createGhMock([
      {
        number: 47,
        title: "Existing PR",
        headRefName: "feat/existing",
        url: "https://github.com/test/test/pull/47",
      },
      {
        number: 48,
        title: "Fill PR",
        headRefName: "feat/task-fill-me",
        url: "https://github.com/test/test/pull/48",
      },
    ]);

    const result = runSync({ write: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(0);
    expect(result.filled).toEqual({ "task-fill-me": "feat/task-fill-me" });

    const kept = readFrontmatter(keepPath);
    expect(kept.branch).toBe("feat/existing");

    const filled = readFrontmatter(fillPath);
    expect(filled.branch).toBe("feat/task-fill-me");
    // Only the empty branch field (plus the updated timestamp) changed.
    expect(filled.status).toBe("todo");
    expect(filled.title).toBe("Task task-fill-me");
    expect(filled.parent).toBe("story-test");
  });

  it("sync --write does not fill ambiguous matches", () => {
    const dir = createTestRepo();
    const path = createTask(dir, "task-two-prs", null);

    const execGh = createGhMock([
      {
        number: 80,
        title: "PR One",
        headRefName: "feat/task-two-prs",
        url: "https://github.com/test/test/pull/80",
      },
      {
        number: 81,
        title: "PR Two",
        headRefName: "feat/task-two-prs",
        url: "https://github.com/test/test/pull/81",
      },
    ]);

    const result = runSync({ write: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(1);
    expect(result.filled).toBeNull();
    expect(result.ambiguous).toEqual([
      { id: "task-two-prs", branch: "feat/task-two-prs", prs: [80, 81] },
    ]);
    expect(readFrontmatter(path).branch).toBeNull();
  });

  it("sync --write fills bugs (fix/ leaves) too", () => {
    const dir = createTestRepo();
    runCreate({
      cwd: dir,
      type: "bug",
      title: "Crash on empty input",
      parent: "story-test",
      id: "empty-input",
      now: new Date("2026-01-01"),
    });
    const path = filePath(dir, "bug-empty-input");
    setFrontmatter(path, { branch: null });

    const execGh = createGhMock([
      {
        number: 90,
        title: "Fix crash",
        headRefName: "fix/bug-empty-input",
        url: "https://github.com/test/test/pull/90",
      },
    ]);

    const result = runSync({ write: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(0);
    expect(result.filled).toEqual({ "bug-empty-input": "fix/bug-empty-input" });
    expect(readFrontmatter(path).branch).toBe("fix/bug-empty-input");
  });

  it("sync --write does not fill containers, but reconciles their set branches", () => {
    const dir = createTestRepo();
    // Epic (container) with a recorded branch; story (container) left branchless.
    setFrontmatter(filePath(dir, "test-epic"), { branch: "chore/test-epic" });

    const execGh = createGhMock([
      {
        number: 91,
        title: "Story-level PR",
        headRefName: "feat/story-test",
        url: "https://github.com/test/test/pull/91",
      },
      {
        number: 92,
        title: "Epic branch PR",
        headRefName: "chore/test-epic",
        url: "https://github.com/test/test/pull/92",
      },
    ]);

    const result = runSync({ write: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    // The epic reconciles against its recorded branch...
    expect(result.matched).toContain("test-epic");
    // ...but the branchless story is not filled from the story-named PR.
    expect(result.filled).toBeNull();
    expect(result.pending).toEqual([]);
    expect(readFrontmatter(filePath(dir, "story-test")).branch ?? null).toBeNull();
  });

  it("surfaces gh failures as errors without throwing", () => {
    const dir = createTestRepo();
    const execGh = vi.fn(() => {
      throw new Error("gh: auth required");
    });

    const result = runSync({ check: true, cwd: dir, repo: "test/test" }, execGh as unknown as typeof execFileSync);

    expect(result.exit_code).toBe(1);
    expect(result.errors[0]).toMatch(/GitHub API error/);
  });
});
