import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { runStart, type StartGit } from "./start.js";
import { runUpdate } from "./update.js";

const NOW = new Date("2026-09-03T12:00:00Z");

type Call = { op: string; arg?: string };

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
      calls.push({ op: "pr", arg: input.title });
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

  it("refuses a dirty tree without touching anything", () => {
    const { dir, id } = primedTask();
    writeFileSync(join(dir, "tasks/scratch.txt"), "x");
    const git = fakeGit({ fileStatus: () => "?? tasks/scratch.txt\n" });
    expect(() => runStart({ cwd: dir, id, assignee: "arggon", now: NOW }, { git })).toThrow(
      /working tree is dirty/,
    );
    expect(git.calls).toEqual([]);
    expect(readFileSync(join(dir, "tasks/scratch.txt"), "utf8")).toBe("x");
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
