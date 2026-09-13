/**
 * Tracker auto-commit tests (story-tracker-hygiene, task-auto-commit-tracker).
 * Spawns real git inside temp repos (worktree.test.ts pattern) and asserts
 * that create/comment/adopt/cleanup --prune commit ONLY their own mutated
 * paths, honor --no-commit and x-tracker.auto-commit, and skip silently on
 * non-git trees.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runAdopt } from "./adopt.js";
import { runCleanup } from "./cleanup.js";
import { runComment } from "./comment.js";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { runStart, defaultStartGit } from "./start.js";
import {
  readConventionConfig,
} from "./convention.js";
import {
  commitPayload,
  commitTrackerMutation,
  formatCommitLine,
  readAutoCommitConfig,
  resolveAutoCommit,
  trackerCommitMessage,
} from "./tracker-commit.js";
import { runUpdate } from "./update.js";

const NOW = new Date("2026-09-13T12:00:00Z");

function git(args: string[], cwd: string): string {
  const r = spawnSync("git", args, { encoding: "utf8", cwd });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
}

/** Paths touched by a commit (posix, repo-relative). */
function committedPaths(cwd: string, ref = "HEAD"): string[] {
  const out = git(["show", "--name-only", "--format=", ref], cwd);
  return out.split("\n").filter((line) => line.length > 0).sort();
}

function status(cwd: string): string {
  return git(["status", "--porcelain"], cwd);
}

/** Git repo with the init scaffold committed and a story + task ready to mutate. */
function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-tracker-commit-"));
  git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch", id: "auth", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "login", now: NOW });
  runCreate({ cwd: dir, type: "task", title: "Rate limit", parent: "login", id: "rate-limit", now: NOW });
  // init also generates governing docs; commit the whole scaffold (fixture
  // setup in a throwaway temp repo — same as the worktree.test.ts pattern)
  // so per-test diffs only show the mutation under test.
  git(["add", "-A"], dir);
  git(["commit", "--quiet", "-m", "init tasks"], dir);
  return dir;
}

describe("tracker-commit helpers", () => {
  it("applies CLI flag > config > built-in default (true)", () => {
    expect(resolveAutoCommit(undefined, null)).toBe(true);
    expect(resolveAutoCommit(undefined, true)).toBe(true);
    expect(resolveAutoCommit(undefined, false)).toBe(false);
    expect(resolveAutoCommit(false, true)).toBe(false);
    expect(resolveAutoCommit(true, false)).toBe(true);
  });

  it("reads x-tracker.auto-commit tolerantly", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-tracker-cfg-"));
    runInit({ dir, force: false });
    expect(readAutoCommitConfig(dir)).toBeNull();
    writeFileSync(
      join(dir, "tasks/.convention.yml"),
      "version: 3\nx-tracker:\n  auto-commit: false\n",
      "utf8",
    );
    expect(readAutoCommitConfig(dir)).toBe(false);
    // Malformed config never fails a mutation — falls back to the default.
    writeFileSync(join(dir, "tasks/.convention.yml"), "x-tracker:\n  auto-commit: maybe\n");
    expect(readAutoCommitConfig(dir)).toBeNull();
    // allow-steal (bug-cli-steal-not-gated) shares the x-tracker namespace.
    writeFileSync(
      join(dir, "tasks/.convention.yml"),
      "x-tracker:\n  allow-steal: true\n",
      "utf8",
    );
    expect(readConventionConfig(dir).tracker.allowSteal).toBe(true);
    expect(readConventionConfig(dir).tracker.autoCommit).toBeNull();
  });

  it("formats the message convention and the human/payload views", () => {
    expect(trackerCommitMessage("created", ["task-x"])).toBe("chore(tasks): created task-x");
    expect(trackerCommitMessage("pruned", ["task-a", "task-b"])).toBe(
      "chore(tasks): pruned task-a, task-b",
    );
    const ok = commitTrackerMutation("/nonexistent", [], { message: "m", commit: false });
    expect(commitPayload(ok)).toEqual({ skipped: "auto-commit disabled" });
    expect(formatCommitLine(ok)).toBe("no-commit: tasks dirty state kept");
    expect(formatCommitLine(undefined)).toBeNull();
    expect(formatCommitLine({ committed: true, hash: "abc1234", message: "m" })).toBe(
      "committed: abc1234 m",
    );
    expect(formatCommitLine({ committed: false, skipReason: "not a git repository" })).toBe(
      "no-commit: not a git repository",
    );
  });
});

describe("tracker auto-commit on create", () => {
  it("commits the created file with only that path and the item id in the message", () => {
    const dir = initRepo();

    const result = runCreate({
      cwd: dir,
      type: "task",
      title: "Fresh",
      parent: "login",
      id: "fresh",
      now: NOW,
    });

    expect(result.commit).toMatchObject({
      committed: true,
      message: "chore(tasks): created task-fresh",
    });
    expect(git(["log", "--format=%s", "-1"], dir)).toBe("chore(tasks): created task-fresh");
    expect(committedPaths(dir)).toEqual(["tasks/launch/auth/login/task-fresh.md"]);
    expect(status(dir)).toBe("");
    const hash = result.commit?.hash ?? "";
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(git(["rev-parse", "--short", "HEAD"], dir)).toBe(hash);
  });

  it("--no-commit leaves the created file dirty", () => {
    const dir = initRepo();

    const result = runCreate({
      cwd: dir,
      type: "task",
      title: "Dirty",
      parent: "login",
      id: "dirty",
      commit: false,
      now: NOW,
    });

    expect(result.commit).toEqual({ committed: false, skipReason: "auto-commit disabled" });
    expect(status(dir)).toContain("tasks/launch/auth/login/task-dirty.md");
    expect(git(["log", "--format=%s", "-1"], dir)).toBe("init tasks");
  });

  it("honors x-tracker.auto-commit: false from the config", () => {
    const dir = initRepo();
    writeFileSync(
      join(dir, "tasks/.convention.yml"),
      "version: 3\nx-tracker:\n  auto-commit: false\n",
      "utf8",
    );

    const result = runCreate({
      cwd: dir,
      type: "task",
      title: "Configured",
      parent: "login",
      id: "configured",
      now: NOW,
    });

    expect(result.commit).toEqual({ committed: false, skipReason: "auto-commit disabled" });
    expect(status(dir)).toContain("tasks/launch/auth/login/task-configured.md");
  });

  it("lets an explicit opt-in override a disabled config", () => {
    const dir = initRepo();
    writeFileSync(
      join(dir, "tasks/.convention.yml"),
      "version: 3\nx-tracker:\n  auto-commit: false\n",
      "utf8",
    );

    const result = runCreate({
      cwd: dir,
      type: "task",
      title: "Override",
      parent: "login",
      id: "override",
      commit: true,
      now: NOW,
    });

    expect(result.commit?.committed).toBe(true);
    expect(committedPaths(dir)).toEqual(["tasks/launch/auth/login/task-override.md"]);
  });

  it("skips silently on a non-git tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-tracker-nogit-"));
    runInit({ dir, force: false });
    runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });

    const result = runCreate({
      cwd: dir,
      type: "epic",
      title: "Auth",
      parent: "launch",
      id: "auth",
      now: NOW,
    });

    expect(result.commit).toEqual({ committed: false, skipReason: "not a git repository" });
  });

  it("never sweeps unrelated dirty files into the commit", () => {
    const dir = initRepo();
    // The user's own pre-existing dirty state, inside and outside tasks/.
    writeFileSync(join(dir, "tasks/scratch.txt"), "wip");
    writeFileSync(join(dir, "notes.txt"), "wip");

    const result = runCreate({
      cwd: dir,
      type: "task",
      title: "Surgical",
      parent: "login",
      id: "surgical",
      now: NOW,
    });

    expect(result.commit?.committed).toBe(true);
    expect(committedPaths(dir)).toEqual(["tasks/launch/auth/login/task-surgical.md"]);
    // The user's dirty files remain dirty (staged only the tool's path).
    expect(status(dir)).toContain("?? tasks/scratch.txt");
    expect(status(dir)).toContain("?? notes.txt");
    expect(status(dir)).not.toMatch(/task-surgical/);
  });
});

describe("tracker auto-commit on comment", () => {
  it("commits the commented item file", () => {
    const dir = initRepo();

    const result = runComment({
      cwd: dir,
      id: "task-rate-limit",
      text: "handing off to the next agent",
      author: "arggon",
      now: NOW,
    });

    expect(result.commit).toMatchObject({
      committed: true,
      message: "chore(tasks): commented task-rate-limit",
    });
    expect(committedPaths(dir)).toEqual(["tasks/launch/auth/login/task-rate-limit.md"]);
    expect(status(dir)).toBe("");
    const raw = readFileSync(result.path, "utf8");
    expect(raw).toContain("handing off to the next agent");
  });

  it("--no-commit keeps the comment uncommitted", () => {
    const dir = initRepo();

    const result = runComment({
      cwd: dir,
      id: "task-rate-limit",
      text: "wip note",
      author: "arggon",
      commit: false,
      now: NOW,
    });

    expect(result.commit).toEqual({ committed: false, skipReason: "auto-commit disabled" });
    expect(status(dir)).toContain("tasks/launch/auth/login/task-rate-limit.md");
  });
});

describe("tracker auto-commit on adopt", () => {
  it("creates ONE commit covering the story and the task files", () => {
    const dir = initRepo();

    const result = runAdopt({ cwd: dir, now: NOW });

    expect(result.storyCreated).toBe(true);
    expect(result.taskCreated).toBe(true);
    expect(result.commit).toMatchObject({
      committed: true,
      message: "chore(tasks): adopted task-adopt-arggon",
    });
    expect(committedPaths(dir)).toEqual([
      "tasks/launch/auth/story-arggon-adoption/story-arggon-adoption.md",
      "tasks/launch/auth/story-arggon-adoption/task-adopt-arggon.md",
    ]);
    expect(status(dir)).toBe("");
  });

  it("respects --no-commit (both files stay dirty)", () => {
    const dir = initRepo();

    const result = runAdopt({ cwd: dir, commit: false, now: NOW });

    expect(result.taskCreated).toBe(true);
    expect(result.commit).toEqual({ committed: false, skipReason: "auto-commit disabled" });
    // Both new files stay untracked (git collapses the fresh directory).
    expect(status(dir)).toContain("tasks/launch/auth/story-arggon-adoption/");
  });
});

describe("tracker auto-commit on cleanup --prune", () => {
  /** One done+merged worktree cycle, ready to prune (worktree.test.ts pattern). */
  function initPrunable(): string {
    const dir = initRepo();
    const started = runStart(
      { cwd: dir, id: "task-rate-limit", assignee: "arggon", worktree: true, now: NOW },
      { git: { ...defaultStartGit(), pushBranch: () => {}, createDraftPr: () => "https://example/pr/1" } },
    );
    const wt = started.worktreePath!;
    runUpdate({ cwd: wt, id: "task-rate-limit", status: "done", now: NOW });
    git(["add", "tasks"], wt);
    git(["commit", "--quiet", "-m", "close task-rate-limit"], wt);
    // Fast-forward main: brings the worktree_path record (and done status)
    // into the main checkout with a clean tree.
    git(["merge", "--quiet", "feat/task-rate-limit"], dir);
    return dir;
  }

  it("commits the cleared worktree_path records", () => {
    const dir = initPrunable();

    const result = runCleanup({ cwd: dir, prune: true });

    expect(result.failures).toEqual([]);
    expect(result.pruned.map((a) => a.action)).toContain("cleared worktree_path");
    expect(result.commit).toMatchObject({
      committed: true,
      message: "chore(tasks): pruned task-rate-limit",
    });
    expect(committedPaths(dir)).toEqual(["tasks/launch/auth/login/task-rate-limit.md"]);
    expect(status(dir)).toBe("");
    const data = parseFrontmatter(
      readFileSync(join(dir, "tasks/launch/auth/login/task-rate-limit.md"), "utf8"),
    ).data;
    expect(data.worktree_path).toBeUndefined();
  });

  it("skips the commit with --no-commit (records cleared, tree dirty)", () => {
    const dir = initPrunable();

    const result = runCleanup({ cwd: dir, prune: true, commit: false });

    expect(result.failures).toEqual([]);
    expect(result.commit).toEqual({ committed: false, skipReason: "auto-commit disabled" });
    expect(status(dir)).toContain("tasks/launch/auth/login/task-rate-limit.md");
  });

  it("reports no commit when nothing was pruned", () => {
    const dir = initRepo();

    const result = runCleanup({ cwd: dir, prune: true });

    expect(result.pruned).toEqual([]);
    expect(result.commit).toBeUndefined();
    expect(commitPayload(result.commit)).toBeUndefined();
  });
});

describe("commitTrackerMutation edge cases", () => {
  it("reports nothing-to-commit when the paths carry no changes", () => {
    const dir = initRepo();
    const itemPath = resolve(dir, "tasks/launch/auth/login/task-rate-limit.md");

    const result = commitTrackerMutation(dir, [itemPath], {
      message: trackerCommitMessage("commented", ["task-rate-limit"]),
    });

    expect(result).toEqual({ committed: false, skipReason: "nothing to commit" });
    expect(status(dir)).toBe("");
  });
});
