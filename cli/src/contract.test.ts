import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toContractWorkItem } from "./contract.js";
import type { WorkItem as KernelWorkItem } from "./items.js";

const KERNEL_ITEM: KernelWorkItem = {
  type: "task",
  status: "todo",
  id: "task-rate-limit",
  title: "Add login rate limiting",
  assignee: null,
  parent: "story-login",
  labels: ["security"],
  created: "2026-09-03",
  updated: "2026-09-03",
  blockedReason: undefined,
  dependsOn: [],
  extras: {},
  filePath: join("/tmp/repo", "tasks/launch-mvp/auth/story-login/task-rate-limit.md"),
  containerDir: join("/tmp/repo", "tasks/launch-mvp/auth/story-login"),
  data: {},
  body: "",
};

describe("toContractWorkItem", () => {
  it("maps the kernel item to the stable contract shape", () => {
    expect(toContractWorkItem(KERNEL_ITEM, "/tmp/repo")).toEqual({
      id: "task-rate-limit",
      type: "task",
      status: "todo",
      title: "Add login rate limiting",
      assignee: null,
      branch: null,
      parent: "story-login",
      labels: ["security"],
      created: "2026-09-03",
      updated: "2026-09-03",
      path: "tasks/launch-mvp/auth/story-login/task-rate-limit.md",
      blocked_reason: null,
      milestone: null,
      depends_on: [],
      claimed_at: null,
      worktree_path: null,
      issue: null,
    });
  });

  it("normalizes missing optionals to null", () => {
    const item = toContractWorkItem(
      { ...KERNEL_ITEM, title: undefined, created: undefined, updated: undefined },
      "/tmp/repo",
    );
    expect(item.title).toBeNull();
    expect(item.created).toBeNull();
    expect(item.updated).toBeNull();
    expect(item.branch).toBeNull();
  });

  it("compact default omits null/empty optional fields (ADR 0006)", () => {
    const item = toContractWorkItem(KERNEL_ITEM, "/tmp/repo", { full: false });
    expect(item).not.toHaveProperty("blocked_reason");
    expect(item).not.toHaveProperty("milestone");
    expect(item).not.toHaveProperty("worktree_path");
    expect(item).not.toHaveProperty("issue");
    expect(item).not.toHaveProperty("depends_on");
    // KERNEL_ITEM.labels is non-empty, so labels survives compaction.
    expect(item.labels).toEqual(["security"]);
    // Present, non-null fields survive untouched.
    expect(item.assignee).toBeNull();
    expect(item.claimed_at).toBeNull();
  });

  it("compact default keeps set optional fields", () => {
    const item = toContractWorkItem(
      {
        ...KERNEL_ITEM,
        labels: ["security"],
        dependsOn: ["task-other"],
        issue: 42,
        blockedReason: "waiting on review",
      },
      "/tmp/repo",
      { full: false },
    );
    expect(item.labels).toEqual(["security"]);
    expect(item.depends_on).toEqual(["task-other"]);
    expect(item.issue).toBe(42);
    expect(item.blocked_reason).toBe("waiting on review");
  });

  it("maps a set branch through", () => {
    const item = toContractWorkItem(
      { ...KERNEL_ITEM, branch: "feat/task-rate-limit" },
      "/tmp/repo",
    );
    expect(item.branch).toBe("feat/task-rate-limit");
  });
});
