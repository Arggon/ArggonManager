import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.js";
import { itemId, slugify } from "./ids.js";
import { assertClaimAndBlocked, canTransition } from "./status.js";

describe("ids", () => {
  it("slugifies titles", () => {
    expect(slugify("Launch MVP")).toBe("launch-mvp");
    expect(slugify("Add rate limiting")).toBe("add-rate-limiting");
  });

  it("adds leaf prefixes once", () => {
    expect(itemId("task", "rate-limit")).toBe("task-rate-limit");
    expect(itemId("task", "task-rate-limit")).toBe("task-rate-limit");
    expect(itemId("bug", "empty-password-500")).toBe("bug-empty-password-500");
    expect(itemId("epic", "auth")).toBe("auth");
  });

  it("rejects container ids with leaf prefixes", () => {
    expect(() => itemId("story", "task-nope")).toThrow(/must not start/);
  });
});

describe("status", () => {
  it("enforces claim rule on create-like assertions", () => {
    expect(() => assertClaimAndBlocked({ type: "task", status: "in_progress" })).toThrow(
      /--assignee/,
    );
    assertClaimAndBlocked({
      type: "task",
      status: "in_progress",
      assignee: "arggon",
    });
    assertClaimAndBlocked({ type: "initiative", status: "in_progress" });
  });

  it("requires blocked_reason only when blocked", () => {
    expect(() => assertClaimAndBlocked({ type: "task", status: "blocked", assignee: "a" })).toThrow(
      /blocked-reason/,
    );
    expect(() =>
      assertClaimAndBlocked({
        type: "task",
        status: "todo",
        blockedReason: "nope",
      }),
    ).toThrow(/only valid/);
  });

  it("exposes the v0 transition matrix", () => {
    expect(canTransition("todo", "done")).toBe(false);
    expect(canTransition("todo", "in_progress")).toBe(true);
  });
});

describe("frontmatter", () => {
  it("round-trips a sample task file", () => {
    const raw = readFileSync(
      join(process.cwd(), "tasks/launch-mvp/auth/story-login/task-rate-limit.md"),
      "utf8",
    );
    const { data, body } = parseFrontmatter(raw);
    expect(data.id).toBe("task-rate-limit");
    expect(data.labels).toEqual(["security"]);
    expect(data.created).toBe("2026-09-03");
    const out = stringifyFrontmatter(data, body);
    const again = parseFrontmatter(out);
    expect(again.data.id).toBe("task-rate-limit");
    expect(again.data.labels).toEqual(["security"]);
    expect(again.data.title).toBe("Add login rate limiting");
  });
});
