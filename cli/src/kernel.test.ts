import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.js";
import { firstDuplicateId, itemId, slugify } from "./ids.js";
import { itemsById, loadItems } from "./items.js";
import { assertParentEdge, expectedParentType } from "./relations.js";
import { assertClaimAndBlocked, canTransition, isClaimed, unclaim } from "./status.js";

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

  it("detects global id uniqueness violations", () => {
    expect(firstDuplicateId(["auth", "story-login", "auth"])).toBe("auth");
    expect(firstDuplicateId(["auth", "story-login"])).toBeUndefined();
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
    expect(isClaimed("task", "in_progress", "arggon")).toBe(true);
    expect(isClaimed("initiative", "in_progress", null)).toBe(false);
  });

  it("unclaims in_progress to todo and clears assignee", () => {
    expect(unclaim("in_progress")).toEqual({ status: "todo", assignee: null });
    expect(() => unclaim("todo")).toThrow(/in_progress/);
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

  it("round-trips unknown x-* keys", () => {
    const raw = `---
type: task
status: todo
id: task-x
x-agent: grok
---

# Hi
`;
    const { data, body } = parseFrontmatter(raw);
    expect(data["x-agent"]).toBe("grok");
    const out = stringifyFrontmatter(data, body);
    expect(out).toContain("x-agent: grok");
    expect(parseFrontmatter(out).data["x-agent"]).toBe("grok");
  });

  it("omits nulled official keys instead of writing literal null", () => {
    const out = stringifyFrontmatter(
      {
        type: "task",
        status: "todo",
        id: "task-x",
        title: "X",
        assignee: null,
        blocked_reason: null,
        labels: [],
      },
      "# X\n",
    );
    expect(out).not.toContain("assignee");
    expect(out).not.toContain("blocked_reason");
    expect(out).not.toContain("null");
  });
});

describe("items (shared tree scan)", () => {
  it("walks the sample tasks/ fixture once", () => {
    const items = loadItems(join(process.cwd(), "tasks"));
    const byId = itemsById(items);
    expect(byId.get("launch-mvp")?.type).toBe("initiative");
    expect(byId.get("auth")?.type).toBe("epic");
    expect(byId.get("story-login")?.type).toBe("story");
    expect(byId.get("task-rate-limit")?.type).toBe("task");
    expect(byId.get("bug-empty-password-500")?.type).toBe("bug");
    expect(byId.size).toBe(items.length);
    expect(firstDuplicateId(items.map((i) => i.id))).toBeUndefined();
  });
});

describe("relations (hierarchy edges)", () => {
  it("maps child type to required parent type", () => {
    expect(expectedParentType("initiative")).toBeNull();
    expect(expectedParentType("epic")).toBe("initiative");
    expect(expectedParentType("story")).toBe("epic");
    expect(expectedParentType("task")).toBe("story");
    expect(expectedParentType("bug")).toBe("story");
  });

  it("rejects skip-level and rooted parents", () => {
    assertParentEdge("initiative", null);
    assertParentEdge("epic", "initiative");
    expect(() => assertParentEdge("initiative", "epic")).toThrow(/cannot have a parent/);
    expect(() => assertParentEdge("task", "initiative")).toThrow(/must live under a story/);
    expect(() => assertParentEdge("epic", undefined)).toThrow(/requires parent type initiative/);
  });
});
