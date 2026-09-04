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
      parent: "story-login",
      labels: ["security"],
      created: "2026-09-03",
      updated: "2026-09-03",
      path: "tasks/launch-mvp/auth/story-login/task-rate-limit.md",
      blocked_reason: null,
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
  });
});
