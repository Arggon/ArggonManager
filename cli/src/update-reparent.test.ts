import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { runList } from "./list.js";
import { runUpdate } from "./update.js";
import { runValidate } from "./validate.js";

const NOW = new Date("2026-09-14T12:00:00Z");
const LATER = new Date("2026-09-15T12:00:00Z");

/**
 * Fixture for reparent tests (task-update-reparent):
 *
 *   launch-mvp (initiative)
 *   ├── auth (epic)
 *   │   └── story-login (story)
 *   │       └── task-rate-limit (task)
 *   └── onboarding (epic)
 *       └── story-handbook (story)
 */
function primedTree(): { dir: string; tasks: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-reparent-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Onboarding", parent: "launch-mvp", now: NOW });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "auth",
    id: "story-login",
    now: NOW,
  });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Handbook",
    parent: "onboarding",
    id: "story-handbook",
    now: NOW,
  });
  runCreate({
    cwd: dir,
    type: "task",
    title: "Add rate limiting",
    parent: "story-login",
    id: "rate-limit",
    now: NOW,
  });
  return { dir, tasks: join(dir, "tasks") };
}

function fm(path: string) {
  return parseFrontmatter(readFileSync(path, "utf8"));
}

describe("update --parent (reparent)", () => {
  it("moves a leaf as a FILE into the new story's directory and rewrites parent", () => {
    const { dir, tasks } = primedTree();
    const oldPath = join(tasks, "launch-mvp", "auth", "story-login", "task-rate-limit.md");
    const newPath = join(tasks, "launch-mvp", "onboarding", "story-handbook", "task-rate-limit.md");
    expect(existsSync(oldPath)).toBe(true);

    const result = runUpdate({ cwd: dir, id: "task-rate-limit", parent: "story-handbook", now: LATER });

    expect(result.path).toBe(newPath);
    expect(result.movedFrom).toBe(oldPath);
    expect(result.changed).toContain("parent");
    expect(existsSync(oldPath)).toBe(false);
    expect(existsSync(newPath)).toBe(true);
    const { data } = fm(newPath);
    expect(data.parent).toBe("story-handbook");
    expect(data.id).toBe("task-rate-limit");
    expect(data.type).toBe("task");
    // The move stages BOTH sides so the auto-commit records a rename.
    expect(result.changedPaths).toContain(oldPath);
    expect(result.changedPaths).toContain(newPath);
  });

  it("keeps claim state intact across a leaf move", () => {
    const { dir } = primedTree();
    runUpdate({
      cwd: dir,
      id: "task-rate-limit",
      status: "in_progress",
      assignee: "arggon",
      now: NOW,
    });
    const result = runUpdate({ cwd: dir, id: "task-rate-limit", parent: "story-handbook", now: LATER });
    const { data } = fm(result.path);
    expect(data.status).toBe("in_progress");
    expect(data.assignee).toBe("arggon");
    expect(data.claimed_at).toBe(fm(result.path).data.claimed_at);
    expect(data.blocked_reason).toBeUndefined();
    expect(data.branch).toBeUndefined();
  });

  it("moves a container's WHOLE directory with children, frontmatter of children untouched", () => {
    const { dir, tasks } = primedTree();
    const oldDir = join(tasks, "launch-mvp", "auth", "story-login");
    const newDir = join(tasks, "launch-mvp", "onboarding", "story-login");
    expect(existsSync(oldDir)).toBe(true);

    const result = runUpdate({ cwd: dir, id: "story-login", parent: "onboarding", now: LATER });

    expect(result.path).toBe(join(newDir, "story-login.md"));
    expect(result.movedFrom).toBe(oldDir);
    expect(existsSync(oldDir)).toBe(false);
    expect(existsSync(join(newDir, "story-login.md"))).toBe(true);
    // The child rode along: same id, parent still references the story id.
    const childPath = join(newDir, "task-rate-limit.md");
    expect(existsSync(childPath)).toBe(true);
    expect(fm(childPath).data.parent).toBe("story-login");
    expect(fm(childPath).data.id).toBe("task-rate-limit");
    expect(fm(result.path).data.parent).toBe("onboarding");
  });

  it("stays consistent after the move: validate ok and list finds the new home", () => {
    const { dir } = primedTree();
    runUpdate({ cwd: dir, id: "story-login", parent: "onboarding", now: LATER });
    runUpdate({ cwd: dir, id: "task-rate-limit", parent: "story-handbook", now: LATER });

    expect(runValidate({ cwd: dir }).errors).toEqual([]);

    const underOnboarding = runList({ cwd: dir, filter: "parent:onboarding" }).items.map((i) => i.id);
    expect(underOnboarding).toContain("story-login");
    const underHandbook = runList({ cwd: dir, filter: "parent:story-handbook" }).items.map((i) => i.id);
    expect(underHandbook).toContain("task-rate-limit");
    const underAuth = runList({ cwd: dir, filter: "parent:auth" }).items.map((i) => i.id);
    expect(underAuth).not.toContain("story-login");
  });

  it("refuses a wrong parent type without moving anything", () => {
    const { dir, tasks } = primedTree();
    const oldPath = join(tasks, "launch-mvp", "auth", "story-login", "task-rate-limit.md");
    expect(() => runUpdate({ cwd: dir, id: "task-rate-limit", parent: "auth", now: LATER })).toThrow(
      /must live under a story/,
    );
    expect(existsSync(oldPath)).toBe(true);
    expect(fm(oldPath).data.parent).toBe("story-login");
  });

  it("refuses an unknown parent without moving anything", () => {
    const { dir, tasks } = primedTree();
    const oldPath = join(tasks, "launch-mvp", "auth", "story-login", "task-rate-limit.md");
    expect(() =>
      runUpdate({ cwd: dir, id: "task-rate-limit", parent: "story-nope", now: LATER }),
    ).toThrow(/parent 'story-nope' not found under tasks\//);
    expect(existsSync(oldPath)).toBe(true);
    expect(fm(oldPath).data.parent).toBe("story-login");
  });

  it("refuses a cycle (parent = own descendant) without moving anything", () => {
    const { dir, tasks } = primedTree();
    const oldDir = join(tasks, "launch-mvp", "auth", "story-login");
    expect(() =>
      runUpdate({ cwd: dir, id: "story-login", parent: "task-rate-limit", now: LATER }),
    ).toThrow(/own descendant/);
    expect(existsSync(join(oldDir, "story-login.md"))).toBe(true);
    expect(fm(join(oldDir, "story-login.md")).data.parent).toBe("auth");
  });

  it("refuses reparenting an initiative", () => {
    const { dir } = primedTree();
    expect(() => runUpdate({ cwd: dir, id: "launch-mvp", parent: "auth", now: LATER })).toThrow(
      /initiative cannot have a parent/,
    );
  });

  it("treats the same parent as a no-op (no move, no change entry)", () => {
    const { dir, tasks } = primedTree();
    const oldPath = join(tasks, "launch-mvp", "auth", "story-login", "task-rate-limit.md");
    const result = runUpdate({ cwd: dir, id: "task-rate-limit", parent: "story-login", now: LATER });
    expect(result.path).toBe(oldPath);
    expect(result.movedFrom).toBeUndefined();
    expect(result.changed).not.toContain("parent");
    expect(existsSync(oldPath)).toBe(true);
    expect(fm(oldPath).data.parent).toBe("story-login");
  });
});
