import { existsSync, lstatSync, mkdirSync, mkdtempSync as _mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { linkNodeModules, runStart, unlinkNodeModulesLink, type StartGit } from "./start.js";
import { runUpdate } from "./update.js";

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

const NOW = new Date("2026-09-03T12:00:00Z");

type Call = { op: string; arg?: string; body?: string };

function primedTask(): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-start-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp", now: NOW });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "auth",
    id: "story-login",
    now: NOW,
  });
  const task = runCreate({
    cwd: dir,
    type: "task",
    title: "Add rate limiting",
    parent: "story-login",
    id: "rate-limit",
    now: NOW,
  });
  return { dir, id: task.id };
}

function fakeGit(overrides: Partial<StartGit> = {}): StartGit & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    isRepo: () => true,
    branchExists: () => false,
    checkoutNew: (_cwd, name) => {
      calls.push({ op: "checkoutNew", arg: name });
    },
    checkoutExisting: (_cwd, name) => {
      calls.push({ op: "checkoutExisting", arg: name });
    },
    // Tree root reads clean; the claimed item file reads dirty after the claim write.
    fileStatus: (_cwd, file) => (file === "." ? "" : ` M ${file}`),
    commitFile: (_cwd, _file, message) => {
      calls.push({ op: "commit", arg: message });
    },
    pushBranch: (_cwd, branch) => {
      calls.push({ op: "push", arg: branch });
    },
    createDraftPr: (_cwd, input) => {
      calls.push({ op: "pr", arg: input.title, body: input.body });
      return "https://github.com/o/r/pull/1";
    },
    worktreeList: () => {
      calls.push({ op: "worktreeList" });
      return [];
    },
    worktreeAdd: (_cwd, path, opts) => {
      calls.push({ op: "worktreeAdd", arg: `${path} ${opts.branch}` });
    },
    ...overrides,
  };
}

describe("start", () => {
  it("claims, branches, commits, pushes, and opens a draft PR in order", () => {
    const { dir, id } = primedTask();
    const git = fakeGit();
    const result = runStart({ cwd: dir, id, assignee: "arggon", openPr: true, now: NOW }, { git });
    expect(result.branch).toBe("feat/task-rate-limit");
    expect(result.created).toBe(true);
    expect(result.committed).toBe(true);
    expect(result.pushed).toBe(true);
    expect(result.prUrl).toBe("https://github.com/o/r/pull/1");
    // No --worktree: the additive link field is present and false (never linked).
    expect(result.linkedNodeModules).toBe(false);
    expect(result.item).toMatchObject({
      status: "in_progress",
      assignee: "arggon",
      branch: "feat/task-rate-limit",
    });
    expect(git.calls.map((c) => c.op)).toEqual(["checkoutNew", "commit", "push", "pr"]);
    expect(git.calls[1]?.arg).toBe(`claim: ${id}`);
  });

  it("pushes without a PR by default", () => {
    const { dir, id } = primedTask();
    const git = fakeGit();
    const result = runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git });
    expect(result.pushed).toBe(true);
    expect(result.prUrl).toBeNull();
    expect(git.calls.some((c) => c.op === "pr")).toBe(false);
  });

  it("refuses a taken claim without touching git", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "alice", now: NOW });
    const git = fakeGit();
    expect(() => runStart({ cwd: dir, id, assignee: "bob", now: NOW }, { git })).toThrow(
      /claim conflict/,
    );
    expect(git.calls).toEqual([]);
  });

  it("refuses untracked files inside tasks/ without touching anything", () => {
    const { dir, id } = primedTask();
    writeFileSync(join(dir, "tasks/scratch.txt"), "x");
    const git = fakeGit({ fileStatus: () => "?? tasks/scratch.txt\n" });
    expect(() => runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git })).toThrow(
      /working tree has changes that block start[\s\S]*tasks\/scratch\.txt/,
    );
    expect(git.calls).toEqual([]);
    expect(readFileSync(join(dir, "tasks/scratch.txt"), "utf8")).toBe("x");
  });

  it("refuses modified tracked files", () => {
    const { dir, id } = primedTask();
    const git = fakeGit({ fileStatus: (_c, f) => (f === "." ? " M src/app.ts\n" : ` M ${f}`) });
    expect(() => runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git })).toThrow(
      /working tree has changes that block start[\s\S]*src\/app\.ts/,
    );
    expect(git.calls).toEqual([]);
  });

  it("ignores untracked files outside tasks/ (scoped clean-tree check)", () => {
    const { dir, id } = primedTask();
    mkdirSync(join(dir, ".v2c"), { recursive: true });
    writeFileSync(join(dir, ".v2c", "state.json"), "{}");
    const git = fakeGit({ fileStatus: (_c, f) => (f === "." ? "?? .v2c/\n?? notes.txt\n" : ` M ${f}`) });
    const result = runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git });
    expect(result.committed).toBe(true);
    expect(git.calls.map((c) => c.op)).toContain("commit");
  });

  it("fails clearly on existing-branch mismatch and unknown id", () => {
    const { dir, id } = primedTask();
    expect(() =>
      runStart(
        { cwd: dir, id, assignee: "arggon", now: NOW },
        { git: fakeGit({ branchExists: () => true }) },
      ),
    ).toThrow(/already exists and does not match/);
    expect(() =>
      runStart({ cwd: dir, id: "nope", assignee: "arggon", now: NOW }, { git: fakeGit() }),
    ).toThrow(/id 'nope' not found/);
  });

  it("attaches to the recorded branch and skips empty commits", () => {
    const { dir, id } = primedTask();
    runUpdate({ cwd: dir, id, branch: "feat/custom", now: NOW });
    const git = fakeGit({ branchExists: () => true, fileStatus: () => "" });
    const result = runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git });
    expect(result.branch).toBe("feat/custom");
    expect(result.created).toBe(false);
    expect(git.calls.map((c) => c.op)).toContain("checkoutExisting");
    expect(git.calls.map((c) => c.op)).not.toContain("commit");
    expect(result.pushed).toBe(false);
    expect(result.prUrl).toBeNull();
  });

  it("resolves the default assignee and requires one", () => {
    const { dir, id } = primedTask();
    const git = fakeGit({ resolveMe: () => "me-user" });
    const result = runStart({ cwd: dir, id, now: NOW }, { git });
    expect(result.item.assignee).toBe("me-user");
    expect(() =>
      runStart({ cwd: dir, id, now: NOW }, { git: fakeGit({ resolveMe: () => undefined }) }),
    ).toThrow(/could not resolve assignee/);
  });
});

describe("start --open-pr closes the linked GitHub issue (task-closes-issue-linking)", () => {
  it("appends Closes #N when the item carries an issue number", () => {
    const { dir } = primedTask();
    const item = runCreate({
      cwd: dir,
      type: "task",
      title: "Imported fix",
      parent: "story-login",
      id: "imported-fix",
      issue: 12,
      now: NOW,
    });
    const git = fakeGit();
    const result = runStart({ cwd: dir, id: item.id, assignee: "arggon", openPr: true, now: NOW }, { git });
    expect(result.prUrl).not.toBeNull();
    const pr = git.calls.find((c) => c.op === "pr");
    expect(pr?.body).toBe(
      `Work item: ${item.id}\n\nPath: tasks/launch-mvp/auth/story-login/${item.id}.md\n\n` +
        "Draft opened by `arggon start`.\n\nCloses #12",
    );
  });

  it("leaves the body unchanged for items without a linked issue", () => {
    const { dir, id } = primedTask();
    const git = fakeGit();
    runStart({ cwd: dir, id, assignee: "arggon", openPr: true, now: NOW }, { git });
    const pr = git.calls.find((c) => c.op === "pr");
    expect(pr?.body).toBe(
      `Work item: ${id}\n\nPath: tasks/launch-mvp/auth/story-login/${id}.md\n\n` +
        "Draft opened by `arggon start`.",
    );
    expect(pr?.body).not.toContain("Closes");
  });
});

describe("linkNodeModules (bug-start-worktree-node-modules)", () => {
  it("links only when the primary has node_modules and the worktree lacks one", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-link-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-link-wt-"));
    mkdirSync(join(primary, "node_modules"), { recursive: true });

    expect(linkNodeModules(primary, wt)).toBe(true);
    const link = join(wt, "node_modules");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    // Idempotent: a second call never re-links or fails.
    expect(linkNodeModules(primary, wt)).toBe(false);

    // Primary without node_modules: no-op.
    const barePrimary = mkdtempSync(join(tmpdir(), "arggon-link-bare-"));
    const bareWt = mkdtempSync(join(tmpdir(), "arggon-link-barewt-"));
    expect(linkNodeModules(barePrimary, bareWt)).toBe(false);
    expect(existsSync(join(bareWt, "node_modules"))).toBe(false);

    // Worktree with its own install: never replaced by a link.
    const ownWt = mkdtempSync(join(tmpdir(), "arggon-link-own-"));
    mkdirSync(join(ownWt, "node_modules"), { recursive: true });
    expect(linkNodeModules(primary, ownWt)).toBe(false);
    expect(lstatSync(join(ownWt, "node_modules")).isSymbolicLink()).toBe(false);
  });
});

describe("unlinkNodeModulesLink (review F1/F2)", () => {
  it("removes only a symlink pointing at the primary install, never its target", () => {
    const primary = mkdtempSync(join(tmpdir(), "arggon-unlink-primary-"));
    const wt = mkdtempSync(join(tmpdir(), "arggon-unlink-wt-"));
    mkdirSync(join(primary, "node_modules"), { recursive: true });
    writeFileSync(join(primary, "node_modules", "keep.txt"), "keep");

    // A real install is never touched.
    const ownWt = mkdtempSync(join(tmpdir(), "arggon-unlink-own-"));
    mkdirSync(join(ownWt, "node_modules"), { recursive: true });
    expect(unlinkNodeModulesLink(primary, ownWt)).toBe(false);
    expect(existsSync(join(ownWt, "node_modules"))).toBe(true);

    // A symlink to somewhere else is never touched.
    const otherWt = mkdtempSync(join(tmpdir(), "arggon-unlink-other-"));
    symlinkSync(primary, join(otherWt, "node_modules"), "dir");
    expect(unlinkNodeModulesLink(primary, otherWt)).toBe(false);
    expect(existsSync(join(otherWt, "node_modules"))).toBe(true);

    // The start-created link is removed and the primary install survives.
    expect(linkNodeModules(primary, wt)).toBe(true);
    expect(unlinkNodeModulesLink(primary, wt)).toBe(true);
    expect(existsSync(join(wt, "node_modules"))).toBe(false);
    expect(readFileSync(join(primary, "node_modules", "keep.txt"), "utf8")).toBe("keep");
    // Idempotent: nothing left to remove.
    expect(unlinkNodeModulesLink(primary, wt)).toBe(false);
  });
});
