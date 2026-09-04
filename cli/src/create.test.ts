import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runCreate } from "./create.js";
import { parseFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";

const NOW = new Date("2026-09-03T12:00:00Z");

function primed(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-create-"));
  runInit({ dir, force: false });
  return dir;
}

function fm(path: string) {
  return parseFrontmatter(readFileSync(path, "utf8")).data;
}

describe("create", () => {
  it("creates initiative/epic/story/task/bug in the correct folders", () => {
    const dir = primed();
    const initiative = runCreate({
      cwd: dir,
      type: "initiative",
      title: "Launch MVP",
      now: NOW,
    });
    expect(initiative.id).toBe("launch-mvp");
    expect(initiative.path).toBe(join(dir, "tasks/launch-mvp/launch-mvp.md"));
    expect(fm(initiative.path)).toMatchObject({
      type: "initiative",
      status: "todo",
      id: "launch-mvp",
      title: "Launch MVP",
      created: "2026-09-03",
      updated: "2026-09-03",
      labels: [],
    });
    expect(fm(initiative.path).parent).toBeUndefined();

    const epic = runCreate({
      cwd: dir,
      type: "epic",
      title: "Auth",
      parent: "launch-mvp",
      now: NOW,
    });
    expect(epic.path).toBe(join(dir, "tasks/launch-mvp/auth/auth.md"));
    expect(fm(epic.path)).toMatchObject({
      type: "epic",
      id: "auth",
      parent: "launch-mvp",
    });

    const story = runCreate({
      cwd: dir,
      type: "story",
      title: "Login",
      parent: "auth",
      id: "story-login",
      now: NOW,
    });
    expect(story.id).toBe("story-login");
    expect(story.path).toBe(join(dir, "tasks/launch-mvp/auth/story-login/story-login.md"));

    const task = runCreate({
      cwd: dir,
      type: "task",
      title: "Add rate limiting",
      parent: "story-login",
      id: "rate-limit",
      now: NOW,
    });
    expect(task.id).toBe("task-rate-limit");
    expect(task.path).toBe(join(dir, "tasks/launch-mvp/auth/story-login/task-rate-limit.md"));
    expect(fm(task.path)).toMatchObject({
      type: "task",
      id: "task-rate-limit",
      parent: "story-login",
      title: "Add rate limiting",
    });

    const bug = runCreate({
      cwd: dir,
      type: "bug",
      title: "Login 500 on empty password",
      parent: "story-login",
      now: NOW,
    });
    expect(bug.id).toBe("bug-login-500-on-empty-password");
    expect(bug.path.endsWith("bug-login-500-on-empty-password.md")).toBe(true);
    expect(fm(bug.path).parent).toBe("story-login");
  });

  it("errors clearly if parent is missing", () => {
    const dir = primed();
    expect(() =>
      runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp" }),
    ).toThrow(/parent 'launch-mvp' not found/);
    expect(() => runCreate({ cwd: dir, type: "epic", title: "Auth" })).toThrow(/requires --parent/);
  });

  it("rejects the wrong parent type", () => {
    const dir = primed();
    runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
    expect(() =>
      runCreate({
        cwd: dir,
        type: "task",
        title: "Nope",
        parent: "launch-mvp",
      }),
    ).toThrow(/must live under a story/);
  });

  it("supports --assignee and --status", () => {
    const dir = primed();
    runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
    const epic = runCreate({
      cwd: dir,
      type: "epic",
      title: "Auth",
      parent: "launch-mvp",
      status: "in_progress",
      now: NOW,
    });
    expect(fm(epic.path).status).toBe("in_progress");
    expect(fm(epic.path).assignee).toBeUndefined();

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
      title: "Claimed work",
      parent: "story-login",
      status: "in_progress",
      assignee: "arggon",
      now: NOW,
    });
    expect(fm(task.path)).toMatchObject({
      status: "in_progress",
      assignee: "arggon",
    });
  });

  it("requires assignee when claiming a leaf", () => {
    const dir = primed();
    runCreate({ cwd: dir, type: "initiative", title: "I", now: NOW });
    runCreate({ cwd: dir, type: "epic", title: "E", parent: "i", now: NOW });
    runCreate({ cwd: dir, type: "story", title: "S", parent: "e", now: NOW });
    expect(() =>
      runCreate({
        cwd: dir,
        type: "task",
        title: "T",
        parent: "s",
        status: "in_progress",
      }),
    ).toThrow(/requires --assignee/);
  });

  it("rejects creating as done", () => {
    const dir = primed();
    expect(() => runCreate({ cwd: dir, type: "initiative", title: "X", status: "done" })).toThrow(
      /status done/,
    );
  });

  it("rejects duplicate ids against an existing tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-create-sample-"));
    runInit({ dir, force: false });
    cpSync(join(process.cwd(), "tasks/launch-mvp"), join(dir, "tasks/launch-mvp"), {
      recursive: true,
    });
    expect(() => runCreate({ cwd: dir, type: "initiative", title: "Launch MVP" })).toThrow(
      /already exists/,
    );
    expect(() =>
      runCreate({
        cwd: dir,
        type: "task",
        title: "Add rate limiting",
        parent: "story-login",
        id: "rate-limit",
      }),
    ).toThrow(/already exists/);
  });

  it("returns the created WorkItem and prints nothing (CLI prints)", () => {
    const dir = primed();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const result = runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
      expect(log).not.toHaveBeenCalled();
      expect(result.root).toBe(dir);
      expect(result.item).toMatchObject({
        id: "launch-mvp",
        type: "initiative",
        status: "todo",
        title: "Launch MVP",
      });
      expect(result.item.filePath).toBe(result.path);
    } finally {
      log.mockRestore();
    }
  });
});
