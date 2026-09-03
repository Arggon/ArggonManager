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
});
