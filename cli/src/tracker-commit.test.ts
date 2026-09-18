/**
 * Tracker auto-commit tests (story-tracker-hygiene, task-auto-commit-tracker).
 * Spawns real git inside temp repos (worktree.test.ts pattern) and asserts
 * that create/comment/adopt/cleanup --prune commit ONLY their own mutated
 * paths, honor --no-commit and x-tracker.auto-commit, and skip silently on
 * non-git trees.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
  resolveCommonGitDir,
  trackerCommitMessage,
  trackerGitLockKey,
  updateCommitMessage,
} from "./tracker-commit.js";
import { lockFilePathFor } from "./lock.js";
import { maybeCommitUpdate, runUpdate } from "./update.js";
import { disableAutoMaintenance, removeFixtureTree } from "./test-tmp.js";

// bug-tmp-fixture-leak + bug-tracker-commit-enotempty-flake +
// bug-ci-enotempty-rmretry: track mkdtemp dirs and the detached lock-release
// children, then remove the dirs through the shared settling helper
// (test-tmp.ts). The writer that broke teardown is git's detached
// `git maintenance run --auto --detach` child (spawned by commit/merge): it
// holds `.git/objects/maintenance.lock` for its whole run, and Node's rmSync
// retry loop only re-tries the bare rmdir, never re-reads the children, so a
// held lock defeats the whole window. Fixtures opt out via
// disableAutoMaintenance(); removeFixtureTree() re-traverses on retriable
// errors.
const tmpDirs: string[] = [];
/** Detached node children spawned to release lock files mid-test. */
const lockReleaseChildren = new Set<ChildProcess>();
afterEach(async () => {
  // Settle (and, if stuck, kill) the detached children BEFORE deleting the
  // fixtures, so nothing they do overlaps the recursive removal below.
  await Promise.all([...lockReleaseChildren].map(settleChild));
  lockReleaseChildren.clear();
  for (const dir of tmpDirs.splice(0)) {
    removeFixtureTree(dir);
  }
});

/** Resolve when `child` exits; SIGKILL it after a bounded grace period. */
function settleChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise<void>((done) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 2_000);
    timer.unref();
    child.once("exit", () => {
      clearTimeout(timer);
      done();
    });
  });
}

/**
 * Spawn a detached child that removes `lock` after `ms` (the mutation under
 * test runs synchronously, so the release must come from another process).
 * Registered with the afterEach so cleanup never races a live child.
 */
function spawnLockRelease(lock: string, ms: number): void {
  const child = spawn(
    process.execPath,
    ["-e", `setTimeout(() => require("node:fs").rmSync(${JSON.stringify(lock)}), ${ms})`],
    { stdio: "ignore" },
  );
  lockReleaseChildren.add(child);
  child.once("exit", () => lockReleaseChildren.delete(child));
  child.unref();
}
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
  // bug-ci-enotempty-rmretry: no detached maintenance daemon in fixtures.
  disableAutoMaintenance(dir);
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

  // bug-validate-stdout-injection L2: the skip reason embeds external-tool
  // output (git stderr/stdout) which can quote a hostile repo path.
  it("sanitizes a hostile skip reason on the human line; payload keeps it raw", () => {
    const hostile = "git commit failed: \u001b[31m\u0085\u007f\u2028\u2029 bad path";
    expect(formatCommitLine({ committed: false, skipReason: hostile })).toBe(
      "no-commit: git commit failed: \\u001b[31m\\u0085\\u007f\\u2028\\u2029 bad path",
    );
    // payload view (--json commit.skipped) is untouched by the display policy
    expect(commitPayload({ committed: false, skipReason: hostile })).toEqual({ skipped: hostile });
    // ordinary skip reasons stay byte-identical
    expect(formatCommitLine({ committed: false, skipReason: "git not found" })).toBe(
      "no-commit: git not found",
    );
  });
});

// bug-init-ignored-artifacts-dirty-commit: `git add` refuses the WHOLE batch
// when one path is ignored, after staging the rest — init's generated-bundle
// sweep hit that on adopters that gitignore `.agents/skills/**`, leaving a
// dirty index with no commit. The primitive partitions ignored paths out,
// commits the rest, and reports what it skipped.
describe("tracker auto-commit with gitignored paths", () => {
  /**
   * Repo with one tracked (`tasks/state.yml`) and one ignored
   * (`tasks/generated.bundle`) file; each is mutated on request.
   */
  function ignoredRepo(opts: { trackedDirty?: boolean; ignoredDirty?: boolean } = {}): {
    dir: string;
    tracked: string;
    ignored: string;
  } {
    const { trackedDirty = true, ignoredDirty = true } = opts;
    const dir = mkdtempSync(join(tmpdir(), "arggon-ignored-"));
    git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
    git(["config", "user.email", "test@example.com"], dir);
    git(["config", "user.name", "Test"], dir);
    writeFileSync(join(dir, ".gitignore"), "*.bundle\n", "utf8");
    mkdirSync(join(dir, "tasks"), { recursive: true });
    writeFileSync(join(dir, "tasks/state.yml"), "state\n", "utf8");
    git(["add", ".gitignore", "tasks/state.yml"], dir);
    git(["commit", "--quiet", "-m", "fixture"], dir);
    if (trackedDirty) writeFileSync(join(dir, "tasks/state.yml"), "state updated\n", "utf8");
    if (ignoredDirty) writeFileSync(join(dir, "tasks/generated.bundle"), "derived\n", "utf8");
    return { dir, tracked: "tasks/state.yml", ignored: "tasks/generated.bundle" };
  }

  it("stages only non-ignored paths, commits them, and reports the ignored ones", () => {
    const { dir, tracked, ignored } = ignoredRepo();

    // Absolute paths: the form tracker mutations (create/update/comment) pass.
    const result = commitTrackerMutation(dir, [join(dir, tracked), join(dir, ignored)], {
      message: trackerCommitMessage("generated", ["init docs (2 files)"]),
    });

    expect(result).toMatchObject({ committed: true, ignored: [ignored] });
    expect(committedPaths(dir)).toEqual([tracked]);
    // The ignored derived file stays untracked-and-ignored: clean status.
    expect(status(dir)).toBe("");
    expect(commitPayload(result)).toEqual({
      hash: result.hash,
      message: "chore(tasks): generated init docs (2 files)",
      ignored: [ignored],
    });
  });

  it("skips with a precise reason and reports when every path is ignored", () => {
    const { dir, ignored } = ignoredRepo({ trackedDirty: false });

    const result = commitTrackerMutation(dir, [ignored], {
      message: trackerCommitMessage("generated", ["init docs (1 files)"]),
    });

    expect(result).toEqual({
      committed: false,
      skipReason: "all mutated paths are ignored by .gitignore",
      ignored: [ignored],
    });
    expect(commitPayload(result)).toEqual({
      skipped: "all mutated paths are ignored by .gitignore",
      ignored: [ignored],
    });
    // No empty commit, no dirty index.
    expect(git(["log", "--format=%s"], dir)).toBe("fixture");
    expect(status(dir)).toBe("");
  });

  it("stages a TRACKED path that matches an ignore pattern (the index wins)", () => {
    const { dir } = ignoredRepo({ trackedDirty: false });
    // Force-add the ignored path, commit it; once tracked it stages normally.
    git(["add", "-f", "tasks/generated.bundle"], dir);
    git(["commit", "--quiet", "-m", "track derived bundle"], dir);
    writeFileSync(join(dir, "tasks/generated.bundle"), "derived v2\n", "utf8");

    const result = commitTrackerMutation(dir, ["tasks/generated.bundle"], {
      message: trackerCommitMessage("updated", ["bundle"]),
    });

    expect(result).toMatchObject({ committed: true });
    expect(result.ignored).toBeUndefined();
    expect(committedPaths(dir)).toEqual(["tasks/generated.bundle"]);
    expect(status(dir)).toBe("");
  });

  it("reports the ignored count on the human commit line", () => {
    expect(
      formatCommitLine({
        committed: true,
        hash: "abc1234",
        message: "chore(tasks): generated init docs (2 files)",
        ignored: ["tasks/generated.bundle"],
      }),
    ).toBe(
      "committed: abc1234 chore(tasks): generated init docs (2 files) (1 ignored path(s) skipped)",
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
  // bug-ci-enotempty-rmretry: no detached maintenance daemon in fixtures.
  disableAutoMaintenance(dir);
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

    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const result = commitTrackerMutation(dir, [itemPath], {
        message: trackerCommitMessage("commented", ["task-rate-limit"]),
      });

      expect(result).toEqual({ committed: false, skipReason: "nothing to commit" });
      expect(status(dir)).toBe("");
      // Benign case (someone else already committed the content): stays quiet.
      expect(stderr).not.toHaveBeenCalled();
    } finally {
      stderr.mockRestore();
    }
  });

  // task-nothing-to-commit-masking: deterministic replay of the index-clobber
  // race (bug-torture-contention-flake2 root cause) — another process rewrites
  // the index between our `add` and `commit`, so `commit` reports "nothing to
  // commit" while our staged entry is gone and the mutated file is still
  // dirty. Simulated by faking git's commit failure (real git would commit the
  // staged entry; the interleaving is not reproducible synchronously) while
  // every other git call (status probe included) runs for real.
  it("reports a lost staged entry as a warned skip, not a quiet one", async () => {
    const dir = initRepo();
    const itemPath = join(dir, "tasks/launch/auth/login/task-rate-limit.md");
    writeFileSync(
      itemPath,
      `${readFileSync(itemPath, "utf8")}\n- uncommitted mutation\n`,
      "utf8",
    );
    const realExecFileSync = (await import("node:child_process")).execFileSync;
    vi.doMock("node:child_process", () => ({
      execFileSync: (file: string, args: string[], opts: unknown) => {
        if (args?.[0] === "commit") {
          const err = Object.assign(new Error("git failed"), {
            status: 1,
            stdout: "On branch main\nnothing to commit, working tree clean\n",
            stderr: "",
          });
          throw err;
        }
        return realExecFileSync(file, args, opts as never);
      },
    }));
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    // Drop the statically-imported module from the registry so the dynamic
    // import below re-evaluates tracker-commit.js against the mock.
    vi.resetModules();
    try {
      const { commitTrackerMutation: mockedMutation } = await import("./tracker-commit.js");
      const result = mockedMutation(dir, [itemPath], {
        message: trackerCommitMessage("commented", ["task-rate-limit"]),
      });

      // Distinct, reported skip reason (additive payload) + stderr warning.
      expect(result).toEqual({
        committed: false,
        skipReason: "nothing to commit (staged entry lost under contention)",
      });
      expect(commitPayload(result)).toEqual({
        skipped: "nothing to commit (staged entry lost under contention)",
      });
      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining(
          "commit skipped: nothing to commit (staged entry lost under contention)",
        ),
      );
      // The mutation sits written-but-uncommitted, exactly as in the race.
      expect(readFileSync(itemPath, "utf8")).toContain("uncommitted mutation");
      expect(status(dir)).toContain("tasks/launch/auth/login/task-rate-limit.md");
    } finally {
      vi.doUnmock("node:child_process");
      stderr.mockRestore();
    }
  });

  // bug-validate-stdout-injection L2: git's own failure output can quote a
  // repo-controlled path (raw ESC/DEL/C1/LS/PS). The warned skip and the human
  // no-commit line must render it inert; the payload keeps the raw text.
  it("renders hostile git failure output inert in the warned skip and human line", async () => {
    const dir = initRepo();
    const itemPath = join(dir, "tasks/launch/auth/login/task-rate-limit.md");
    writeFileSync(itemPath, `${readFileSync(itemPath, "utf8")}\n- uncommitted mutation\n`, "utf8");
    const hostile = "fatal: bad path \u001b[31m\u0085\u007f\u2028\u2029 end";
    const rawReason = `git commit failed: error: ${hostile}`;
    const inertReason =
      "git commit failed: error: fatal: bad path \\u001b[31m\\u0085\\u007f\\u2028\\u2029 end";
    const realExecFileSync = (await import("node:child_process")).execFileSync;
    vi.doMock("node:child_process", () => ({
      execFileSync: (file: string, args: string[], opts: unknown) => {
        if (args?.[0] === "commit") {
          throw Object.assign(new Error("git failed"), {
            status: 1,
            stdout: "",
            stderr: `error: ${hostile}\n`,
          });
        }
        return realExecFileSync(file, args, opts as never);
      },
    }));
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.resetModules();
    try {
      const mod = await import("./tracker-commit.js");
      const result = mod.commitTrackerMutation(dir, [itemPath], {
        message: trackerCommitMessage("commented", ["task-rate-limit"]),
      });

      expect(result).toEqual({ committed: false, skipReason: rawReason });
      // stderr warning: exactly one inert line.
      expect(stderr).toHaveBeenCalledWith(`arggon: warning: commit skipped: ${inertReason}\n`);
      // human stdout line: same value, also inert.
      expect(mod.formatCommitLine(result)).toBe(`no-commit: ${inertReason}`);
      // payload view keeps the raw value.
      expect(commitPayload(result)).toEqual({ skipped: rawReason });
    } finally {
      vi.doUnmock("node:child_process");
      stderr.mockRestore();
    }
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
    spawnLockRelease(lock, ms);
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

describe("repo-level git-mutation lock (bug-torture-contention-flake3)", () => {
  /** The tmpdir lock file guarding the repo's add+commit sequence. */
  function repoLock(dir: string): string {
    return lockFilePathFor(trackerGitLockKey(resolveCommonGitDir(dir)!));
  }

  /** Write a repo-lock file as if held by another (live, non-stale) process. */
  function holdRepoLock(dir: string, holderPid = 999_999): void {
    writeFileSync(
      repoLock(dir),
      JSON.stringify({ pid: holderPid, acquiredAt: new Date().toISOString() }),
      "utf8",
    );
  }

  it("keys the lock on the repo's shared common git dir", () => {
    const dir = initRepo();
    expect(resolveCommonGitDir(dir)).toBe(resolve(dir, ".git"));
    // Deterministic tmpdir lock file derived from the common dir, so every
    // process (and every linked worktree of the same repo) contends on it.
    expect(repoLock(dir)).toMatch(/arggon-lock-[0-9a-f]{40}\.lock$/);
    expect(trackerGitLockKey(resolveCommonGitDir(dir)!)).toBe(
      join(resolve(dir, ".git"), "arggon-tracker-git.lock"),
    );
  });

  it("keeps the surgical staging contract: unstaged dirty files stay out of the commit", () => {
    const dir = initRepo();
    const itemPath = join(dir, "tasks/launch/auth/login/task-rate-limit.md");
    writeFileSync(itemPath, `${readFileSync(itemPath, "utf8")}\n- only note\n`, "utf8");
    writeFileSync(join(dir, "user-file.txt"), "user content\n", "utf8");

    const result = commitTrackerMutation(dir, [itemPath], {
      message: trackerCommitMessage("commented", ["task-rate-limit"]),
    });

    expect(result).toMatchObject({ committed: true });
    // Our commit contains ONLY the mutated tracker path...
    expect(committedPaths(dir)).toEqual(["tasks/launch/auth/login/task-rate-limit.md"]);
    // ...and the user's dirty (unstaged) file stays out of it, still dirty.
    expect(status(dir)).toBe("?? user-file.txt");
  });
  it("waits for another arggon process holding the repo lock and commits after release", () => {
    const dir = initRepo();
    const itemPath = join(dir, "tasks/launch/auth/login/task-rate-limit.md");
    writeFileSync(itemPath, `${readFileSync(itemPath, "utf8")}\n- lock-wait note\n`, "utf8");
    holdRepoLock(dir);
    // Release from a detached child (the mutation is synchronous).
    const lock = repoLock(dir);
    spawnLockRelease(lock, 200);

    const result = commitTrackerMutation(dir, [itemPath], {
      message: trackerCommitMessage("commented", ["task-rate-limit"]),
    });

    expect(result).toMatchObject({ committed: true });
    expect(status(dir)).toBe("");
  }, 15_000);

  it("reports a warned skip when another arggon process holds the repo lock past the budget", () => {
    const dir = initRepo();
    const itemPath = join(dir, "tasks/launch/auth/login/task-rate-limit.md");
    writeFileSync(itemPath, `${readFileSync(itemPath, "utf8")}\n- repo-lock note\n`, "utf8");
    holdRepoLock(dir);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const result = commitTrackerMutation(dir, [itemPath], {
        message: trackerCommitMessage("commented", ["task-rate-limit"]),
        commitRetryTimeoutMs: 300,
      });

      expect(result).toEqual({ committed: false, skipReason: "git index locked" });
      expect(commitPayload(result)).toEqual({ skipped: "git index locked" });
      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining("commit skipped: git index locked"),
      );
      expect(status(dir)).toContain("task-rate-limit.md");
    } finally {
      stderr.mockRestore();
      // Release the fake holder: initRepo's fixture is removed in afterEach,
      // so an unreleased lock file would be stranded under tmpdir forever
      // (the age-gated global backstop reclaims dirs, not lock files). The
      // mutation already returned its warned skip above, so nothing contends.
      rmSync(repoLock(dir), { force: true });
    }
  }, 15_000);

  // The previously-flaky interleave, end-to-end at small scale: N concurrent
  // PROCESSES calling commitTrackerMutation on one repo — each mutation must
  // land in its own commit and the tree must end clean. Before the repo-level
  // lock this raced the shared index (clobber between add and commit); now
  // the mutations serialize.
  it("N=4 concurrent processes commit distinct mutations with a clean tree", async () => {
    const dir = initRepo();
    const itemPath = join(dir, "tasks/launch/auth/login/task-rate-limit.md");
    // Four extra items to mutate, seeded in one commit.
    const ids = ["task-c1", "task-c2", "task-c3", "task-c4"];
    const paths = [itemPath, ...ids.map((id) => join(dir, `tasks/launch/auth/login/${id}.md`))];
    for (const p of paths.slice(1)) writeFileSync(p, "---\nseed\n---\n", "utf8");
    commitAllIfDirty(dir, "seed concurrency items");

    // The runner lives OUTSIDE the repo: an untracked file in the fixture
    // would trip the clean-tree assertion below.
    const runnerDir = mkdtempSync(join(tmpdir(), "arggon-concurrent-committer-"));
    const runner = join(runnerDir, "concurrent-committer.mjs");
    writeFileSync(
      runner,
      `import { commitTrackerMutation, trackerCommitMessage } from ${JSON.stringify(
        resolve(new URL(".", import.meta.url).pathname, "./tracker-commit.js"),
      )};
import { appendFileSync } from "node:fs";
const [root, itemPath, id] = process.argv.slice(2);
appendFileSync(itemPath, \`- concurrent note \${id}\\n\`);
const r = commitTrackerMutation(root, [itemPath], {
  message: trackerCommitMessage("commented", [id]),
});
console.log(JSON.stringify(r));
`,
      "utf8",
    );
    const tsxCli = resolve(new URL("../../node_modules/tsx/dist/cli.mjs", import.meta.url).pathname);
    const results = await Promise.all(
      paths.map((p, i) =>
        new Promise<string>((done, fail) => {
          const child = spawn(process.execPath, [tsxCli, runner, dir, p, `item-${i}`], {
            cwd: dir,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let out = "";
          child.stdout.on("data", (d: Buffer) => (out += d));
          child.stderr.on("data", (d: Buffer) => (out += d));
          child.on("close", (code) =>
            code === 0 ? done(out) : fail(new Error(`child ${i} exited ${code}: ${out}`)),
          );
        }),
      ),
    );

    // Every process committed its own mutation — none skipped.
    results.forEach((out, i) => {
      expect(JSON.parse(out.trim().split("\n").at(-1)!), `process ${i}`).toMatchObject({
        committed: true,
      });
    });
    // The previously-flaky invariant: tree fully clean, every commit landed.
    expect(status(dir)).toBe("");
    const log = git(["log", "--format=%s", "-6"], dir);
    for (let i = 0; i < paths.length; i++) expect(log).toContain(`chore(tasks): commented item-${i}`);
  }, 60_000);
});
