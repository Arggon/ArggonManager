import { mkdtempSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runComment } from "./comment.js";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { runShow, DEFAULT_TAIL_COMMENTS } from "./show.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(repoRoot, "cli/src/cli.ts");
const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");

const NOW = new Date("2026-09-11T12:00:00Z");

function primedTask(commentCount = 5): { dir: string; id: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-show-"));
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
  for (let i = 1; i <= commentCount; i++) {
    runComment({
      cwd: dir,
      id: task.id,
      text: `comment number ${i}`,
      author: "alice",
      now: new Date(NOW.getTime() + i * 60_000),
      commit: false,
    });
  }
  return { dir, id: task.id, path: task.path };
}

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, ...args], { encoding: "utf8", cwd });
}

describe("show (ADR 0006 progressive disclosure)", () => {
  it("default compact output contains only the last 3 comments (bounded)", () => {
    const { dir, id } = primedTask(5);
    const proc = runCli(["show", id], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("comment number 5");
    expect(proc.stdout).toContain("comment number 4");
    expect(proc.stdout).toContain("comment number 3");
    expect(proc.stdout).not.toContain("comment number 2");
    expect(proc.stdout).not.toContain("comment number 1");
    expect(proc.stdout).toContain("2 earlier comment(s) omitted");
  });

  it("default tail size is 3 and never negative", () => {
    expect(DEFAULT_TAIL_COMMENTS).toBe(3);
  });

  it("--tail-comments N overrides the tail size", () => {
    const { dir, id } = primedTask(5);
    const proc = runCli(["show", id, "--tail-comments", "2"], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("comment number 5");
    expect(proc.stdout).toContain("comment number 4");
    expect(proc.stdout).not.toContain("comment number 3");
  });

  it("--meta emits frontmatter fields only, no body or comments", () => {
    const { dir, id } = primedTask(5);
    const proc = runCli(["show", id, "--meta"], dir);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("type: task");
    expect(proc.stdout).toContain("status: todo");
    expect(proc.stdout).not.toContain("comment number");
  });

  it("--body emits the full body with ALL comments", () => {
    const { dir, id, path } = primedTask(5);
    const proc = runCli(["show", id, "--body"], dir);
    expect(proc.status).toBe(0);
    for (let i = 1; i <= 5; i++) {
      expect(proc.stdout).toContain(`comment number ${i}`);
    }
    expect(proc.stdout).not.toContain("omitted");
    const body = readFileSync(path, "utf8").slice(readFileSync(path, "utf8").indexOf("\n---\n") + 5);
    expect(proc.stdout).toContain(body.trim());
  });

  it("unknown id fails cleanly with SHOW_FAILED under --json and non-zero exit", () => {
    const { dir } = primedTask(1);
    const proc = runCli(["show", "nope", "--json"], dir);
    expect(proc.status).not.toBe(0);
    const envelope = JSON.parse(proc.stdout) as Record<string, unknown>;
    expect(envelope.ok).toBe(false);
    expect(envelope.command).toBe("show");
    expect((envelope.error as Record<string, unknown>).code).toBe("SHOW_FAILED");
  });

  it("--json envelope follows the standard shape with a bounded comments array", () => {
    const { dir, id } = primedTask(5);
    const proc = runCli(["show", id, "--json"], dir);
    expect(proc.status).toBe(0);
    const envelope = JSON.parse(proc.stdout) as Record<string, unknown>;
    expect(envelope.ok).toBe(true);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.command).toBe("show");
    const item = envelope.item as Record<string, unknown>;
    expect(item.id).toBe(id);
    expect(envelope.body).toBeUndefined();
    const comments = envelope.comments as Array<Record<string, unknown>>;
    expect(comments).toHaveLength(3);
    expect(comments[0].author).toBe("alice");
    expect((comments[0].lines as string[]).join(" ")).toContain("comment number 3");
  });

  it("--json --body includes the verbatim body and ALL comments", () => {
    const { dir, id, path } = primedTask(5);
    const proc = runCli(["show", id, "--body", "--json"], dir);
    expect(proc.status).toBe(0);
    const envelope = JSON.parse(proc.stdout) as Record<string, unknown>;
    expect(envelope.body).toBe(readFileSync(path, "utf8").split(/\n---\n/).slice(1).join("\n---\n").replace(/^\n/, ""));
    expect(envelope.comments as unknown[]).toHaveLength(5);
  });

  it("is a pure read: the item file is byte-identical after show", () => {
    const { dir, id, path } = primedTask(5);
    const before = readFileSync(path, "utf8");
    expect(runCli(["show", id], dir).status).toBe(0);
    expect(runCli(["show", id, "--body"], dir).status).toBe(0);
    expect(runCli(["show", id, "--meta"], dir).status).toBe(0);
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("runShow surfaces a clean error for unknown ids", () => {
    const { dir } = primedTask(1);
    expect(() => runShow({ cwd: dir, id: "nope" })).toThrow(/not found under tasks\//);
  });
});
