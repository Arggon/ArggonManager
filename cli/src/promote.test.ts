import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseFrontmatter,
  runCreate,
  runUpdate,
  runValidate,
  stringifyFrontmatter,
} from "@arggon/lib";

import { runInit } from "./init.js";

// task-promote-task-to-story: `arggon update <task-id> --type story` promotes
// a task to a story in place — file moves to the story layout under the
// grandparent epic, id renames task-x -> story-x (container ids must not start
// with task-/bug-), depends_on references are rewritten, issue/labels/body
// ride along. Refusals are all pre-mutation.

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-09-15T12:00:00Z");
const LATER = new Date("2026-09-16T12:00:00Z");

/**
 * Fixture (the import-issues shape): a leaf task under a story under an epic.
 *
 *   launch-mvp (initiative)
 *   └── auth (epic)
 *       └── story-login (story)
 *           └── task-rate-limit (task)
 */
function primedTree(): { dir: string; tasks: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-promote-"));
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
  runCreate({
    cwd: dir,
    type: "task",
    title: "Add rate limiting",
    parent: "story-login",
    id: "rate-limit",
    now: NOW,
  });
  return { dir, tasks: join(dir, "ArggonManager") };
}

function fm(path: string) {
  return parseFrontmatter(readFileSync(path, "utf8"));
}

describe("update --type story (task promotion)", () => {
  it("moves the file to the story layout under the grandparent epic, type=story, id renamed", () => {
    const { dir, tasks } = primedTree();
    const oldPath = join(tasks, "launch-mvp", "auth", "story-login", "task-rate-limit.md");
    const newDir = join(tasks, "launch-mvp", "auth", "story-rate-limit");
    const newPath = join(newDir, "story-rate-limit.md");
    expect(existsSync(oldPath)).toBe(true);

    const result = runUpdate({ cwd: dir, id: "task-rate-limit", type: "story", now: LATER });

    expect(result.path).toBe(newPath);
    expect(result.id).toBe("story-rate-limit");
    expect(result.movedFrom).toBe(oldPath);
    expect(result.renamedFrom).toBe("task-rate-limit");
    expect(result.changed).toEqual(expect.arrayContaining(["type", "parent", "id"]));
    expect(existsSync(oldPath)).toBe(false);
    expect(existsSync(newPath)).toBe(true);
    const { data } = fm(newPath);
    expect(data.type).toBe("story");
    expect(data.parent).toBe("auth");
    expect(data.id).toBe("story-rate-limit");
    expect(data.title).toBe("Add rate limiting");
    // The promoted story starts empty of children: the directory holds only
    // the index file.
    expect(readFileSync(newPath, "utf8")).toContain("# Add rate limiting");
    // Both sides stage into the auto-commit so history follows the move.
    expect(result.changedPaths).toContain(oldPath);
    expect(result.changedPaths).toContain(newPath);
  });

  it("keeps issue and labels riding along (round-trip link preserved)", () => {
    const { dir, tasks } = primedTree();
    const taskPath = join(tasks, "launch-mvp", "auth", "story-login", "task-rate-limit.md");
    const raw = readFileSync(taskPath, "utf8");
    const { data, body } = parseFrontmatter(raw);
    writeFileSync(
      taskPath,
      stringifyFrontmatter(
        { ...data, issue: 12, labels: [...(data.labels as string[]), "imported"] },
        body,
      ),
      "utf8",
    );

    const result = runUpdate({ cwd: dir, id: "task-rate-limit", type: "story", now: LATER });
    const { data: promoted } = fm(result.path);
    expect(promoted.issue).toBe(12);
    expect(promoted.labels).toContain("imported");
  });

  it("rewrites depends_on references to the old id tree-wide", () => {
    const { dir, tasks } = primedTree();
    runCreate({
      cwd: dir,
      type: "task",
      title: "Depends on rate limit",
      parent: "story-login",
      id: "downstream",
      now: NOW,
    });
    runUpdate({
      cwd: dir,
      id: "task-downstream",
      addDependsOn: "task-rate-limit",
      now: NOW,
    });

    const result = runUpdate({ cwd: dir, id: "task-rate-limit", type: "story", now: LATER });

    const downstreamPath = join(tasks, "launch-mvp", "auth", "story-login", "task-downstream.md");
    expect(fm(downstreamPath).data.depends_on).toEqual(["story-rate-limit"]);
    expect(result.changedPaths).toContain(downstreamPath);
  });

  it("leaves the tree valid: validate ok after promotion", () => {
    const { dir } = primedTree();
    runUpdate({ cwd: dir, id: "task-rate-limit", type: "story", now: LATER });
    expect(runValidate({ cwd: dir }).errors).toEqual([]);
  });

  it("refuses promoting a bug (v1 is tasks only)", () => {
    const { dir, tasks } = primedTree();
    runCreate({
      cwd: dir,
      type: "bug",
      title: "Broken thing",
      parent: "story-login",
      id: "broken",
      now: NOW,
    });
    const bugPath = join(tasks, "launch-mvp", "auth", "story-login", "bug-broken.md");
    expect(() => runUpdate({ cwd: dir, id: "bug-broken", type: "story", now: LATER })).toThrow(
      /promotes tasks only/,
    );
    expect(existsSync(bugPath)).toBe(true);
    expect(fm(bugPath).data.type).toBe("bug");
  });

  it("refuses converting an already-story item", () => {
    const { dir } = primedTree();
    expect(() => runUpdate({ cwd: dir, id: "story-login", type: "story", now: LATER })).toThrow(
      /already a story/,
    );
  });

  it("refuses demotion (--type task)", () => {
    const { dir } = primedTree();
    expect(() => runUpdate({ cwd: dir, id: "story-login", type: "task", now: LATER })).toThrow(
      /only supports 'story' in v1/,
    );
  });

  it("refuses when the target epic is missing (story directly under an initiative)", () => {
    const { dir, tasks } = primedTree();
    // Hand-build the odd shape: a story parented under the initiative.
    const storyPath = join(tasks, "launch-mvp", "auth", "story-login", "story-login.md");
    const raw = readFileSync(storyPath, "utf8");
    const { data, body } = parseFrontmatter(raw);
    writeFileSync(storyPath, stringifyFrontmatter({ ...data, parent: "launch-mvp" }, body), "utf8");
    expect(() => runUpdate({ cwd: dir, id: "task-rate-limit", type: "story", now: LATER })).toThrow(
      /create the epic first/,
    );
  });

  it("refuses --type combined with --parent", () => {
    const { dir } = primedTree();
    expect(() =>
      runUpdate({ cwd: dir, id: "task-rate-limit", type: "story", parent: "auth", now: LATER }),
    ).toThrow(/either --type or --parent/);
  });

  it("refuses when the target story id is already taken", () => {
    const { dir } = primedTree();
    runCreate({
      cwd: dir,
      type: "story",
      title: "Rate limit feature",
      parent: "auth",
      id: "story-rate-limit",
      now: NOW,
    });
    expect(() => runUpdate({ cwd: dir, id: "task-rate-limit", type: "story", now: LATER })).toThrow(
      /already taken/,
    );
  });

  it("a promoted item still round-trips on its done flip (issue link rides along)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-promote-rt-"));
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["remote", "add", "origin", "https://github.com/octocat/hello-world.git"], {
      cwd: dir,
    });
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
    const raw = readFileSync(task.path, "utf8");
    const { data, body } = parseFrontmatter(raw);
    writeFileSync(task.path, stringifyFrontmatter({ ...data, issue: 12 }, body), "utf8");
    runUpdate({
      cwd: dir,
      id: "task-rate-limit",
      status: "in_progress",
      assignee: "arggon",
      now: NOW,
    });
    mkdirSync(join(dir, "ArggonManager"), { recursive: true });
    writeFileSync(
      join(dir, "ArggonManager", ".convention.yml"),
      "x-github:\n  issue-roundtrip: true\n",
      "utf8",
    );

    // Promote, then flip the PROMOTED item done: the mocked gh must be called
    // with the same issue number — the round-trip link survived promotion.
    const promoted = runUpdate({ cwd: dir, id: "task-rate-limit", type: "story", now: LATER });
    const execGh = vi.fn(() => "{}");
    const done = runUpdate({
      cwd: dir,
      id: promoted.id,
      status: "done",
      now: LATER,
      execGh: execGh as unknown as typeof execFileSync,
    });
    expect(execGh).toHaveBeenCalledTimes(1);
    const [, args] = execGh.mock.calls[0] as unknown as [string, string[]];
    expect(args.join(" ")).toContain("12");
    expect(done.issueRoundtrip?.closed).toBe(true);
  });
});
