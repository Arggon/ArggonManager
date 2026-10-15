import { PassThrough } from "node:stream";
import {
  chmodSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HANDOFF_SESSION_CAP, conventionPathForRoot, runCreate, runUpdate } from "@arggondev/lib";
import { arggonVersion } from "./docs.js";

import { runInit } from "./init.js";
import { satisfyAcceptance } from "../../test/acceptance.js";
import { deriveDefaultCliSpawn, runMcpServer } from "./mcp-server.js";
import { cliNodeArgs, tsxLoaderPath } from "./test-spawn.js";

/**
 * CLI re-entry for the spawn tools (ADR 0014): tests inject the same tsx +
 * cli.ts spec the parity harness uses to drive the real CLI.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const cliEntry = join(repoRoot, "cli/src/cli.ts");

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

/**
 * In-process MCP client #1: drives runMcpServer over connected streams,
 * newline-delimited JSON per the MCP stdio transport.
 */
class McpTestClient {
  private nextId = 1;
  private pending = new Map<number, (value: Record<string, unknown>) => void>();
  private waiters: Array<(value: Record<string, unknown>) => void> = [];
  private unseen: Record<string, unknown>[] = [];
  readonly output: PassThrough;
  private serverInput: PassThrough;

  constructor() {
    this.serverInput = new PassThrough();
    this.output = new PassThrough();
    let buffer = "";
    this.output.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let index: number;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        const message = JSON.parse(line) as Record<string, unknown> & { id?: number };
        if (typeof message.id === "number" && this.pending.has(message.id)) {
          const resolve = this.pending.get(message.id)!;
          this.pending.delete(message.id);
          // JSON-RPC error responses carry `error` instead of `result`.
          resolve(
            "error" in message ? message : ((message.result as Record<string, unknown>) ?? {}),
          );
          continue;
        }
        if (this.waiters.length > 0) {
          this.waiters.shift()!(message);
        } else {
          this.unseen.push(message);
        }
      }
    });
  }

  cwd = "";

  start(serverOptions?: { cliSpawn?: { command: string; args: string[] } }): void {
    runMcpServer({
      cwd: this.cwd,
      input: this.serverInput,
      output: this.output,
      ...serverOptions,
    });
  }

  request(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.serverInput.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  /** Next message that does not match a pending request id (e.g. id: null errors). */
  waitNext(): Promise<Record<string, unknown>> {
    if (this.unseen.length > 0) return Promise.resolve(this.unseen.shift()!);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  raw(line: string): void {
    this.serverInput.write(`${line}\n`);
  }
}

function primedRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-mcp-"));
  runInit({ dir, force: false });
  // Real seed prose (task-validate-refuses-placeholder-bodies): the scaffold
  // IS the placeholder, so default bodies would fail `validate` here.
  const container = "## Context\n\nSeed.\n\n## Acceptance\n\nSeed.\n";
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", body: container });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp", body: container });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "auth",
    id: "story-login",
    body: container,
  });
  return dir;
}

function textContent(result: Record<string, unknown>): unknown {
  const content = result.content as Array<{ type: string; text: string }>;
  expect(content[0]?.type).toBe("text");
  return JSON.parse(content[0]!.text);
}

/**
 * Run `fn` under a spoofed launch shape (task-derive-cli-spawn-loader):
 * `argv`/`execArgv` hold the entries AFTER the execPath head, restored even
 * on failure. The spawn tools derive their CLI re-entry spec from these
 * globals, so tests pin recognition by setting them, never by re-executing.
 */
function withLaunch(argv: string[], execArgv: string[], fn: () => void): void {
  const savedArgv = process.argv;
  const savedExecArgv = process.execArgv;
  try {
    process.argv = [process.execPath, ...argv];
    process.execArgv = execArgv;
    fn();
  } finally {
    process.argv = savedArgv;
    process.execArgv = savedExecArgv;
  }
}

/**
 * Built dynamically so this suite never spells the wrapper path in code —
 * the test-spawn gate keeps wrapper literals out of test trees (strings
 * included).
 */
const WRAPPER_SUFFIX = ["cli", "mjs"].join(".");

/** True when `value` carries a UTF-16 surrogate code unit that is not half of a valid pair. */
function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1; // skip the low half of a valid pair
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true; // low surrogate without a preceding high half
    }
  }
  return false;
}

describe("mcp server", () => {
  let client: McpTestClient;
  let repoDir: string;

  beforeEach(() => {
    repoDir = primedRepo();
    client = new McpTestClient();
    client.cwd = repoDir;
    client.start();
  });

  it("completes the initialize handshake and echoes a supported protocol version", async () => {
    const result = await client.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "client-a", version: "1.0" },
    });
    expect(result).toMatchObject({
      protocolVersion: "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "arggon", version: arggonVersion() },
    });
  });

  it("handshakes with a second client on another protocol version", async () => {
    const clientB = new McpTestClient();
    clientB.cwd = repoDir;
    clientB.start();
    const result = await clientB.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "client-b", version: "0.9" },
    });
    expect(result.protocolVersion).toBe("2024-11-05");

    const fallback = await client.request("initialize", {
      protocolVersion: "1999-01-01",
      capabilities: {},
      clientInfo: { name: "client-c", version: "0.1" },
    });
    expect(fallback.protocolVersion).toBe("2025-06-18");
  });

  it("lists the fifteen tools with JSON-schema inputs", async () => {
    const result = await client.request("tools/list");
    const tools = result.tools as Array<{ name: string; inputSchema: Record<string, unknown> }>;
    expect(tools.map((tool) => tool.name)).toEqual([
      "arggon_list",
      "arggon_create",
      "arggon_update",
      "arggon_comment",
      "arggon_handoff",
      "arggon_show",
      "arggon_next",
      "arggon_report",
      "arggon_validate",
      "arggon_priority",
      "arggon_sync",
      "arggon_import_issues",
      "arggon_start",
      "arggon_branch",
      "arggon_cleanup",
      "arggon_friction",
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("hides steal from the arggon_update schema (agents cannot even ask)", async () => {
    const result = await client.request("tools/list");
    const tools = result.tools as Array<{ name: string; inputSchema: Record<string, unknown> }>;
    const update = tools.find((tool) => tool.name === "arggon_update");
    const properties = update!.inputSchema.properties as Record<string, unknown>;
    expect(properties).not.toHaveProperty("steal");
    expect(properties).not.toHaveProperty("force");
  });

  it("exposes no human-only force/steal surface on the spawn tools", async () => {
    const result = await client.request("tools/list");
    const tools = result.tools as Array<{ name: string; inputSchema: Record<string, unknown> }>;
    const properties = (name: string): Record<string, unknown> =>
      tools.find((tool) => tool.name === name)!.inputSchema.properties as Record<string, unknown>;
    for (const name of ["arggon_start", "arggon_branch"]) {
      expect(properties(name), name).not.toHaveProperty("force");
      expect(properties(name), name).not.toHaveProperty("steal");
    }
    // `arggon_cleanup` is the one surface that carries a `force`, by decision
    // (bug-cleanup-prune-untracked-artifacts-no-force): it is the audited prune
    // opt-in — terminal+merged items whose removal blockers are ALL untracked
    // (never tracked changes, never a live claim) — and NOT the human-only
    // claim power (`update --force`, refused for agent callers by the shared
    // rules module) nor `steal`. The kernel keeps that gate; this pin records
    // which surface the word may appear on.
    expect(properties("arggon_cleanup")).not.toHaveProperty("steal");
    expect(properties("arggon_cleanup")).toHaveProperty("force");
  });

  it("arggon_priority plans a dry run through the shared kernel operation", async () => {
    const result = await client.request("tools/call", {
      name: "arggon_priority",
      arguments: { dry_run: true },
    });
    expect(result.isError).toBeUndefined();
    const envelope = textContent(result) as Record<string, unknown> & {
      scanned?: number;
      changed?: number;
    };
    expect(envelope).toMatchObject({ ok: true, command: "priority", dryRun: true });
    expect(envelope.scanned).toBeGreaterThan(0);
    // The primed tree carries no legacy pN labels: nothing to change.
    expect(envelope.changed).toBe(0);
  });

  it("arggon_branch re-enters the CLI and returns the branch envelope", async () => {
    // runBranch checks out with git: seed a repo before spawning the CLI.
    const git = (args: string[]) =>
      execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
        cwd: repoDir,
        stdio: ["ignore", "pipe", "pipe"],
      });
    git(["init"]);
    git(["commit", "--allow-empty", "-m", "seed"]);
    await client.request("tools/call", {
      name: "arggon_create",
      arguments: {
        type: "task",
        title: "Add rate limiting",
        parent: "story-login",
        id: "rate-limit",
      },
    });
    const spawned = new McpTestClient();
    spawned.cwd = repoDir;
    // A fresh client keeps the dispatch surface clean; the spawn spec drives
    // the real CLI through tsx, exactly like the parity harness.
    spawned.start({ cliSpawn: { command: process.execPath, args: cliNodeArgs(cliEntry) } });
    const result = await spawned.request("tools/call", {
      name: "arggon_branch",
      arguments: { id: "task-rate-limit" },
    });
    expect(result.isError).toBeUndefined();
    const envelope = textContent(result) as Record<string, unknown>;
    expect(envelope).toMatchObject({ ok: true, command: "branch", created: true });
    expect(typeof envelope.branch).toBe("string");
    expect((envelope.item as Record<string, unknown>).id).toBe("task-rate-limit");
  });

  it("arggon_branch derives its spawn spec from a loader-form launch: no cliSpawn injection needed (task-derive-cli-spawn-loader)", async () => {
    // The shape every spawned server process carries since the wrapper
    // re-exec fix: `node --import <tsx loader> cli.ts` — argv[1] is the
    // entry, the loader registration sits in execArgv. A server launched
    // this way must re-enter the CLI through the derived spec, not fall
    // back to the remediation error (the silent-fallback risk from #518).
    const git = (args: string[]) =>
      execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
        cwd: repoDir,
        stdio: ["ignore", "pipe", "pipe"],
      });
    git(["init"]);
    git(["commit", "--allow-empty", "-m", "seed"]);
    await client.request("tools/call", {
      name: "arggon_create",
      arguments: {
        type: "task",
        title: "Add rate limiting",
        parent: "story-login",
        id: "rate-limit",
      },
    });
    const spawned = new McpTestClient();
    spawned.cwd = repoDir;
    const savedArgv = process.argv;
    const savedExecArgv = process.execArgv;
    try {
      // Derivation happens when the spawn tool fires (spawnedOutcome), so
      // the spoofed launch shape must stay active across the awaited call.
      process.argv = [process.execPath, cliEntry, "mcp"];
      process.execArgv = ["--import", tsxLoaderPath()];
      spawned.start();
      const result = await spawned.request("tools/call", {
        name: "arggon_branch",
        arguments: { id: "task-rate-limit" },
      });
      expect(result.isError).toBeUndefined();
      const envelope = textContent(result) as Record<string, unknown>;
      expect(envelope).toMatchObject({ ok: true, command: "branch", created: true });
    } finally {
      process.argv = savedArgv;
      process.execArgv = savedExecArgv;
    }
  });

  it("arggon_branch surfaces a kernel failure as a tool error without killing the session", async () => {
    const spawned = new McpTestClient();
    spawned.cwd = repoDir;
    spawned.start({ cliSpawn: { command: process.execPath, args: cliNodeArgs(cliEntry) } });
    const result = await spawned.request("tools/call", {
      name: "arggon_branch",
      arguments: { id: "task-missing" },
    });
    expect(result.isError).toBe(true);
    const envelope = textContent(result) as Record<string, unknown>;
    expect(envelope).toMatchObject({ ok: false, command: "branch" });
    // The session continues: a follow-up call still answers.
    const still = await spawned.request("tools/list");
    expect(Array.isArray(still.tools)).toBe(true);
  });

  it("a spawn child without a JSON envelope becomes a tool error with a clipped tail", async () => {
    const spawned = new McpTestClient();
    spawned.cwd = repoDir;
    // `echo` exits 0 but prints no envelope: the spawn path must throw a
    // tool-level error (dispatch turns it into isError text), not hang or die.
    spawned.start({ cliSpawn: { command: "echo", args: [] } });
    const result = await spawned.request("tools/call", {
      name: "arggon_branch",
      arguments: { id: "task-rate-limit" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("did not emit a JSON envelope");
  });

  it("create -> list -> update round trip returns the documented envelopes", async () => {
    const created = await client.request("tools/call", {
      name: "arggon_create",
      arguments: {
        type: "task",
        title: "Add rate limiting",
        parent: "story-login",
        id: "rate-limit",
      },
    });
    expect(created.isError).toBeUndefined();
    const createEnvelope = textContent(created) as Record<string, unknown>;
    expect(createEnvelope).toMatchObject({
      ok: true,
      schemaVersion: 1,
      command: "create",
    });
    expect((createEnvelope.item as Record<string, unknown>).id).toBe("task-rate-limit");
    // Top-level path mirrors item.path (bug-create-path-envelope).
    expect(createEnvelope.path).toBe((createEnvelope.item as Record<string, unknown>).path);

    const listed = await client.request("tools/call", {
      name: "arggon_list",
      arguments: { status: "todo", type: "task" },
    });
    const listEnvelope = textContent(listed) as Record<string, unknown>;
    expect(listEnvelope).toMatchObject({ ok: true, command: "list" });
    const items = listEnvelope.items as Array<Record<string, unknown>>;
    expect(items.map((item) => item.id)).toContain("task-rate-limit");
    // Compact ADR 0006 default: blocked_reason is null here, so it is omitted.
    expect(items[0]).not.toHaveProperty("blocked_reason");

    const claimed = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "task-rate-limit", status: "in_progress", assignee: "agent-x" },
    });
    const updateEnvelope = textContent(claimed) as Record<string, unknown>;
    expect(updateEnvelope).toMatchObject({ ok: true, command: "update" });
    expect((updateEnvelope.item as Record<string, unknown>).status).toBe("in_progress");
    // bug-cascadeskipped-array-alignment: cascade fields are always arrays,
    // empty ([] not absent) when the cascade did not run.
    expect(updateEnvelope.autoCompleted).toEqual([]);
    expect(updateEnvelope.cascadeSkipped).toEqual([]);
  });

  it("surfaces kernel errors as tool errors with the CLI message text", async () => {
    const result = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "nope", status: "todo" },
    });
    expect(result.isError).toBe(true);
    const envelope = textContent(result) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      ok: false,
      schemaVersion: 1,
      command: "update",
      error: { message: "id 'nope' not found under the tracker", code: "UPDATE_FAILED" },
    });
  });

  it("enforces agent playbook rules: no reopen, no steal", async () => {
    const seed = await client.request("tools/call", {
      name: "arggon_create",
      arguments: {
        type: "task",
        title: "Add rate limiting",
        parent: "story-login",
        id: "rate-limit",
      },
    });
    expect(seed.isError).toBeUndefined();

    const claim = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "task-rate-limit", status: "in_progress", assignee: "agent-x" },
    });
    expect(claim.isError).toBeUndefined();

    // Done gate (task-done-gate-acceptance-waiver, ADR 0015): tick the
    // contract so the flip under test succeeds through the tool.
    satisfyAcceptance(repoDir, "task-rate-limit");

    const complete = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "task-rate-limit", status: "done" },
    });
    expect(complete.isError).toBeUndefined();

    const reopen = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "task-rate-limit", status: "todo" },
    });
    expect(reopen.isError).toBe(true);
    expect(textContent(reopen)).toMatchObject({
      error: { message: expect.stringMatching(/agents must not reopen done items/) },
    });
  });

  it("answers ping, rejects unknown methods, and reports parse errors", async () => {
    expect(await client.request("ping")).toEqual({});

    const unknown = await client.request("resources/list");
    expect(unknown).toMatchObject({ error: { code: -32601 } });

    const parseErrorPromise = client.waitNext();
    client.raw("{not json");
    const parseError = await parseErrorPromise;
    expect(parseError).toMatchObject({
      id: null,
      error: { code: -32700, message: expect.any(String) },
    });
  });
});

describe("mcp server arggon_update parent (task-list-parent-flag)", () => {
  let client: McpTestClient;
  let repoDir: string;

  beforeEach(() => {
    repoDir = primedRepo();
    client = new McpTestClient();
    client.cwd = repoDir;
    client.start();
  });

  it("exposes parent in the arggon_update input schema", async () => {
    await client.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "client-a", version: "1.0" },
    });
    const tools = await client.request("tools/list");
    const toolsList = tools.tools as Array<{
      name: string;
      inputSchema: { properties: Record<string, unknown> };
    }>;
    const update = toolsList.find((tool) => tool.name === "arggon_update");
    expect(update).toBeDefined();
    expect(update!.inputSchema.properties).toHaveProperty("parent");
  });

  it("reparents an item via arggon_update parent", async () => {
    await client.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "client-a", version: "1.0" },
    });
    // Valid edge: story-login (story) reparents under billing (epic).
    runCreate({
      cwd: repoDir,
      type: "epic",
      title: "Billing",
      parent: "launch-mvp",
      id: "billing",
    });
    const result = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "story-login", parent: "billing" },
    });
    expect(result.isError).toBeUndefined();
    const envelope = textContent(result) as Record<string, unknown>;
    expect(envelope).toMatchObject({ ok: true, command: "update" });
    expect((envelope.item as Record<string, unknown>).parent).toBe("billing");
  });

  it("rejects an unknown parent id with the CLI edge validation error", async () => {
    await client.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "client-a", version: "1.0" },
    });
    const result = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "story-login", parent: "nope" },
    });
    expect(result.isError).toBe(true);
    expect(textContent(result)).toMatchObject({
      ok: false,
      command: "update",
      error: { code: "UPDATE_FAILED" },
    });
  });
});

describe("mcp server next/report/validate (task-mcp-parity-full)", () => {
  let client: McpTestClient;
  let repoDir: string;

  beforeEach(() => {
    repoDir = primedRepo();
    client = new McpTestClient();
    client.cwd = repoDir;
    client.start();
  });

  it("arggon_next suggests the created task with reason, blockedBy and unblocks", async () => {
    const created = await client.request("tools/call", {
      name: "arggon_create",
      arguments: {
        type: "task",
        title: "Add rate limiting",
        parent: "story-login",
        id: "rate-limit",
      },
    });
    expect(created.isError).toBeUndefined();

    const next = await client.request("tools/call", { name: "arggon_next", arguments: {} });
    expect(next.isError).toBeUndefined();
    const envelope = textContent(next) as Record<string, unknown>;
    expect(envelope).toMatchObject({ ok: true, schemaVersion: 1, command: "next" });
    const suggestion = envelope.suggestion as Record<string, unknown>;
    // task-next-pool-stories: the default pool excludes stories, so the
    // created leaf task is suggested, not the seeded unclaimed story.
    expect((suggestion.item as Record<string, unknown>).id).toBe("task-rate-limit");
    expect(suggestion.parentChain).toEqual(["launch-mvp", "auth", "story-login"]);
    expect(suggestion.blockedBy).toEqual([]);
    expect(suggestion.unblocks).toBe(0);
    expect(typeof suggestion.reason).toBe("string");

    // Once the story is claimed, the created task is the suggestion; once
    // every todo is claimed the ready-only pool is empty -> suggestion null,
    // like `next --ready` on the CLI.
    await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "story-login", status: "in_progress", assignee: "agent-x" },
    });
    const nextTask = await client.request("tools/call", { name: "arggon_next", arguments: {} });
    const nextEnvelope = textContent(nextTask) as Record<string, unknown>;
    expect((nextEnvelope.suggestion as Record<string, unknown>).item).toMatchObject({
      id: "task-rate-limit",
    });
    await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "task-rate-limit", status: "in_progress", assignee: "agent-x" },
    });
    const empty = await client.request("tools/call", {
      name: "arggon_next",
      arguments: { ready: true },
    });
    expect(empty.isError).toBeUndefined();
    expect((textContent(empty) as Record<string, unknown>).suggestion).toBeNull();
  });

  it("arggon_report returns the per-epic groups envelope", async () => {
    const report = await client.request("tools/call", { name: "arggon_report", arguments: {} });
    expect(report.isError).toBeUndefined();
    const envelope = textContent(report) as Record<string, unknown>;
    expect(envelope).toMatchObject({ ok: true, schemaVersion: 1, command: "report" });
    const groups = envelope.groups as Array<Record<string, unknown>>;
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ epic: { id: "auth" } });
    expect(envelope.trend).toBeUndefined();
  });

  it("arggon_report rejects since without trend with the CLI message", async () => {
    const report = await client.request("tools/call", {
      name: "arggon_report",
      arguments: { since: "2026-01-01" },
    });
    expect(report.isError).toBe(true);
    expect(textContent(report)).toMatchObject({
      ok: false,
      command: "report",
      error: { message: "--since requires --trend", code: "REPORT_FAILED" },
    });
  });

  it("arggon_validate returns the ok envelope on a clean tree and fails like the CLI on a broken one", async () => {
    const clean = await client.request("tools/call", { name: "arggon_validate", arguments: {} });
    expect(clean.isError).toBeUndefined();
    const cleanEnvelope = textContent(clean) as Record<string, unknown>;
    expect(cleanEnvelope).toMatchObject({ ok: true, schemaVersion: 1, command: "validate" });
    expect(cleanEnvelope.errors).toEqual([]);

    // status: blocked without blocked_reason is a validate error.
    const created = await client.request("tools/call", {
      name: "arggon_create",
      arguments: { type: "task", title: "Broken", parent: "story-login", id: "rate-limit" },
    });
    expect(created.isError).toBeUndefined();
    const { readFileSync, writeFileSync } = await import("node:fs");
    const file = join(
      repoDir,
      "ArggonManager",
      "launch-mvp",
      "auth",
      "story-login",
      "task-rate-limit.md",
    );
    writeFileSync(file, readFileSync(file, "utf8").replace("status: todo", "status: blocked"));

    const broken = await client.request("tools/call", { name: "arggon_validate", arguments: {} });
    expect(broken.isError).toBe(true);
    expect(textContent(broken)).toMatchObject({
      ok: false,
      command: "validate",
      error: { code: "VALIDATE_FAILED" },
    });
  });
});

describe("mcp server _meta.sessionID attribution (task-opencode-v2-mcp-meta)", () => {
  let client: McpTestClient;
  let repoDir: string;
  let previousUser: string | undefined;

  const taskPath = (): string =>
    join(repoDir, "ArggonManager", "launch-mvp", "auth", "story-login", "task-rate-limit.md");

  async function seedTask(): Promise<void> {
    const created = await client.request("tools/call", {
      name: "arggon_create",
      arguments: {
        type: "task",
        title: "Add rate limiting",
        parent: "story-login",
        id: "rate-limit",
      },
    });
    expect(created.isError).toBeUndefined();
  }

  beforeEach(() => {
    repoDir = primedRepo();
    client = new McpTestClient();
    client.cwd = repoDir;
    client.start();
    // Deterministic @me fallback for the meta-absent cases.
    previousUser = process.env.GITHUB_USER;
    process.env.GITHUB_USER = "fallback-user";
  });

  afterEach(() => {
    if (previousUser === undefined) delete process.env.GITHUB_USER;
    else process.env.GITHUB_USER = previousUser;
  });

  it("defaults the handoff session and author from params._meta.sessionID", async () => {
    await seedTask();
    const result = await client.request("tools/call", {
      name: "arggon_handoff",
      arguments: { id: "task-rate-limit", next: "resume the meta wiring", branch: "feat/x" },
      _meta: { sessionID: "ses_meta_handoff" },
    });
    expect(result.isError).toBeUndefined();
    expect(textContent(result)).toMatchObject({
      ok: true,
      command: "handoff",
      comment: { author: "ses_meta_handoff" },
      handoff: { branch: "feat/x", next: "resume the meta wiring", session: "ses_meta_handoff" },
    });
    expect(readFileSync(taskPath(), "utf8")).toMatch(
      /### handoff \d{4}-\d{2}-\d{2} @ses_meta_handoff \(session: ses_meta_handoff\) — next: resume the meta wiring\n- branch: feat\/x\n/,
    );
  });

  it("defaults the comment author from params._meta.sessionID", async () => {
    await seedTask();
    const result = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-rate-limit", text: "from meta" },
      _meta: { sessionID: "ses_meta_comment" },
    });
    expect(result.isError).toBeUndefined();
    expect(textContent(result)).toMatchObject({
      ok: true,
      command: "comment",
      comment: { author: "ses_meta_comment", lines: ["from meta"] },
    });
    expect(readFileSync(taskPath(), "utf8")).toContain("@ses_meta_comment\nfrom meta\n");
  });

  it("explicit session/author arguments always win over params._meta.sessionID", async () => {
    await seedTask();
    const handoff = await client.request("tools/call", {
      name: "arggon_handoff",
      arguments: {
        id: "task-rate-limit",
        next: "resume",
        branch: "feat/x",
        session: "sess_explicit",
        author: "explicit-user",
      },
      _meta: { sessionID: "ses_meta_ignored" },
    });
    expect(textContent(handoff)).toMatchObject({
      comment: { author: "explicit-user" },
      handoff: { session: "sess_explicit" },
    });

    const comment = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-rate-limit", text: "explicit", author: "explicit-user" },
      _meta: { sessionID: "ses_meta_ignored" },
    });
    expect(textContent(comment)).toMatchObject({ comment: { author: "explicit-user" } });
  });

  it("treats empty/whitespace-only explicit author/session as absent and falls back to params._meta.sessionID", async () => {
    await seedTask();
    for (const explicit of ["", "   ", "\t"]) {
      const comment = await client.request("tools/call", {
        name: "arggon_comment",
        arguments: { id: "task-rate-limit", text: "empty author", author: explicit },
        _meta: { sessionID: "ses_meta_empty_explicit" },
      });
      expect(comment.isError).toBeUndefined();
      expect(textContent(comment)).toMatchObject({
        ok: true,
        command: "comment",
        comment: { author: "ses_meta_empty_explicit", lines: ["empty author"] },
      });
    }

    const handoff = await client.request("tools/call", {
      name: "arggon_handoff",
      arguments: {
        id: "task-rate-limit",
        next: "resume",
        branch: "feat/x",
        session: "  ",
        author: "\t",
      },
      _meta: { sessionID: "ses_meta_empty_explicit" },
    });
    expect(handoff.isError).toBeUndefined();
    expect(textContent(handoff)).toMatchObject({
      ok: true,
      command: "handoff",
      comment: { author: "ses_meta_empty_explicit" },
      handoff: { branch: "feat/x", next: "resume", session: "ses_meta_empty_explicit" },
    });
  });

  it("behaves exactly as before when params._meta is absent", async () => {
    await seedTask();
    const handoff = await client.request("tools/call", {
      name: "arggon_handoff",
      arguments: { id: "task-rate-limit", next: "resume", branch: "feat/x" },
    });
    const handoffEnvelope = textContent(handoff) as Record<string, unknown>;
    expect(handoffEnvelope).toMatchObject({
      ok: true,
      command: "handoff",
      comment: { author: "fallback-user" },
      handoff: { branch: "feat/x" },
    });
    expect(handoffEnvelope.handoff as Record<string, unknown>).not.toHaveProperty("session");

    const comment = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-rate-limit", text: "no meta" },
    });
    expect(textContent(comment)).toMatchObject({
      ok: true,
      command: "comment",
      comment: { author: "fallback-user", lines: ["no meta"] },
    });
  });

  it("ignores malformed or non-string _meta.sessionID values (absent-safe narrowing)", async () => {
    await seedTask();
    const metas: Array<Record<string, unknown>> = [
      {},
      { _meta: null },
      { _meta: "ses_not_an_object" },
      { _meta: { sessionID: 42 } },
      { _meta: { sessionID: "" } },
      { _meta: { sessionID: ["ses_array"] } },
    ];
    for (const extra of metas) {
      const result = await client.request("tools/call", {
        name: "arggon_comment",
        arguments: { id: "task-rate-limit", text: "malformed meta" },
        ...extra,
      });
      expect(textContent(result)).toMatchObject({ comment: { author: "fallback-user" } });
    }
  });

  it("treats whitespace-only _meta.sessionID as absent and falls back to @me", async () => {
    await seedTask();
    for (const sessionID of [" ", "\t", "\n\t ", "\u00a0"]) {
      const comment = await client.request("tools/call", {
        name: "arggon_comment",
        arguments: { id: "task-rate-limit", text: "whitespace meta" },
        _meta: { sessionID },
      });
      expect(textContent(comment)).toMatchObject({ comment: { author: "fallback-user" } });
    }

    const handoff = await client.request("tools/call", {
      name: "arggon_handoff",
      arguments: { id: "task-rate-limit", next: "resume", branch: "feat/x" },
      _meta: { sessionID: "   " },
    });
    const envelope = textContent(handoff) as Record<string, unknown>;
    expect(envelope).toMatchObject({ comment: { author: "fallback-user" } });
    expect(envelope.handoff as Record<string, unknown>).not.toHaveProperty("session");
  });

  it("normalizes control characters to a single-line token (no heading injection)", async () => {
    await seedTask();
    const cases: Array<[string, string]> = [
      ["ses_safe\n### injected heading", "ses_safe"],
      ["ses_tab\tmore", "ses_tab"],
      ["ses_cr\rmore", "ses_cr"],
      ["ses_nul\u0000evil", "ses_nul"],
      // U+200B is a format character (Cf), not whitespace: still a delimiter.
      ["ses_zero\u200bwidth", "ses_zero"],
    ];
    for (const [sessionID, expected] of cases) {
      const comment = await client.request("tools/call", {
        name: "arggon_comment",
        arguments: { id: "task-rate-limit", text: "control meta" },
        _meta: { sessionID },
      });
      expect(textContent(comment)).toMatchObject({ comment: { author: expected } });
    }
    const body = readFileSync(taskPath(), "utf8");
    expect(body).not.toContain("### injected heading");
    expect(body).toContain("@ses_safe\n");
    expect(body).toContain("@ses_nul\n");

    // Control-only and leading-control values normalize to nothing -> @me.
    for (const sessionID of ["\u0000\u0001", "\u0000ses_hidden", "\u200b"]) {
      const comment = await client.request("tools/call", {
        name: "arggon_comment",
        arguments: { id: "task-rate-limit", text: "control-only meta" },
        _meta: { sessionID },
      });
      expect(textContent(comment)).toMatchObject({ comment: { author: "fallback-user" } });
    }
  });

  it("caps a long _meta.sessionID at the handoff session cap (64 chars + …)", async () => {
    await seedTask();
    const long = "s".repeat(300);
    const bounded = `${"s".repeat(HANDOFF_SESSION_CAP - 1)}…`;
    expect(bounded.length).toBe(HANDOFF_SESSION_CAP);

    const comment = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-rate-limit", text: "long meta" },
      _meta: { sessionID: long },
    });
    expect(textContent(comment)).toMatchObject({ comment: { author: bounded } });

    const handoff = await client.request("tools/call", {
      name: "arggon_handoff",
      arguments: { id: "task-rate-limit", next: "resume", branch: "feat/x" },
      _meta: { sessionID: long },
    });
    expect(textContent(handoff)).toMatchObject({
      comment: { author: bounded },
      handoff: { session: bounded },
    });

    const body = readFileSync(taskPath(), "utf8");
    expect(body).not.toContain(long);
    expect(body).toContain(`@${bounded} (session: ${bounded}) — next: resume`);
    expect(body.split("\n").filter((line) => line.startsWith("### "))).toHaveLength(2);
  });

  it("caps an astral _meta.sessionID without splitting a surrogate pair", async () => {
    await seedTask();
    // 40 astral characters = 80 UTF-16 code units: over the 64-unit cap, so a
    // raw code-unit cut would land inside the 32nd pair.
    const astral = "😀".repeat(40);
    // The pair at the cut is dropped whole: 31 astral characters + the marker
    // are 63 code units (32 code points), within the cap.
    const bounded = `${"😀".repeat(31)}…`;
    expect(hasLoneSurrogate(astral)).toBe(false);
    expect(hasLoneSurrogate(bounded)).toBe(false);
    expect(bounded.length).toBeLessThanOrEqual(HANDOFF_SESSION_CAP);
    expect(Array.from(bounded)).toHaveLength(32);

    const comment = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-rate-limit", text: "astral meta" },
      _meta: { sessionID: astral },
    });
    expect(textContent(comment)).toMatchObject({ comment: { author: bounded } });

    const handoff = await client.request("tools/call", {
      name: "arggon_handoff",
      arguments: { id: "task-rate-limit", next: "resume", branch: "feat/x" },
      _meta: { sessionID: astral },
    });
    expect(textContent(handoff)).toMatchObject({
      comment: { author: bounded },
      handoff: { session: bounded },
    });

    // End to end: a split pair would have been written to disk as U+FFFD.
    const body = readFileSync(taskPath(), "utf8");
    expect(hasLoneSurrogate(body)).toBe(false);
    expect(body).not.toContain("\ufffd");
    expect(body).toContain(`@${bounded} (session: ${bounded}) — next: resume`);
  });

  it("cuts _meta.sessionID at a lone surrogate instead of forwarding malformed UTF-16", async () => {
    await seedTask();
    const cases: Array<[string, string]> = [
      ["ses_high\ud83dmore", "ses_high"], // lone high surrogate mid-value
      ["ses_low\udc00more", "ses_low"], // lone low surrogate mid-value
    ];
    for (const [sessionID, expected] of cases) {
      const comment = await client.request("tools/call", {
        name: "arggon_comment",
        arguments: { id: "task-rate-limit", text: "lone surrogate meta" },
        _meta: { sessionID },
      });
      expect(textContent(comment)).toMatchObject({ comment: { author: expected } });
    }

    // Lone-surrogate-only values normalize to nothing -> the @me fallback.
    for (const sessionID of ["\ud83d", "\udc00", "\ud83d\ud83d"]) {
      const comment = await client.request("tools/call", {
        name: "arggon_comment",
        arguments: { id: "task-rate-limit", text: "lone surrogate only" },
        _meta: { sessionID },
      });
      expect(textContent(comment)).toMatchObject({ comment: { author: "fallback-user" } });
    }

    const handoff = await client.request("tools/call", {
      name: "arggon_handoff",
      arguments: { id: "task-rate-limit", next: "resume", branch: "feat/x" },
      _meta: { sessionID: "\ud83d\ud83d" },
    });
    const envelope = textContent(handoff) as Record<string, unknown>;
    expect(envelope).toMatchObject({ comment: { author: "fallback-user" } });
    expect(envelope.handoff as Record<string, unknown>).not.toHaveProperty("session");

    const body = readFileSync(taskPath(), "utf8");
    expect(hasLoneSurrogate(body)).toBe(false);
    expect(body).not.toContain("\ufffd");
  });

  it("keeps the envelope payloads byte-compatible otherwise (only the attributed value differs)", async () => {
    await seedTask();
    const withMeta = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-rate-limit", text: "same text" },
      _meta: { sessionID: "ses_meta_shape" },
    });
    const withoutMeta = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-rate-limit", text: "same text" },
    });
    const a = textContent(withMeta) as Record<string, unknown>;
    const b = textContent(withoutMeta) as Record<string, unknown>;
    const aComment = a.comment as Record<string, unknown>;
    const bComment = b.comment as Record<string, unknown>;
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(Object.keys(aComment).sort()).toEqual(Object.keys(bComment).sort());
    expect(aComment.date).toBe(bComment.date);
    expect(aComment.lines).toEqual(bComment.lines);
    // The only difference is the attributed author value.
    expect(aComment.author).toBe("ses_meta_shape");
    expect(bComment.author).toBe("fallback-user");
    const withoutComment = (envelope: Record<string, unknown>): Record<string, unknown> => {
      const copy = { ...envelope };
      delete copy.comment;
      return copy;
    };
    expect(withoutComment(a)).toEqual(withoutComment(b));
  });

  it("triggers no state transition: meta never claims or reopens anything", async () => {
    await seedTask();
    const before = readFileSync(taskPath(), "utf8");
    const result = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-rate-limit", text: "meta only" },
      _meta: { sessionID: "ses_meta_no_state" },
    });
    expect(result.isError).toBeUndefined();
    const after = readFileSync(taskPath(), "utf8");
    const frontmatter = (text: string): string => text.slice(0, text.indexOf("\n---", 3) + 4);
    expect(frontmatter(after)).toBe(frontmatter(before));
    const shown = await client.request("tools/call", {
      name: "arggon_show",
      arguments: { id: "task-rate-limit", meta: true },
    });
    const shownEnvelope = textContent(shown) as Record<string, unknown>;
    expect((shownEnvelope.item as Record<string, unknown>).status).toBe("todo");
  });
});

describe("mcp server additive update contract (task-native-kernel-lib-polish finding 1)", () => {
  let client: McpTestClient;
  let repoDir: string;
  let shimDir: string;
  let pathBefore: string | undefined;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), "arggon-mcp-additive-"));
    runInit({ dir: repoDir, force: false });
    runCreate({ cwd: repoDir, type: "initiative", title: "Launch MVP" });
    runCreate({ cwd: repoDir, type: "epic", title: "Auth", parent: "launch-mvp" });
    runCreate({ cwd: repoDir, type: "story", title: "Login", parent: "auth", id: "story-login" });
    // `issue: 12` is what import-issues writes; the done flip must round-trip it.
    runCreate({
      cwd: repoDir,
      type: "task",
      title: "Add rate limiting",
      parent: "story-login",
      id: "rate-limit",
      issue: 12,
    });
    execFileSync("git", ["init", "-q"], { cwd: repoDir });
    execFileSync("git", ["remote", "add", "origin", "https://github.com/octocat/hello-world.git"], {
      cwd: repoDir,
    });
    // Opt the tree into the issue round-trip (default OFF, x-github section).
    const convention = conventionPathForRoot(repoDir);
    writeFileSync(
      convention,
      `${readFileSync(convention, "utf8")}x-github:\n  issue-roundtrip: true\n`,
    );
    // Deterministic `gh` on PATH: the close succeeds without any GitHub traffic.
    shimDir = mkdtempSync(join(tmpdir(), "arggon-gh-shim-"));
    const gh = join(shimDir, "gh");
    writeFileSync(gh, "#!/bin/sh\nexit 0\n");
    chmodSync(gh, 0o755);
    pathBefore = process.env.PATH;
    process.env.PATH = `${shimDir}${pathBefore ? `:${pathBefore}` : ""}`;

    client = new McpTestClient();
    client.cwd = repoDir;
    client.start();
  });

  afterEach(() => {
    if (pathBefore !== undefined) process.env.PATH = pathBefore;
  });

  it("update carries the detected conventionVersion and the additive issueRoundtrip", async () => {
    const claim = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "task-rate-limit", status: "in_progress", assignee: "agent-x" },
    });
    expect(claim.isError).toBeUndefined();

    // Done gate (task-done-gate-acceptance-waiver, ADR 0015): tick the
    // contract so the flip under test succeeds through the tool.
    satisfyAcceptance(repoDir, "task-rate-limit");

    const done = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "task-rate-limit", status: "done" },
    });
    expect(done.isError).toBeUndefined();
    const envelope = textContent(done) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      ok: true,
      schemaVersion: 1,
      command: "update",
      conventionVersion: 5,
      issueRoundtrip: { closed: true, issue: 12, repo: "octocat/hello-world" },
    });
    expect((envelope.item as Record<string, unknown>).status).toBe("done");
  });
});

/**
 * The PR #713 incident shape, end to end (bug-mcp-server-binds-session-cwd-
 * tracker-root): a git repo whose item is claimed in a worktree, with the
 * MCP server launched from the PRIMARY checkout — the stale base branch the
 * incident session was bound to. Every item-scoped write must land in the
 * worktree (where the claim branch lives) or fail named; never in the
 * launching tree.
 */
describe("mcp server item-scoped cwd routing (bug-mcp-server-binds-session-cwd-tracker-root)", () => {
  const itemRelPath = "ArggonManager/inc/area/story-topic/task-thing.md";
  let client: McpTestClient;
  let primary: string;
  let worktree: string;

  const git = (cwd: string, args: string[]): void => {
    execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  };

  /** The claim as `start --worktree` writes it, in the worktree copy. */
  const recordClaim = (): void => {
    runUpdate({
      cwd: worktree,
      id: "task-thing",
      status: "in_progress",
      assignee: "arggon-maker",
      branch: "feat/task-thing",
    });
    const file = join(worktree, itemRelPath);
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace(
        /^branch: .*$/m,
        `branch: feat/task-thing\nworktree_path: ${worktree}`,
      ),
      "utf8",
    );
    writeFileSync(
      join(worktree, ".arggon.env"),
      `ARGON_ITEM=task-thing\nARGGON_WORKTREE_PATH=${worktree}\nARGGON_WORKTREE_BRANCH=feat/task-thing\n`,
      "utf8",
    );
    git(worktree, ["add", "-A"]);
    git(worktree, ["commit", "-q", "--allow-empty", "-m", "claim: task-thing"]);
  };

  /**
   * Primary git checkout + tracker + task, and the claim worktree. With
   * `recordedWorktree` the claim points elsewhere (the stale-record refusal
   * case). The primary is left on its base branch with the STALE todo copy —
   * the incident's launch tree.
   */
  function seed(opts: { recordedWorktree?: string } = {}): { primary: string; worktree: string } {
    primary = mkdtempSync(join(tmpdir(), "arggon-mcp-route-"));
    git(primary, ["init", "-q"]);
    git(primary, ["config", "user.name", "test"]);
    git(primary, ["config", "user.email", "test@example.com"]);
    git(primary, ["commit", "-q", "--allow-empty", "-m", "seed"]);
    runInit({ dir: primary, force: false });
    const body = "## Context\n\nSeed.\n\n## Acceptance\n\nSeed.\n";
    runCreate({ cwd: primary, type: "initiative", title: "Inc", body });
    runCreate({ cwd: primary, type: "epic", title: "Area", parent: "inc", body });
    runCreate({
      cwd: primary,
      type: "story",
      title: "Topic",
      parent: "area",
      id: "story-topic",
      body,
    });
    runCreate({
      cwd: primary,
      type: "task",
      title: "Do the thing",
      parent: "story-topic",
      id: "task-thing",
      body,
    });
    git(primary, ["add", "-A"]);
    git(primary, ["commit", "-q", "--allow-empty", "-m", "seed tracker"]);

    worktree = `${primary}-task-thing`;
    git(primary, ["worktree", "add", "-q", worktree, "-b", "feat/task-thing"]);
    if (opts.recordedWorktree !== undefined) {
      // Claim recorded in the LAUNCH tree pointing at a tree that is gone:
      // no worktree checkout exists for the claim.
      runUpdate({
        cwd: primary,
        id: "task-thing",
        status: "in_progress",
        assignee: "arggon-maker",
        branch: "feat/task-thing",
      });
      const file = join(primary, itemRelPath);
      writeFileSync(
        file,
        readFileSync(file, "utf8").replace(
          /^branch: .*$/m,
          `branch: feat/task-thing\nworktree_path: ${opts.recordedWorktree}`,
        ),
        "utf8",
      );
      git(primary, ["add", "-A"]);
      git(primary, ["commit", "-q", "--allow-empty", "-m", "claim: task-thing (stale record)"]);
      return { primary, worktree };
    }
    recordClaim();
    return { primary, worktree };
  }

  const primaryItem = (): string => readFileSync(join(primary, itemRelPath), "utf8");
  const worktreeItem = (): string => readFileSync(join(worktree, itemRelPath), "utf8");

  beforeEach(() => {
    seed();
    client = new McpTestClient();
    client.cwd = primary;
    client.start();
  });

  it("arggon_comment lands in the claim worktree, never in the launching tree", async () => {
    const result = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-thing", text: "maker comment through MCP", author: "arggon-maker" },
    });
    expect(result.isError).toBeUndefined();
    const envelope = textContent(result) as Record<string, unknown>;
    expect(envelope).toMatchObject({ ok: true, command: "comment" });
    // The envelope's path names the WORKTREE copy, not the launching tree's.
    expect(String(envelope.path)).toBe(join(worktree, itemRelPath));
    // …and so does the file content.
    expect(worktreeItem()).toContain("@arggon-maker\nmaker comment through MCP");
    expect(primaryItem()).not.toContain("maker comment through MCP");
    // The comment commit rode the claim branch; the launch tree stayed clean.
    expect(gitOut(worktree, ["log", "--oneline", "-1"])).toContain("commented task-thing");
    expect(gitOut(primary, ["status", "--porcelain"])).toBe("");
  });

  it("arggon_handoff routes and records the claim branch, not the launch branch", async () => {
    const result = await client.request("tools/call", {
      name: "arggon_handoff",
      arguments: { id: "task-thing", next: "continue in the worktree", author: "arggon-maker" },
    });
    expect(result.isError).toBeUndefined();
    const envelope = textContent(result) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      ok: true,
      command: "handoff",
      handoff: { branch: "feat/task-thing", next: "continue in the worktree" },
    });
    // The incident's symptom (`handoff recording branch: main`) is gone: the
    // branch auto-detected from the claim tree is the claim branch.
    expect(worktreeItem()).toContain("- branch: feat/task-thing");
    expect(primaryItem()).not.toContain("continue in the worktree");
    expect(gitOut(primary, ["status", "--porcelain"])).toBe("");
  });

  it("arggon_update --status done flips the item in the claim tree (the auto-done wedge half)", async () => {
    // Done gate: the live checklist must be satisfied in the tree the write
    // lands in — the claim worktree.
    satisfyAcceptance(worktree, "task-thing");
    const result = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "task-thing", status: "done" },
    });
    expect(result.isError).toBeUndefined();
    const envelope = textContent(result) as Record<string, unknown>;
    expect(envelope).toMatchObject({ ok: true, command: "update" });
    expect((envelope.item as Record<string, unknown>).status).toBe("done");
    // The flip landed on the branch the claim rides; the launch tree's copy
    // still reads todo — it is not the item's tree and was never written.
    expect(worktreeItem()).toContain("status: done");
    expect(primaryItem()).toContain("status: todo");
    expect(gitOut(worktree, ["log", "--oneline", "-1"])).toContain("done task-thing");
    expect(gitOut(primary, ["status", "--porcelain"])).toBe("");
  });

  it("arggon_show reads the claim copy, not the stale launch copy", async () => {
    const result = await client.request("tools/call", {
      name: "arggon_show",
      arguments: { id: "task-thing", meta: true },
    });
    expect(result.isError).toBeUndefined();
    const envelope = textContent(result) as Record<string, unknown>;
    expect((envelope.item as Record<string, unknown>).status).toBe("in_progress");
    expect(String(envelope.path)).toBe(join(worktree, itemRelPath));
  });

  it("refuses an item-scoped write named when the recorded worktree is gone — and writes nothing into the launching tree", async () => {
    // The claim in the new primary points at a tree that never existed.
    const gone = `${worktree}-gone`;
    const seeded = seed({ recordedWorktree: gone });
    client = new McpTestClient();
    client.cwd = seeded.primary;
    client.start();
    const before = readFileSync(join(seeded.primary, itemRelPath), "utf8");

    const comment = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-thing", text: "must not land here", author: "arggon-maker" },
    });
    expect(comment.isError).toBe(true);
    expect(textContent(comment)).toMatchObject({
      ok: false,
      command: "comment",
      error: {
        code: "TRACKER_ROOT_MISMATCH",
        message: expect.stringContaining(gone),
      },
    });
    // The refusal names both trees: the launching one and the recorded claim tree.
    expect(textContent(comment)).toMatchObject({
      error: { message: expect.stringContaining(seeded.primary) },
    });

    // update is refused the same way — the dangerous half cannot land either.
    const done = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "task-thing", status: "done" },
    });
    expect(done.isError).toBe(true);
    expect(textContent(done)).toMatchObject({
      ok: false,
      command: "update",
      error: { code: "TRACKER_ROOT_MISMATCH" },
    });

    // Nothing was written into the launching tree: no comment, no flip, no commit.
    expect(readFileSync(join(seeded.primary, itemRelPath), "utf8")).toBe(before);
    expect(gitOut(seeded.primary, ["status", "--porcelain"])).toBe("");
    // The session survives the refusals.
    const still = await client.request("tools/list");
    expect(Array.isArray(still.tools)).toBe(true);
  });

  it("keeps the plain single-tree behavior for an item with no worktree claim", async () => {
    // No worktree at all: the comment lands in the launching tree, exactly as
    // before the routing existed.
    const plain = mkdtempSync(join(tmpdir(), "arggon-mcp-route-plain-"));
    git(plain, ["init", "-q"]);
    git(plain, ["config", "user.name", "test"]);
    git(plain, ["config", "user.email", "test@example.com"]);
    git(plain, ["commit", "-q", "--allow-empty", "-m", "seed"]);
    runInit({ dir: plain, force: false });
    const body = "## Context\n\nSeed.\n\n## Acceptance\n\nSeed.\n";
    runCreate({ cwd: plain, type: "initiative", title: "Inc", body });
    runCreate({ cwd: plain, type: "epic", title: "Area", parent: "inc", body });
    runCreate({
      cwd: plain,
      type: "story",
      title: "Topic",
      parent: "area",
      id: "story-topic",
      body,
    });
    runCreate({
      cwd: plain,
      type: "task",
      title: "Plain",
      parent: "story-topic",
      id: "task-plain",
      body,
    });
    client = new McpTestClient();
    client.cwd = plain;
    client.start();
    const result = await client.request("tools/call", {
      name: "arggon_comment",
      arguments: { id: "task-plain", text: "plain tree comment", author: "arggon-maker" },
    });
    expect(result.isError).toBeUndefined();
    const envelope = textContent(result) as Record<string, unknown>;
    expect(String(envelope.path)).toBe(
      join(plain, itemRelPath.replace("task-thing", "task-plain")),
    );
    expect(
      readFileSync(join(plain, itemRelPath.replace("task-thing", "task-plain")), "utf8"),
    ).toContain("plain tree comment");
  });
});

/** Stdout of one git command in a seeded routing fixture. */
function gitOut(cwd: string, args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args],
    {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

describe("deriveDefaultCliSpawn recognition (task-derive-cli-spawn-loader)", () => {
  it("derives the built-bin spec from a dist/cli.js entry", () => {
    withLaunch(["/repo/dist/cli.js", "mcp"], [], () => {
      expect(deriveDefaultCliSpawn()).toEqual({
        command: process.execPath,
        args: ["/repo/dist/cli.js"],
      });
    });
  });

  it("still recognizes the wrapper source run (back-compat)", () => {
    const wrapper = `/repo/node_modules/tsx/dist/${WRAPPER_SUFFIX}`;
    withLaunch([wrapper, "/repo/cli/src/cli.ts", "mcp"], [], () => {
      expect(deriveDefaultCliSpawn()).toEqual({
        command: process.execPath,
        args: [wrapper, "/repo/cli/src/cli.ts"],
      });
    });
  });

  it("derives the loader-form spec: execArgv is forwarded ahead of the entry", () => {
    const loader = "/repo/node_modules/tsx/dist/loader.mjs";
    withLaunch(["/repo/cli/src/cli.ts", "mcp"], ["--import", loader], () => {
      expect(deriveDefaultCliSpawn()).toEqual({
        command: process.execPath,
        args: ["--import", loader, "/repo/cli/src/cli.ts"],
      });
    });
  });

  it("forwards unrelated execArgv flags whole (fork semantics)", () => {
    const loader = "/repo/node_modules/tsx/dist/loader.mjs";
    withLaunch(["/repo/cli/src/cli.ts"], ["--cpu-prof-dir=/tmp/prof", "--import", loader], () => {
      expect(deriveDefaultCliSpawn()).toEqual({
        command: process.execPath,
        args: ["--cpu-prof-dir=/tmp/prof", "--import", loader, "/repo/cli/src/cli.ts"],
      });
    });
  });

  it("derives a bare-entry spec under an empty execArgv (NODE_OPTIONS registrations ride in the inherited env)", () => {
    withLaunch(["/repo/cli/src/cli.ts", "mcp"], [], () => {
      expect(deriveDefaultCliSpawn()).toEqual({
        command: process.execPath,
        args: ["/repo/cli/src/cli.ts"],
      });
    });
  });

  it("returns undefined for anything else (vitest forks worker; missing entry)", () => {
    withLaunch(["/repo/dist/workers/forks.js", "--threads"], [], () => {
      expect(deriveDefaultCliSpawn()).toBeUndefined();
    });
    withLaunch([], [], () => {
      expect(deriveDefaultCliSpawn()).toBeUndefined();
    });
  });
});
