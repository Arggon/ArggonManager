import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JSON_SCHEMA_VERSION } from "./json.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "cli/src/cli.ts");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");

function runCli(args: string[], cwd = root, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [tsx, cli, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...process.env, ...env },
  });
}

function runGit(args: string[], cwd: string) {
  return spawnSync("git", args, { encoding: "utf8", cwd });
}

function initGitTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-git-branch-"));
  primeGitWorkTree(dir);
  return dir;
}

function primeGitWorkTree(dir: string): void {
  expect(runGit(["init"], dir).status).toBe(0);
  // Local identity: the CI runner has no global user.name/user.email,
  // and `start` commits the claim with plain `git commit`.
  expect(runGit(["config", "user.email", "t@t"], dir).status).toBe(0);
  expect(runGit(["config", "user.name", "t"], dir).status).toBe(0);
  expect(runCli(["init", dir]).status).toBe(0);
  expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
  expect(runGit(["add", "-A"], dir).status).toBe(0);
  expect(
    runGit(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "init"], dir).status,
  ).toBe(0);
}

/** Git tree with a pushable origin and a mocked `gh` on PATH (both outside the work tree). */
function initStartTree(ghOk: boolean): { dir: string; env: Record<string, string> } {
  const outer = mkdtempSync(join(tmpdir(), "arggon-start-box-"));
  const dir = join(outer, "work");
  mkdirSync(dir, { recursive: true });
  primeGitWorkTree(dir);
  const remote = join(outer, "remote.git");
  expect(runGit(["init", "--bare", remote], outer).status).toBe(0);
  expect(runGit(["remote", "add", "origin", remote], dir).status).toBe(0);
  const bin = join(outer, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "gh"),
    ghOk
      ? '#!/bin/sh\necho "https://github.com/o/r/pull/1"\n'
      : '#!/bin/sh\necho "auth required" >&2\nexit 1\n',
    "utf8",
  );
  chmodSync(join(bin, "gh"), 0o755);
  return { dir, env: { PATH: `${bin}:${process.env.PATH ?? ""}` } };
}

/** Branched item plus a mocked `gh pr list` on PATH (no git needed for the overlay). */
function initBoardGhTree(ghOk: boolean): { dir: string; env: Record<string, string> } {
  const outer = mkdtempSync(join(tmpdir(), "arggon-board-gh-"));
  const dir = join(outer, "work");
  mkdirSync(dir, { recursive: true });
  expect(runCli(["init", dir]).status).toBe(0);
  expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
  expect(runCli(["update", "launch-mvp", "--branch", "feat/launch-mvp"], dir).status).toBe(0);
  const bin = join(outer, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "gh"),
    ghOk
      ? '#!/bin/sh\necho \'[{"number":42,"headRefName":"feat/launch-mvp","url":"https://github.com/o/r/pull/42","isDraft":false,"state":"OPEN","statusCheckRollup":[{"status":"COMPLETED","conclusion":"SUCCESS"}]}]\'\n'
      : '#!/bin/sh\necho "auth required" >&2\nexit 1\n',
    "utf8",
  );
  chmodSync(join(bin, "gh"), 0o755);
  return { dir, env: { PATH: `${bin}:${process.env.PATH ?? ""}` } };
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
      conventionVersion: 3,
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
      conventionVersion: 3,
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
      branch: null,
      parent: "launch-mvp",
      labels: [],
      created: expect.any(String),
      updated: expect.any(String),
      path: "tasks/launch-mvp/auth/auth.md",
      blocked_reason: null,
      milestone: null,
      depends_on: [],
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
    expect(result.stdout).toMatch(/id\s+type\s+status\s+assignee\s+branch\s+title/);
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
      conventionVersion: 3,
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

  it("arggon update --branch --json sets the working branch", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-update-branch-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    const result = runCli(["update", "launch-mvp", "--branch", "feat/launch-mvp", "--json"], dir);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body).toMatchObject({ ok: true, command: "update" });
    expect(body.item).toMatchObject({ id: "launch-mvp", branch: "feat/launch-mvp" });
  });

  it("arggon update without --json stays human-readable", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-human-update-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    const result = runCli(["update", "launch-mvp", "--status", "in_progress"], dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("arggon update: initiative launch-mvp (status)");
  });

  it("arggon board --json writes the HTML and emits the envelope", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-board-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
    const result = runCli(["board", "--json"], dir);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body).toMatchObject({
      ok: true,
      schemaVersion: JSON_SCHEMA_VERSION,
      conventionVersion: 3,
      command: "board",
      path: "board.html",
      itemCount: 2,
    });
    const html = readFileSync(join(dir, "board.html"), "utf8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("launch-mvp");
    expect(html).toContain('data-status="in_progress"');
  });

  it("arggon board from a subdirectory writes board.html at the repo root", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-subdir-board-"));
    expect(runCli(["init", dir]).status).toBe(0);
    const sub = join(dir, "docs");
    mkdirSync(sub);
    const result = runCli(["board", "--json"], sub);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body.path).toBe(join(dir, "board.html"));
    expect(existsSync(join(dir, "board.html"))).toBe(true);
    expect(existsSync(join(sub, "board.html"))).toBe(false);
  });

  it("arggon board honors --out and stays human-readable without --json", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-human-board-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    const result = runCli(["board", "--out", "my-board.html"], dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("arggon board: wrote my-board.html (1 item(s))");
    expect(existsSync(join(dir, "my-board.html"))).toBe(true);
  });

  it("arggon board --json errors with BOARD_FAILED without tasks/", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-json-board-err-"));
    const result = runCli(["board", "--json"], dir);
    expect(result.status).toBe(1);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(false);
    expect(body.command).toBe("board");
    expect(body.error).toMatchObject({ code: "BOARD_FAILED" });
  });

  it("arggon board --github overlays PR state with a mocked gh", () => {
    const { dir, env } = initBoardGhTree(true);
    const result = runCli(["board", "--github", "--json"], dir, env);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body).toMatchObject({ ok: true, command: "board", github: true, prCount: 1 });
    const html = readFileSync(join(dir, "board.html"), "utf8");
    expect(html).toContain("#42 · open · ✓");
    expect(html).toContain("live GitHub overlay (1 PR(s))");
  });

  it("arggon board --github fails with BOARD_FAILED without gh auth", () => {
    const { dir, env } = initBoardGhTree(false);
    const result = runCli(["board", "--github", "--json"], dir, env);
    expect(result.status).toBe(1);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(false);
    expect(body.command).toBe("board");
    expect(body.error).toMatchObject({ code: "BOARD_FAILED" });
    expect(String((body.error as { message: string }).message)).toMatch(/plain `arggon board`/);
  });

  it("arggon next suggests the lexicographic unclaimed todo with reason", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-next-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
    expect(runCli(["create", "story", "Login", "--parent", "auth"], dir).status).toBe(0);
    expect(runCli(["create", "task", "Work", "--parent", "login"], dir).status).toBe(0);
    const result = runCli(["next"], dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("arggon next: login — Login");
    expect(result.stdout).toContain("why:");
    expect(result.stdout).toContain("arggon start login --assignee <login>");
  });

  it("arggon next --json emits one suggestion object", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-next-json-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
    expect(runCli(["create", "story", "Login", "--parent", "auth"], dir).status).toBe(0);
    expect(runCli(["create", "task", "Work", "--parent", "login"], dir).status).toBe(0);
    const result = runCli(["next", "--json"], dir);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body).toMatchObject({ ok: true, command: "next" });
    const suggestion = body.suggestion as Record<string, unknown>;
    expect(suggestion).toMatchObject({
      parentChain: ["launch-mvp", "auth"],
      reason: expect.any(String),
    });
    expect(suggestion.item as Record<string, unknown>).toMatchObject({ id: "login" });
  });

  it("arggon next --json carries blockedBy and --ready skips blocked items", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-next-deps-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
    expect(runCli(["create", "story", "Login", "--parent", "auth"], dir).status).toBe(0);
    // Claim the story so only the tasks are candidates.
    expect(
      runCli(["update", "login", "--status", "in_progress", "--assignee", "bob"], dir).status,
    ).toBe(0);
    expect(runCli(["create", "task", "Aaa blocked", "--parent", "login"], dir).status).toBe(0);
    expect(runCli(["create", "task", "Bbb ready", "--parent", "login"], dir).status).toBe(0);
    expect(runCli(["create", "task", "Zzz blocker", "--parent", "login"], dir).status).toBe(0);
    expect(
      runCli(["update", "task-aaa-blocked", "--add-depends-on", "task-zzz-blocker"], dir).status,
    ).toBe(0);
    expect(
      runCli(["update", "task-zzz-blocker", "--status", "in_progress", "--assignee", "bob"], dir)
        .status,
    ).toBe(0);

    // Default: ready item ranks first despite the blocked item sorting earlier.
    const ready = runCli(["next", "--json"], dir);
    expect(ready.status).toBe(0);
    const readyBody = parseStdout(ready.stdout) as { suggestion: Record<string, unknown> };
    expect(readyBody.suggestion.item).toMatchObject({ id: "task-bbb-ready" });
    expect(readyBody.suggestion.blockedBy).toEqual([]);

    // --ready: pool limited to unblocked items.
    const readyOnly = runCli(["next", "--ready", "--json"], dir);
    expect(readyOnly.status).toBe(0);
    expect((parseStdout(readyOnly.stdout) as { suggestion: Record<string, unknown> }).suggestion.item).toMatchObject({ id: "task-bbb-ready" });

    // Claim the ready item: the blocked one is suggested with its open dep in
    // reason and blockedBy; --ready empties the pool (suggestion stays null).
    expect(
      runCli(["update", "task-bbb-ready", "--status", "in_progress", "--assignee", "carol"], dir)
        .status,
    ).toBe(0);
    const blocked = runCli(["next", "--json"], dir);
    expect(blocked.status).toBe(0);
    const blockedBody = parseStdout(blocked.stdout) as { suggestion: Record<string, unknown> };
    expect(blockedBody.suggestion.item).toMatchObject({ id: "task-aaa-blocked" });
    expect(blockedBody.suggestion.blockedBy).toEqual(["task-zzz-blocker"]);
    expect(String(blockedBody.suggestion.reason)).toContain("task-zzz-blocker");
    const none = runCli(["next", "--ready", "--json"], dir);
    expect(none.status).toBe(0);
    expect(parseStdout(none.stdout)).toMatchObject({ ok: true, suggestion: null });
  });

  it("arggon list --json applies dependency filters", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-list-deps-cli-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
    expect(runCli(["create", "story", "Login", "--parent", "auth"], dir).status).toBe(0);
    expect(runCli(["create", "task", "Aaa", "--parent", "login"], dir).status).toBe(0);
    expect(runCli(["create", "task", "Bbb", "--parent", "login"], dir).status).toBe(0);
    expect(runCli(["update", "task-aaa", "--add-depends-on", "task-bbb"], dir).status).toBe(0);
    const dependsOn = runCli(["list", "--json", "--filter", "depends-on:task-bbb"], dir);
    expect(dependsOn.status).toBe(0);
    const dependsOnBody = parseStdout(dependsOn.stdout);
    expect((dependsOnBody.items as Array<Record<string, unknown>>).map((i) => i.id)).toEqual([
      "task-aaa",
    ]);
    const blockedBy = runCli(["list", "--json", "--filter", "blocked-by:task-bbb"], dir);
    expect(blockedBy.status).toBe(0);
    const blockedByBody = parseStdout(blockedBy.stdout);
    expect((blockedByBody.items as Array<Record<string, unknown>>).map((i) => i.id)).toEqual([
      "task-aaa",
    ]);
  });

  it("arggon next exits 0 with a friendly message on an empty pool", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-next-empty-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
    expect(runCli(["create", "story", "Login", "--parent", "auth"], dir).status).toBe(0);
    expect(runCli(["create", "task", "Work", "--parent", "login"], dir).status).toBe(0);
    // Claim everything claimable: the pool drains, containers don't count.
    expect(
      runCli(["update", "login", "--status", "in_progress", "--assignee", "bob"], dir).status,
    ).toBe(0);
    expect(
      runCli(["update", "task-work", "--status", "in_progress", "--assignee", "bob"], dir).status,
    ).toBe(0);
    const human = runCli(["next"], dir);
    expect(human.status).toBe(0);
    expect(human.stdout).toContain("todo pool is empty");
    const boxed = runCli(["next", "--json"], dir);
    expect(boxed.status).toBe(0);
    expect(parseStdout(boxed.stdout)).toMatchObject({ ok: true, suggestion: null });
  });

  it("arggon report aggregates leaf statuses grouped by epic", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-report-"));
    expect(runCli(["init", dir]).status).toBe(0);
    expect(runCli(["create", "initiative", "Launch MVP"], dir).status).toBe(0);
    expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
    expect(runCli(["create", "story", "Login", "--parent", "auth"], dir).status).toBe(0);
    expect(runCli(["create", "task", "Work", "--parent", "login"], dir).status).toBe(0);
    expect(
      runCli(["update", "task-work", "--status", "in_progress", "--assignee", "bob"], dir).status,
    ).toBe(0);
    expect(runCli(["update", "task-work", "--status", "done"], dir).status).toBe(0);
    const human = runCli(["report"], dir);
    expect(human.status).toBe(0);
    expect(human.stdout).toContain("epic: auth — Auth [launch-mvp]");
    expect(human.stdout).toContain(
      "login: todo=0 in_progress=0 blocked=0 done=1 cancelled=0 (total 1)",
    );
    const boxed = runCli(["report", "--json"], dir);
    expect(boxed.status).toBe(0);
    const body = parseStdout(boxed.stdout);
    expect(body).toMatchObject({ ok: true, command: "report" });
    const groups = body.groups as Array<Record<string, unknown>>;
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ epic: { id: "auth" }, empty: false });
    const containers = groups[0]!.containers as Array<Record<string, unknown>>;
    expect(containers).toHaveLength(1);
    expect(containers[0]).toMatchObject({
      id: "login",
      empty: false,
      counts: { todo: 0, in_progress: 0, blocked: 0, done: 1, cancelled: 0, total: 1 },
    });
  });

  it("arggon report --json errors with REPORT_FAILED without tasks/", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-report-err-"));
    const result = runCli(["report", "--json"], dir);
    expect(result.status).toBe(1);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(false);
    expect(body.command).toBe("report");
    expect(body.error).toMatchObject({ code: "REPORT_FAILED" });
  });

  it("arggon branch creates, checks out, and records the branch", () => {
    const dir = initGitTree();
    const result = runCli(["branch", "launch-mvp"], dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "arggon branch: initiative launch-mvp → feat/launch-mvp (created)",
    );
    expect(runGit(["branch", "--show-current"], dir).stdout.trim()).toBe("feat/launch-mvp");
  });

  it("arggon branch --json attaches to the recorded branch", () => {
    const dir = initGitTree();
    expect(runCli(["branch", "launch-mvp"], dir).status).toBe(0);
    const result = runCli(["branch", "launch-mvp", "--json"], dir);
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body).toMatchObject({
      ok: true,
      schemaVersion: JSON_SCHEMA_VERSION,
      conventionVersion: 3,
      command: "branch",
      branch: "feat/launch-mvp",
      created: false,
    });
    expect(body.item).toMatchObject({ id: "launch-mvp", branch: "feat/launch-mvp" });
  });

  it("arggon branch --json fails with BRANCH_FAILED on mismatch", () => {
    const dir = initGitTree();
    expect(runGit(["branch", "feat/launch-mvp"], dir).status).toBe(0);
    const result = runCli(["branch", "launch-mvp", "--json"], dir);
    expect(result.status).toBe(1);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(false);
    expect(body.command).toBe("branch");
    expect(body.error).toMatchObject({ code: "BRANCH_FAILED" });
  });

  it("arggon start claims, branches, pushes, and opens a draft PR", () => {
    const { dir, env } = initStartTree(true);
    const result = runCli(
      ["start", "launch-mvp", "--assignee", "arggon", "--open-pr", "--json"],
      dir,
      env,
    );
    expect(result.status).toBe(0);
    const body = parseStdout(result.stdout);
    expect(body).toMatchObject({
      ok: true,
      schemaVersion: JSON_SCHEMA_VERSION,
      conventionVersion: 3,
      command: "start",
      branch: "feat/launch-mvp",
      created: true,
      pushed: true,
      prUrl: "https://github.com/o/r/pull/1",
    });
    expect(body.item).toMatchObject({
      id: "launch-mvp",
      status: "in_progress",
      assignee: "arggon",
      branch: "feat/launch-mvp",
    });
    expect(runGit(["branch", "--show-current"], dir).stdout.trim()).toBe("feat/launch-mvp");
  });

  it("arggon start fails with START_FAILED without gh auth", () => {
    const { dir, env } = initStartTree(false);
    const result = runCli(
      ["start", "launch-mvp", "--assignee", "arggon", "--open-pr", "--json"],
      dir,
      env,
    );
    expect(result.status).toBe(1);
    const body = parseStdout(result.stdout);
    expect(body.ok).toBe(false);
    expect(body.command).toBe("start");
    expect(body.error).toMatchObject({ code: "START_FAILED" });
    expect(String((body.error as { message: string }).message)).toMatch(/gh auth status/);
  });

  it("arggon start never forces a taken claim", () => {
    const { dir, env } = initStartTree(true);
    expect(runCli(["create", "epic", "Auth", "--parent", "launch-mvp"], dir).status).toBe(0);
    expect(runCli(["create", "story", "Login", "--parent", "auth"], dir).status).toBe(0);
    expect(runCli(["create", "task", "Work", "--parent", "login"], dir).status).toBe(0);
    expect(
      runCli(["update", "task-work", "--status", "in_progress", "--assignee", "alice"], dir).status,
    ).toBe(0);
    expect(runGit(["add", "-A"], dir).status).toBe(0);
    expect(
      runGit(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "claim"], dir).status,
    ).toBe(0);
    const result = runCli(["start", "task-work", "--assignee", "bob", "--json"], dir, env);
    expect(result.status).toBe(1);
    const body = parseStdout(result.stdout);
    expect(body.error).toMatchObject({ code: "START_FAILED" });
    expect(String((body.error as { message: string }).message)).toMatch(/claim conflict/);
  });
});
