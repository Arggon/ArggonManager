import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runBranch, type GitRunner } from "./branch.js";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

const NOW = new Date("2026-09-03T12:00:00Z");

function primedTask(): { dir: string; id: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-branch-"));
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

function fakeGit(overrides: Partial<GitRunner> = {}): GitRunner & {
  calls: Array<{ op: string; name?: string }>;
} {
  const calls: Array<{ op: string; name?: string }> = [];
  return {
    calls,
    isRepo: () => true,
    branchExists: () => false,
    checkoutNew: (cwd, name) => {
      calls.push({ op: "checkoutNew", name });
    },
    checkoutExisting: (cwd, name) => {
      calls.push({ op: "checkoutExisting", name });
    },
    ...overrides,
  };
}

describe("branch", () => {
  it("generates from the pattern, checks out, and persists the field", () => {
    const { dir, id } = primedTask();
    const git = fakeGit();
    const result = runBranch({ cwd: dir, id, now: NOW }, { git });
    expect(result.branch).toBe("feat/task-rate-limit");
    expect(result.created).toBe(true);
    expect(git.calls).toEqual([{ op: "checkoutNew", name: "feat/task-rate-limit" }]);
    expect(result.item.branch).toBe("feat/task-rate-limit");
    expect(readFileSync(result.path, "utf8")).toContain("branch: feat/task-rate-limit");
  });

  it("uses the bug pattern for bugs", () => {
    const { dir } = primedTask();
    const bug = runCreate({
      cwd: dir,
      type: "bug",
      title: "Boom",
      parent: "story-login",
      now: NOW,
    });
    const git = fakeGit();
    const result = runBranch({ cwd: dir, id: bug.id, now: NOW }, { git });
    expect(result.branch).toBe(`fix/${bug.id}`);
    expect(git.calls).toEqual([{ op: "checkoutNew", name: `fix/${bug.id}` }]);
  });

  it("attaches to the recorded branch without rewriting the file", () => {
    const { dir, id } = primedTask();
    const recorded = runUpdate({ cwd: dir, id, branch: "feat/custom", now: NOW });
    const before = readFileSync(recorded.path, "utf8");
    const git = fakeGit({ branchExists: () => true });
    const result = runBranch({ cwd: dir, id, now: NOW }, { git });
    expect(result.branch).toBe("feat/custom");
    expect(result.created).toBe(false);
    expect(git.calls).toEqual([{ op: "checkoutExisting", name: "feat/custom" }]);
    expect(readFileSync(recorded.path, "utf8")).toBe(before);
  });

  it("fails clearly when the branch exists without matching the field", () => {
    const { dir, id } = primedTask();
    const git = fakeGit({ branchExists: () => true });
    expect(() => runBranch({ cwd: dir, id, now: NOW }, { git })).toThrow(
      /branch 'feat\/task-rate-limit' already exists and does not match/,
    );
    expect(git.calls).toEqual([]);
  });

  it("fails clearly on unknown id, non-repo, and bad config", () => {
    const { dir } = primedTask();
    expect(() => runBranch({ cwd: dir, id: "nope", now: NOW }, { git: fakeGit() })).toThrow(
      /id 'nope' not found/,
    );
    expect(() =>
      runBranch(
        { cwd: dir, id: "launch-mvp", now: NOW },
        { git: fakeGit({ isRepo: () => false }) },
      ),
    ).toThrow(/not a git repository/);
  });
});
