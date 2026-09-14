/**
 * Tracker auto-commit tests (story-tracker-hygiene, task-auto-commit-tracker).
 * Spawns real git inside temp repos (worktree.test.ts pattern) and asserts
 * that create/comment/adopt/cleanup --prune commit ONLY their own mutated
 * paths, honor --no-commit and x-tracker.auto-commit, and skip silently on
 * non-git trees.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { runImportIssues } from "./import-issues.js";
import {
  commitPayload,
  commitTrackerMutation,
  formatCommitLine,
  readAutoCommitConfig,
  resolveAutoCommit,
  trackerCommitMessage,
  updateCommitMessage,
} from "./tracker-commit.js";
import { maybeCommitUpdate, runUpdate } from "./update.js";

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

const NOW = new Date("2026-09-13T12:00:00Z");

function commitAllIfDirty(dir: string, message: string): void {
  spawnSync("git", ["add", "-A"], { cwd: dir, stdio: "pipe" });
  const r = spawnSync("git", ["commit", "--quiet", "-m", message], { cwd: dir, stdio: "pipe" });
  // init/creates auto-commit now (tracker hygiene); "nothing to commit" is fine.
  if (r.status !== 0 && !/nothing to commit/.test(String(r.stderr) + String(r.stdout))) {
    throw new Error(`git commit failed: ${r.stderr}`);
  }
}

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
  commitAllIfDirty(dir, "init tasks");
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
    // Scaffold commits are auto-created now (init + creates, tracker hygiene).
    expect(git(["log", "--format=%s", "-1"], dir)).toBe("chore(tasks): created task-rate-limit");
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

describe("tracker auto-commit on update", () => {
  /** Tick every acceptance checkbox so the done-flip cascade can complete the whole chain. */
  function acceptanceOpen(dir: string): void {
    for (const rel of [
      "tasks/launch/launch.md",
      "tasks/launch/auth/auth.md",
      "tasks/launch/auth/login/login.md",
    ]) {
      const full = join(dir, rel);
      writeFileSync(full, readFileSync(full, "utf8").replaceAll("- [ ] ", "- [x] ticked\n"), "utf8");
    }
    // Legal kernel path to done: claim first (todo -> done is illegal).
    runUpdate({ cwd: dir, id: "task-rate-limit", status: "in_progress", assignee: "arggon", now: NOW });
    git(["add", "tasks"], dir);
    git(["commit", "--quiet", "-m", "tick acceptance"], dir);
  }

  it("commits ONE commit touching exactly the mutated paths, cascade ids in the message", () => {
    const dir = initRepo();
    acceptanceOpen(dir);

    const result = runUpdate({ cwd: dir, id: "task-rate-limit", status: "done", now: NOW });
    expect(result.autoCompleted).toEqual(["login", "auth", "launch"]);
    const commit = maybeCommitUpdate(result, undefined);

    expect(commit).toMatchObject({
      committed: true,
      message: "chore(tasks): done task-rate-limit (cascade: login, auth, launch)",
    });
    expect(committedPaths(dir)).toEqual([
      "tasks/launch/auth/auth.md",
      "tasks/launch/auth/login/login.md",
      "tasks/launch/auth/login/task-rate-limit.md",
      "tasks/launch/launch.md",
    ]);
    expect(status(dir)).toBe("");
  });

  it("--no-commit keeps every mutated file dirty (cascade included)", () => {
    const dir = initRepo();
    acceptanceOpen(dir);

    const result = runUpdate({ cwd: dir, id: "task-rate-limit", status: "done", now: NOW });
    const commit = maybeCommitUpdate(result, false);

    expect(commit).toEqual({ committed: false, skipReason: "auto-commit disabled" });
    expect(status(dir)).toContain("tasks/launch/launch.md");
    expect(status(dir)).toContain("tasks/launch/auth/login/task-rate-limit.md");
    expect(git(["log", "--format=%s", "-1"], dir)).toBe("tick acceptance");
  });

  it("honors x-tracker.auto-commit: false from the config", () => {
    const dir = initRepo();
    acceptanceOpen(dir);
    writeFileSync(join(dir, "tasks/.convention.yml"), "version: 3\nx-tracker:\n  auto-commit: false\n", "utf8");

    const result = runUpdate({ cwd: dir, id: "task-rate-limit", status: "done", now: NOW });
    const commit = maybeCommitUpdate(result, undefined);

    expect(commit).toEqual({ committed: false, skipReason: "auto-commit disabled" });
    expect(status(dir)).toContain("tasks/launch/launch.md");
  });

  it("skips the commit on a no-op update (nothing requested changed)", () => {
    const dir = initRepo();

    const result = runUpdate({ cwd: dir, id: "task-rate-limit", title: "Rate limit", now: NOW });
    expect(result.changed).toEqual([]);
    expect(maybeCommitUpdate(result, undefined)).toBeUndefined();
    // Scaffold commits are auto-created now (init + creates, tracker hygiene).
    expect(git(["log", "--format=%s", "-1"], dir)).toBe("chore(tasks): created task-rate-limit");
  });

  it("builds the cascade message suffix only when the cascade fired", () => {
    expect(updateCommitMessage("done", "task-x", [])).toBe("chore(tasks): done task-x");
    expect(updateCommitMessage("done", "task-x", ["story-a", "epic-b"])).toBe(
      "chore(tasks): done task-x (cascade: story-a, epic-b)",
    );
    expect(updateCommitMessage("claimed", "task-y", [])).toBe("chore(tasks): claimed task-y");
    expect(updateCommitMessage("updated", "task-z", [])).toBe("chore(tasks): updated task-z");
  });
});

const IMPORT_PAYLOAD = JSON.stringify([
  { number: 1, title: "Fix login", state: "OPEN", body: "broken", labels: [] },
  { number: 2, title: "Dark mode", state: "CLOSED", body: "shipped", labels: [] },
]);

/** Git-committed variant of primed(): init + initiative + epic, all committed. */
function initImportRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-tracker-import-"));
  git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch", id: "launch", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Backlog", parent: "launch", id: "backlog", now: NOW });
  commitAllIfDirty(dir, "init tasks");
  return dir;
}

function execGh(payload: string) {
  return ((_file: string, args: string[]) => {
    if (args[0] === "issue") return payload;
    throw new Error(`Unexpected: ${args.join(" ")}`);
  }) as unknown as import("./import-issues.js").GhExecutor;
}

describe("tracker auto-commit on import-issues", () => {
  it("commits ONE commit covering the story and every created item", () => {
    const dir = initImportRepo();

    const result = runImportIssues({ cwd: dir, execGh: execGh(IMPORT_PAYLOAD), now: NOW });

    expect(result.created).toBe(2);
    expect(result.commit).toMatchObject({
      committed: true,
      message: "chore(tasks): imported 2 issues",
    });
    expect(committedPaths(dir)).toEqual([
      "tasks/launch/backlog/story-imported-issues/story-imported-issues.md",
      "tasks/launch/backlog/story-imported-issues/task-issue-1.md",
      "tasks/launch/backlog/story-imported-issues/task-issue-2.md",
    ]);
    expect(status(dir)).toBe("");
  });

  it("--no-commit keeps the imported files dirty", () => {
    const dir = initImportRepo();

    const result = runImportIssues({
      cwd: dir,
      execGh: execGh(IMPORT_PAYLOAD),
      commit: false,
      now: NOW,
    });

    expect(result.commit).toEqual({ committed: false, skipReason: "auto-commit disabled" });
    expect(status(dir)).toContain("tasks/launch/backlog/story-imported-issues/");
    // Scaffold commits are auto-created now (init + creates, tracker hygiene).
    expect(git(["log", "--format=%s", "-1"], dir)).toBe("chore(tasks): created backlog");
  });

  it("a mid-run failure keeps the historic no-commit behavior (dirty + error, no commit)", () => {
    const dir = initImportRepo();
    const bad = JSON.stringify([
      { number: 1, title: "Fix login", state: "OPEN", body: "broken", labels: [] },
      { number: 0, title: "Broken", state: "OPEN", body: "", labels: [] },
    ]);

    expect(() => runImportIssues({ cwd: dir, execGh: execGh(bad), now: NOW })).toThrow(
      "valid issue number",
    );
    // The first issue and its story were written but never committed.
    expect(status(dir)).toContain("tasks/launch/backlog/story-imported-issues/");
    // Scaffold commits are auto-created now (init + creates, tracker hygiene).
    expect(git(["log", "--format=%s", "-1"], dir)).toBe("chore(tasks): created backlog");
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

describe("commitTrackerMutation index.lock contention (bug-autocommit-silent-skip)", () => {
  /** Mutate the item on disk so the next commit has something to stage. */
  function dirtyItem(dir: string): string {
    const itemPath = join(dir, "tasks/launch/auth/login/task-rate-limit.md");
    const raw = readFileSync(itemPath, "utf8");
    writeFileSync(itemPath, `${raw}\n- contention note\n`, "utf8");
    return itemPath;
  }

  /**
   * Hold git's index.lock from a detached node child that removes it after
   * `ms` (the mutation runs synchronously, so the release must come from
   * another process — the same real-contention pattern as the torture lab).
   */
  function releaseLockAfter(dir: string, ms: number): void {
    const lock = join(dir, ".git/index.lock");
    writeFileSync(lock, "", "utf8");
    const child = spawn(
      process.execPath,
      ["-e", `setTimeout(() => require("node:fs").rmSync(${JSON.stringify(lock)}), ${ms})`],
      { stdio: "ignore" },
    );
    child.unref();
  }

  it("retries and commits once the lock is released mid-backoff", () => {
    const dir = initRepo();
    const itemPath = dirtyItem(dir);
    releaseLockAfter(dir, 200); // gone by retry 2 (75ms) / 3 (225ms)

    const result = commitTrackerMutation(dir, [itemPath], {
      message: trackerCommitMessage("commented", ["task-rate-limit"]),
    });

    expect(result).toMatchObject({ committed: true });
    expect(status(dir)).toBe("");
  }, 15_000);

  it("reports the skip (payload + stderr warning) when the lock is held past the retry budget", () => {
    const dir = initRepo();
    const itemPath = dirtyItem(dir);
    writeFileSync(join(dir, ".git/index.lock"), "", "utf8");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const result = commitTrackerMutation(dir, [itemPath], {
        message: trackerCommitMessage("commented", ["task-rate-limit"]),
        // Small injected budget: exercises the exhausted-skip path in
        // milliseconds instead of the full 10s default.
        commitRetryTimeoutMs: 300,
      });

      expect(result).toEqual({ committed: false, skipReason: "git index locked" });
      expect(commitPayload(result)).toEqual({ skipped: "git index locked" });
      // Human output is never silent: the skip warns on stderr...
      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining("commit skipped: git index locked"),
      );
      // ...and the file state is consistent: mutation written, still dirty.
      expect(readFileSync(itemPath, "utf8")).toContain("contention note");
      expect(status(dir)).toContain("tasks/launch/auth/login/task-rate-limit.md");
    } finally {
      stderr.mockRestore();
    }
  }, 15_000);
});
