import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JSON_SCHEMA_VERSION } from "./json.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd = root) {
  return spawnSync(process.execPath, [tsx, cli, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...process.env },
  });
}

function parseStdout(stdout: string): Record<string, unknown> {
  const trimmed = stdout.trim();
  expect(trimmed.length).toBeGreaterThan(0);
  expect(() => JSON.parse(trimmed)).not.toThrow();
  return JSON.parse(trimmed) as Record<string, unknown>;
}

describe("CLI --json", () => {
  it("arggon --json hello emits a schemaVersion 1 envelope", () => {
    const result = runCli(["--json", "hello"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/\n$/);
    const body = parseStdout(result.stdout);
    expect(body).toEqual({
      ok: true,
      schemaVersion: JSON_SCHEMA_VERSION,
      conventionVersion: 0,
      command: "hello",
      message: "arggon: hello from Phase 1 scaffold",
    });
  });

  it("arggon hello --json also emits JSON (flag after command)", () => {
    const result = runCli(["hello", "--json"]);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(true);
    expect(body.command).toBe("hello");
    expect(body.schemaVersion).toBe(JSON_SCHEMA_VERSION);
  });

  it("arggon hello without --json stays human-readable", () => {
    const result = runCli(["hello"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("arggon: hello from Phase 1 scaffold");
    expect(() => JSON.parse(result.stdout.trim())).toThrow();
  });

  it("arggon --json init writes files and emits parseable JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-init-"));
    const result = runCli(["--json", "init", dir]);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(true);
    expect(body.command).toBe("init");
    expect(body.schemaVersion).toBe(JSON_SCHEMA_VERSION);
    expect(body.alreadyInitialized).toBe(false);
    expect(body.force).toBe(false);
    expect(Array.isArray(body.created)).toBe(true);
    expect((body.created as string[]).includes("tasks/.convention.yml")).toBe(true);
    expect(existsSync(join(dir, "tasks/.convention.yml"))).toBe(true);
    expect(existsSync(join(dir, "templates/task.md"))).toBe(true);
  });

  it("arggon --json init errors with INIT_FAILED when tasks/ is incomplete", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-init-err-"));
    mkdirSync(join(dir, "tasks"));
    writeFileSync(join(dir, "tasks/note.txt"), "x");
    const result = runCli(["--json", "init", dir]);
    expect(result.status).toBe(1);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(false);
    expect(body.command).toBe("init");
    expect(body.error).toMatchObject({ code: "INIT_FAILED" });
    expect(result.stdout.trim().startsWith("{")).toBe(true);
  });

  it("arggon create --json emits the contract {item} payload", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-create-"));
    expect(runCli(["init", dir]).status).toBe(0);
    const result = runCli(["create", "initiative", "Launch MVP", "--json"], dir);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body).toMatchObject({
      ok: true,
      schemaVersion: JSON_SCHEMA_VERSION,
      conventionVersion: 0,
      command: "create",
    });
    expect(body.item).toMatchObject({
      id: "launch-mvp",
      type: "initiative",
      status: "todo",
      title: "Launch MVP",
      parent: null,
      path: "tasks/launch-mvp/launch-mvp.md",
    });
    expect(existsSync(join(dir, "tasks/launch-mvp/launch-mvp.md"))).toBe(true);
  });

  it("arggon create --json errors with CREATE_FAILED on unknown parent", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-create-err-"));
    expect(runCli(["init", dir]).status).toBe(0);
    const result = runCli(["create", "epic", "Auth", "--parent", "nope", "--json"], dir);
    expect(result.status).toBe(1);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(false);
    expect(body.command).toBe("create");
    expect(body.error).toMatchObject({ code: "CREATE_FAILED" });
  });

  it("arggon create without --json stays human-readable", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-human-create-"));
    expect(runCli(["init", dir]).status).toBe(0);
    const result = runCli(["create", "initiative", "Launch MVP"], dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("arggon create: initiative launch-mvp");
  });

  it("arggon --json list emits the v1 envelope with full WorkItems", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-list-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
    const result = runCli(["--json", "list"], dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/\n$/);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    const body = parseStdout(result.stdout);
    expect(body).toMatchObject({
      ok: true,
      schemaVersion: JSON_SCHEMA_VERSION,
      conventionVersion: 0,
      command: "list",
    });
    expect(Array.isArray(body.items)).toBe(true);
    expect((body.items as Array<{ id: string }>).map((i) => i.id)).toEqual(["auth", "launch-mvp"]);
    expect((body.items as Array<Record<string, unknown>>)[0]).toEqual({
      id: "auth",
      type: "epic",
      status: "todo",
      title: "Auth",
      assignee: null,
      parent: "launch-mvp",
      labels: [],
      created: expect.any(String),
      updated: expect.any(String),
      path: "tasks/launch-mvp/auth/auth.md",
      blocked_reason: null,
    });
  });

  it("arggon list --json (flag after command) also works and filters compose", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-list-filter-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    const result = runCli(["list", "--type", "initiative", "--json"], dir);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(true);
    expect((body.items as Array<{ id: string }>).map((i) => i.id)).toEqual(["launch-mvp"]);
  });

  it("arggon list --json on an empty tree is ok:true with items:[]", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-list-empty-"));
    expect(runCli(["init", dir]).status).toBe(0);
    const result = runCli(["list", "--json"], dir);
    expect(result.status).toBe(0);
    expect(parseStdout(result.stdout)).toMatchObject({ ok: true, command: "list", items: [] });
  });

  it("arggon list --json errors with LIST_FAILED on bad filter", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-list-err-"));
    expect(runCli(["init", dir]).status).toBe(0);
    const result = runCli(["list", "--status", "wip", "--json"], dir);
    expect(result.status).toBe(1);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(false);
    expect(body.command).toBe("list");
    expect(body.error).toMatchObject({ code: "LIST_FAILED" });
  });

  it("arggon list without --json prints a table", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-human-list-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    const result = runCli(["list"], dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/id\s+type\s+status\s+assignee\s+title/);
    expect(result.stdout).toContain("launch-mvp");
  });

  it("arggon update --json emits the contract {item} payload", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-update-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    const result = runCli(["update", "launch-mvp", "--title", "Launch MVP v2", "--json"], dir);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body).toMatchObject({
      ok: true,
      schemaVersion: JSON_SCHEMA_VERSION,
      conventionVersion: 0,
      command: "update",
    });
    expect(body.item).toMatchObject({
      id: "launch-mvp",
      type: "initiative",
      title: "Launch MVP v2",
      path: "tasks/launch-mvp/launch-mvp.md",
    });
  });

  it("arggon update --json errors with UPDATE_FAILED on unknown id", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-update-err-"));
    expect(runCli(["init", dir]).status).toBe(0);
    const result = runCli(["update", "nope", "--status", "todo", "--json"], dir);
    expect(result.status).toBe(1);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(false);
    expect(body.command).toBe("update");
    expect(body.error).toMatchObject({ code: "UPDATE_FAILED" });
  });

  it("arggon update without --json stays human-readable", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-human-update-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    const result = runCli(["update", "launch-mvp", "--status", "in_progress"], dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("arggon update: initiative launch-mvp (status)");
  });
});
