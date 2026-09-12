/**
 * Integration tests for worktree-integrated claims (story-start-worktree):
 * `start --worktree` and `arggon cleanup`. Spawns real git inside temp repos
 * (sync-smoke pattern); only push/PR are stubbed so no remote is needed.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCleanup } from "./cleanup.js";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { defaultStartGit, runStart } from "./start.js";
import { runUpdate } from "./update.js";
import { runValidate } from "./validate.js";

const NOW = new Date("2026-09-11T12:00:00Z");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function git(args: string[], cwd: string): string {
  const r = spawnSync("git", args, { encoding: "utf8", cwd });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
}

/** Git runner with real worktree support but no push/PR (no remote in temp repos). */
function localGit() {
  return { ...defaultStartGit(), pushBranch: () => {}, createDraftPr: () => "https://github.com/o/r/pull/1" };
}

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-worktree-"));
  git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "login", now: NOW });
  for (const id of ["task-alpha", "task-bravo", "task-charlie"]) {
    runCreate({ cwd: dir, type: "task", title: id, parent: "login", id, now: NOW });
  }
  // init now also generates governing docs (AGENTS.md, .github/, docs/, ...);
  // commit the whole scaffold so the tree is clean for start --worktree.
  git(["add", "-A"], dir);
  git(["commit", "--quiet", "-m", "init tasks"], dir);
  return dir;
}

function worktreeCount(dir: string): number {
  return git(["worktree", "list", "--porcelain"], dir)
    .split("\n")
    .filter((line) => line.startsWith("worktree ")).length;
}

/** Tolerates exit 1: show-ref --quiet fails when the ref does not exist. */
function refExists(dir: string, ref: string): boolean {
  return spawnSync("git", ["show-ref", "--verify", "--quiet", ref], { cwd: dir }).status === 0;
}

describe("start --worktree", () => {
  it("creates the worktree, records worktree_path, and commits the claim inside it", () => {
    const dir = initRepo();
    const expectedPath = resolve(dirname(dir), `${basename(dir)}-task-alpha`);

    const result = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );

    expect(result.worktreePath).toBe(expectedPath);
    expect(result.worktreeCreated).toBe(true);
    expect(result.created).toBe(true);
    expect(result.committed).toBe(true);
    expect(result.branch).toBe("feat/task-alpha");
    expect(existsSync(expectedPath)).toBe(true);

    // The item in the worktree carries branch + worktree_path; the claim is committed there.
    const wtFile = join(expectedPath, "tasks/launch/auth/login/task-alpha.md");
    const data = parseFrontmatter(readFileSync(wtFile, "utf8")).data;
    expect(data.branch).toBe("feat/task-alpha");
    expect(data.worktree_path).toBe(expectedPath);
    expect(data.status).toBe("in_progress");
    expect(git(["log", "--format=%s"], expectedPath)).toContain(`claim: task-alpha`);
    expect(git(["symbolic-ref", "--short", "HEAD"], expectedPath)).toBe("feat/task-alpha");

    // The main checkout stays on main, clean, without the records.
    expect(git(["symbolic-ref", "--short", "HEAD"], dir)).toBe("main");
    expect(git(["status", "--porcelain"], dir)).toBe("");
    const rootData = parseFrontmatter(
      readFileSync(join(dir, "tasks/launch/auth/login/task-alpha.md"), "utf8"),
    ).data;
    expect(rootData.status).toBe("todo");
    expect(rootData.worktree_path).toBeUndefined();

    // The additive key is forward-declared: validate stays silent.
    const validation = runValidate({ cwd: dir });
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
  });

  it("attaches on re-run instead of failing or duplicating the worktree", () => {
    const dir = initRepo();
    const first = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    const second = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    expect(second.worktreePath).toBe(first.worktreePath);
    expect(second.worktreeCreated).toBe(false);
    expect(second.committed).toBe(false);
    expect(second.pushed).toBe(false);
    expect(worktreeCount(dir)).toBe(2);
  });

  it("fails with an actionable error when the path exists but is not a worktree", () => {
    const dir = initRepo();
    const blocker = resolve(dirname(dir), `${basename(dir)}-task-alpha`);
    mkdirSync(blocker, { recursive: true });
    expect(() =>
      runStart({ cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW }, { git: localGit() }),
    ).toThrow(/not a git worktree/);
    expect(worktreeCount(dir)).toBe(1);
  });

  it("rolls back a freshly created worktree when the claim is taken", () => {
    const dir = initRepo();
    // Claim the item on main first; the worktree copy is still todo, so the
    // claim conflict only surfaces once updates run inside the worktree.
    runUpdate({ cwd: dir, id: "task-alpha", status: "in_progress", assignee: "alice", now: NOW });
    git(["add", "tasks"], dir);
    git(["commit", "--quiet", "-m", "claim task-alpha"], dir);
    expect(() =>
      runStart({ cwd: dir, id: "task-alpha", assignee: "bob", worktree: true, now: NOW }, { git: localGit() }),
    ).toThrow(/claim conflict/);
    expect(worktreeCount(dir)).toBe(1);
    expect(existsSync(resolve(dirname(dir), `${basename(dir)}-task-alpha`))).toBe(false);
    expect(git(["status", "--porcelain"], dir)).toBe("");
  });
});

describe("arggon cleanup", () => {
  /** alpha: done + merged worktree; bravo: todo worktree; charlie: done + unmerged worktree. */
  function initCleanupRepo(): { dir: string; paths: Record<string, string> } {
    const dir = initRepo();
    const paths: Record<string, string> = {};

    // alpha: full merged cycle via start --worktree.
    const alpha = runStart(
      { cwd: dir, id: "task-alpha", assignee: "arggon", worktree: true, now: NOW },
      { git: localGit() },
    );
    paths["task-alpha"] = alpha.worktreePath!;
    runUpdate({ cwd: alpha.worktreePath!, id: "task-alpha", status: "done", now: NOW });
    git(["add", "tasks"], alpha.worktreePath!);
    git(["commit", "--quiet", "-m", "close task-alpha"], alpha.worktreePath!);
    git(["merge", "--quiet", "feat/task-alpha"], dir);

    // bravo: worktree exists, item still todo on main.
    paths["task-bravo"] = resolve(dirname(dir), `${basename(dir)}-task-bravo`);
    git(["worktree", "add", "--quiet", "-b", "feat/task-bravo", paths["task-bravo"]], dir);
    runUpdate({ cwd: dir, id: "task-bravo", worktreePath: paths["task-bravo"], now: NOW });

    // charlie: done on main but its branch carries an unmerged commit.
    paths["task-charlie"] = resolve(dirname(dir), `${basename(dir)}-task-charlie`);
    git(["worktree", "add", "--quiet", "-b", "feat/task-charlie", paths["task-charlie"]], dir);
    const charlieNote = join(paths["task-charlie"], "unmerged.txt");
    spawnSync("touch", [charlieNote]);
    git(["add", "unmerged.txt"], paths["task-charlie"]);
    git(["commit", "--quiet", "-m", "wip"], paths["task-charlie"]);
    runUpdate({
      cwd: dir,
      id: "task-charlie",
      status: "in_progress",
      assignee: "arggon",
      branch: "feat/task-charlie",
      worktreePath: paths["task-charlie"],
      now: NOW,
    });
    runUpdate({ cwd: dir, id: "task-charlie", status: "done", now: NOW });

    // Commit the crafted main-copy records so the tree is clean.
    git(["add", "tasks"], dir);
    git(["commit", "--quiet", "-m", "records"], dir);
    return { dir, paths };
  }

  it("lists only terminal items with merged branches (default mode removes nothing)", () => {
    const { dir, paths } = initCleanupRepo();

    const result = runCleanup({ cwd: dir });

    expect(result.base).toBe("main");
    expect(result.entries.map((e) => e.id)).toEqual(["task-alpha", "task-bravo", "task-charlie"]);
    const byId = new Map(result.entries.map((e) => [e.id, e]));
    expect(byId.get("task-alpha")).toMatchObject({ removable: true, branch: "feat/task-alpha" });
    expect(byId.get("task-bravo")?.removable).toBe(false);
    expect(byId.get("task-bravo")?.reason).toContain("todo");
    expect(byId.get("task-charlie")?.removable).toBe(false);
    expect(byId.get("task-charlie")?.reason).toContain("not fully merged");
    expect(result.pruned).toEqual([]);
    // Nothing was touched in list mode.
    for (const path of Object.values(paths)) {
      expect(existsSync(path)).toBe(true);
    }
    expect(worktreeCount(dir)).toBe(4);
  });

  it("--prune removes merged worktrees and deletes their branches, skipping the rest", () => {
    const { dir, paths } = initCleanupRepo();

    const result = runCleanup({ cwd: dir, prune: true });

    expect(result.failures).toEqual([]);
    expect(result.pruned.map((a) => a.action)).toEqual([
      `removed worktree ${paths["task-alpha"]}`,
      "deleted branch feat/task-alpha",
      "cleared worktree_path",
    ]);
    expect(existsSync(paths["task-alpha"])).toBe(false);
    expect(refExists(dir, "refs/heads/feat/task-alpha")).toBe(false);
    // The record is cleared on the item.
    const raw = readFileSync(join(dir, "tasks/launch/auth/login/task-alpha.md"), "utf8");
    expect(parseFrontmatter(raw).data.worktree_path).toBeUndefined();
    // Skipped entries survive untouched.
    expect(existsSync(paths["task-bravo"])).toBe(true);
    expect(existsSync(paths["task-charlie"])).toBe(true);
    expect(refExists(dir, "refs/heads/feat/task-charlie")).toBe(true);
  });

  it("emits the standard --json envelope via the CLI", () => {
    const { dir } = initCleanupRepo();
    const r = spawnSync(process.execPath, [tsx, cli, "cleanup", "--json"], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(r.status).toBe(0);
    const envelope = JSON.parse(r.stdout) as {
      ok: boolean;
      command: string;
      schemaVersion: number;
      base: string;
      candidates: Array<{ id: string; removable: boolean }>;
      pruned: unknown[];
    };
    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe("cleanup");
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.base).toBe("main");
    expect(envelope.candidates).toHaveLength(3);
    expect(envelope.candidates.filter((c) => c.removable).map((c) => c.id)).toEqual([
      "task-alpha",
    ]);
    expect(envelope.pruned).toEqual([]);
  });

  it("fails with a git-repository error outside a repo", () => {
    const bare = mkdtempSync(join(tmpdir(), "arggon-worktree-nogit-"));
    runInit({ dir: bare, force: false });
    expect(() => runCleanup({ cwd: bare })).toThrow(/not a git repository/);
  });
});
