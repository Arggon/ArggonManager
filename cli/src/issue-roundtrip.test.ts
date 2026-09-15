import { mkdirSync, mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCreate } from "./create.js";
import { parseFrontmatter, stringifyFrontmatter } from "./frontmatter.js";
import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

// task-issue-roundtrip: done flips close the linked GitHub issue — opt-in via
// tasks/.convention.yml `x-github.issue-roundtrip: true`, best effort (gh
// absent / failing / non-GitHub origin never block the flip). All gh calls are
// mocked; no test talks to GitHub.

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-09-03T12:00:00Z");
const LATER = new Date("2026-09-04T12:00:00Z");

/** A task claimed in_progress, carrying `issue: 12` (as import-issues writes it). */
function importedTask(dir: string): { id: string; path: string } {
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
  runUpdate({ cwd: dir, id: task.id, status: "in_progress", assignee: "arggon", now: NOW });
  return { id: task.id, path: task.path };
}

/** Make the temp tree a git repo with a GitHub origin (detectRepo resolves it). */
function withGithubOrigin(dir: string, slug = "octocat/hello-world"): void {
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["remote", "add", "origin", `https://github.com/${slug}.git`], { cwd: dir });
}

function enableRoundtrip(dir: string, enabled: boolean): void {
  const tasksDir = join(dir, "tasks");
  mkdirSync(tasksDir, { recursive: true });
  const path = join(tasksDir, ".convention.yml");
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    raw = "";
  }
  const section = enabled ? "x-github:\n  issue-roundtrip: true\n" : "";
  writeFileSync(path, `${raw}${raw.endsWith("\n") || raw === "" ? "" : "\n"}${section}`);
}

describe("issue round-trip on done flips", () => {
  it("closes the linked issue via gh when enabled and the item flips to done", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-roundtrip-"));
    withGithubOrigin(dir);
    enableRoundtrip(dir, true);
    const { id } = importedTask(dir);
    const execGh = vi.fn(() => "{}");
    const result = runUpdate({
      cwd: dir,
      id,
      status: "done",
      now: LATER,
      execGh: execGh as unknown as typeof execFileSync,
    });
    expect(execGh).toHaveBeenCalledTimes(1);
    const [file, args] = execGh.mock.calls[0] as unknown as [string, string[]];
    expect(file).toBe("gh");
    expect(args.slice(0, 4)).toEqual(["issue", "close", "12", "--repo"]);
    expect(args[4]).toBe("octocat/hello-world");
    expect(args.slice(5)).toEqual(["--comment", expect.stringContaining("`task-rate-limit`")]);
    expect(result.issueRoundtrip).toEqual({ closed: true, issue: 12, repo: "octocat/hello-world" });
    // The flip itself is untouched.
    expect(result.item.status).toBe("done");
  });

  it("does nothing when the gate is off (default)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-roundtrip-"));
    withGithubOrigin(dir);
    const { id } = importedTask(dir);
    const execGh = vi.fn(() => "{}");
    const result = runUpdate({
      cwd: dir,
      id,
      status: "done",
      now: LATER,
      execGh: execGh as unknown as typeof execFileSync,
    });
    expect(execGh).not.toHaveBeenCalled();
    expect(result.issueRoundtrip).toBeUndefined();
    expect(result.item.status).toBe("done");
  });

  it("skips cleanly when gh is missing: flip still succeeds, skip reported", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-roundtrip-"));
    withGithubOrigin(dir);
    enableRoundtrip(dir, true);
    const { id } = importedTask(dir);
    const err = Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" });
    const execGh = vi.fn(() => {
      throw err;
    });
    const warn = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const result = runUpdate({
        cwd: dir,
        id,
        status: "done",
        now: LATER,
        execGh: execGh as unknown as typeof execFileSync,
      });
      expect(result.item.status).toBe("done");
      expect(result.issueRoundtrip).toEqual({
        closed: false,
        issue: 12,
        skipped: expect.stringContaining("gh not found"),
      });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("issue round-trip skipped: gh not found"),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("does nothing for items without an issue field, even when enabled", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-roundtrip-"));
    withGithubOrigin(dir);
    enableRoundtrip(dir, true);
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
      title: "No linked issue",
      parent: "story-login",
      id: "no-issue",
      now: NOW,
    });
    runUpdate({ cwd: dir, id: task.id, status: "in_progress", assignee: "arggon", now: NOW });
    const execGh = vi.fn(() => "{}");
    const result = runUpdate({
      cwd: dir,
      id: task.id,
      status: "done",
      now: LATER,
      execGh: execGh as unknown as typeof execFileSync,
    });
    expect(execGh).not.toHaveBeenCalled();
    expect(result.issueRoundtrip).toBeUndefined();
  });

  it("skips with a reported reason on a non-GitHub origin (flip still succeeds)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-roundtrip-"));
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["remote", "add", "origin", "https://gitlab.com/owner/repo.git"], {
      cwd: dir,
    });
    enableRoundtrip(dir, true);
    const { id } = importedTask(dir);
    const execGh = vi.fn(() => "{}");
    const result = runUpdate({
      cwd: dir,
      id,
      status: "done",
      now: LATER,
      execGh: execGh as unknown as typeof execFileSync,
    });
    expect(execGh).not.toHaveBeenCalled();
    expect(result.item.status).toBe("done");
    expect(result.issueRoundtrip?.closed).toBe(false);
  });

  it("does not fire on a done -> done no-op (status unchanged)", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-roundtrip-"));
    withGithubOrigin(dir);
    enableRoundtrip(dir, true);
    const { id } = importedTask(dir);
    runUpdate({
      cwd: dir,
      id,
      status: "done",
      now: LATER,
      execGh: (() => "{}") as unknown as typeof execFileSync,
    });
    const execGh = vi.fn(() => "{}");
    const result = runUpdate({
      cwd: dir,
      id,
      title: "Add rate limiting (retitled)",
      now: LATER,
      execGh: execGh as unknown as typeof execFileSync,
    });
    expect(execGh).not.toHaveBeenCalled();
    expect(result.issueRoundtrip).toBeUndefined();
  });
});
