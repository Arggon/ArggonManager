import { describe, expect, it } from "vitest";
import type { WorkItem } from "./types.js";
import {
  branchReferencesItem,
  matchItem,
  toSyncResult,
  type SyncMatchResult,
  type PRInfo,
} from "./sync-types.js";

function pr(number: number, headRefName: string): PRInfo {
  return {
    number,
    headRefName,
    title: `PR #${number}`,
    url: `https://github.com/test/test/pull/${number}`,
  };
}

describe("sync-types matchItem", () => {
  const withBranch = (id: string, branch: string): Pick<WorkItem, "id" | "branch"> => ({
    id,
    branch,
  });
  const withoutBranch = (id: string): Pick<WorkItem, "id" | "branch"> => ({ id, branch: null });

  it("returns matched when item branch matches exactly one PR headRefName", () => {
    const item = withBranch("task-1", "feat/task-1");
    const prs = [pr(42, "feat/task-1")];
    const result = matchItem(item, prs);
    const r = result as { status: "matched"; itemId: string; branch: string; prNumber: number };
    expect(r.status).toBe("matched");
    expect(r.itemId).toBe("task-1");
    expect(r.branch).toBe("feat/task-1");
    expect(r.prNumber).toBe(42);
  });

  it("returns no_pr when item branch has no matching PR", () => {
    const item = withBranch("task-1", "feat/missing");
    const prs = [pr(42, "feat/other")];
    const result = matchItem(item, prs);
    const r = result as unknown as { status: "no_pr"; itemId: string };
    expect(r.status).toBe("no_pr");
    expect(r.itemId).toBe("task-1");
  });

  it("returns ambiguous when multiple PRs have same headRefName as item branch", () => {
    const item = withBranch("task-1", "feat/shared");
    const prs = [pr(10, "feat/shared"), pr(11, "feat/shared")];
    const result = matchItem(item, prs);
    const r = result as {
      status: "ambiguous";
      itemId: string;
      branch: string;
      prNumbers: number[];
    };
    expect(r.status).toBe("ambiguous");
    expect(r.itemId).toBe("task-1");
    expect(r.branch).toBe("feat/shared");
    expect(r.prNumbers).toEqual([10, 11]);
  });

  it("returns no_pr when item has branch but no PRs exist", () => {
    const item = withBranch("task-6", "feat/x");
    const result = matchItem(item, []);
    const r = result as unknown as { status: "no_pr"; itemId: string };
    expect(r.status).toBe("no_pr");
    expect(r.itemId).toBe("task-6");
  });

  it("returns fillable when item has no branch and exactly one PR references its id", () => {
    const item = withoutBranch("task-2");
    const prs = [pr(43, "feat/task-2"), pr(44, "feat/unrelated")];
    const result = matchItem(item, prs);
    const r = result as { status: "fillable"; itemId: string; branch: string; prNumber: number };
    expect(r.status).toBe("fillable");
    expect(r.itemId).toBe("task-2");
    expect(r.branch).toBe("feat/task-2");
    expect(r.prNumber).toBe(43);
  });

  it("returns no_pr when item has no branch and no PR exists", () => {
    const item = withoutBranch("task-3");
    const result = matchItem(item, []);
    expect(result).toEqual({ status: "no_pr", itemId: "task-3" } as SyncMatchResult);
  });

  it("returns no_pr when item has no branch and no PR references its id", () => {
    const item = withoutBranch("task-3");
    const result = matchItem(item, [pr(7, "feat/someone-else")]);
    expect(result).toEqual({ status: "no_pr", itemId: "task-3" } as SyncMatchResult);
  });

  it("returns ambiguous when item has no branch and multiple PRs share one id-referencing branch", () => {
    const item = withoutBranch("task-4");
    const prs = [pr(20, "feat/task-4"), pr(21, "feat/task-4")];
    const result = matchItem(item, prs);
    const r = result as {
      status: "ambiguous";
      itemId: string;
      branch: string;
      prNumbers: number[];
    };
    expect(r.status).toBe("ambiguous");
    expect(r.itemId).toBe("task-4");
    expect(r.branch).toBe("feat/task-4");
    expect(r.prNumbers).toEqual([20, 21]);
  });

  it("returns pending — never a guess — when item has no branch and candidates disagree", () => {
    const item = withoutBranch("task-5");
    const prs = [pr(30, "feat/task-5"), pr(31, "fix/task-5")];
    const result = matchItem(item, prs);
    expect(result).toEqual({ status: "pending", itemId: "task-5" } as SyncMatchResult);
  });
});

describe("sync-types branchReferencesItem", () => {
  it("matches the id as a whole path segment", () => {
    expect(branchReferencesItem("feat/task-rate-limit", "task-rate-limit")).toBe(true);
    expect(branchReferencesItem("task-rate-limit", "task-rate-limit")).toBe(true);
  });

  it("does not match when the id runs into following slug characters", () => {
    expect(branchReferencesItem("feat/task-12", "task-1")).toBe(false);
    expect(branchReferencesItem("feat/task-1abc", "task-1")).toBe(false);
  });

  it("does not match the id inside the middle of another token", () => {
    expect(branchReferencesItem("feat/mytask-1", "task-1")).toBe(false);
  });

  it("matches custom patterns that append a suffix after the id", () => {
    expect(branchReferencesItem("feat/task-1-work", "task-1")).toBe(true);
  });

  it("does not match a longer id against its hyphen prefix", () => {
    expect(branchReferencesItem("feat/task-1", "task-1-work")).toBe(false);
  });

  it("escapes regex metacharacters in the id", () => {
    expect(branchReferencesItem("feat/task.a+b", "task.a+b")).toBe(true);
    expect(branchReferencesItem("feat/taskXab", "task.a+b")).toBe(false);
  });
});

describe("sync-types toSyncResult", () => {
  it("aggregates matches into SyncResult with matched, unmatched, pending, ambiguous", () => {
    const matches: SyncMatchResult[] = [
      { status: "matched", itemId: "a", branch: "feat/a", prNumber: 1 },
      { status: "no_pr", itemId: "c" },
      { status: "no_pr", itemId: "d" },
      { status: "ambiguous", itemId: "e", branch: "feat/e", prNumbers: [3, 4] },
      { status: "pending", itemId: "f" },
    ];

    const result = toSyncResult(matches, "check");
    expect(result.command).toBe("sync");
    expect(result.mode).toBe("check");
    expect(result.matched).toEqual(["a"]);
    expect(result.unmatched).toEqual(["c", "d"]);
    expect(result.pending).toEqual(["f"]);
    expect(result.ambiguous).toEqual([{ id: "e", branch: "feat/e", prs: [3, 4] }]);
    expect(result.filled).toBeNull();
    expect(result.errors).toEqual([]);
    expect(result.exit_code).toBe(1);
  });

  it("check mode counts fillable items as pending with suggestions (CI gate)", () => {
    const matches: SyncMatchResult[] = [
      { status: "fillable", itemId: "a", branch: "feat/a", prNumber: 1 },
    ];
    const result = toSyncResult(matches, "check");
    expect(result.pending).toEqual(["a"]);
    expect(result.suggestions).toEqual([{ id: "a", branch: "feat/a", pr: 1 }]);
    expect(result.exit_code).toBe(1);
  });

  it("write mode counts fillable items as matched", () => {
    const matches: SyncMatchResult[] = [
      { status: "fillable", itemId: "a", branch: "feat/a", prNumber: 1 },
    ];
    const result = toSyncResult(matches, "write", { a: "feat/a" });
    expect(result.matched).toEqual(["a"]);
    expect(result.pending).toEqual([]);
    expect(result.suggestions).toEqual([{ id: "a", branch: "feat/a", pr: 1 }]);
    expect(result.filled).toEqual({ a: "feat/a" });
    expect(result.exit_code).toBe(0);
  });

  it("returns exit_code 0 when no pending and no ambiguous (check mode)", () => {
    const matches: SyncMatchResult[] = [
      { status: "matched", itemId: "a", branch: "feat/a", prNumber: 1 },
      { status: "no_pr", itemId: "b" },
    ];
    const result = toSyncResult(matches, "check");
    expect(result.exit_code).toBe(0);
  });

  it("returns exit_code 1 when ambiguous in write mode", () => {
    const matches: SyncMatchResult[] = [
      { status: "matched", itemId: "a", branch: "feat/a", prNumber: 1 },
      { status: "ambiguous", itemId: "b", branch: "feat/b", prNumbers: [2, 3] },
    ];
    const result = toSyncResult(matches, "write");
    expect(result.exit_code).toBe(1);
  });

  it("includes errors in result", () => {
    const result = toSyncResult([], "check", null, ["gh not available"]);
    expect(result.errors).toEqual(["gh not available"]);
    expect(result.exit_code).toBe(1);
  });
});
