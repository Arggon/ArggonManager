import { PassThrough } from "node:stream";
import { mkdtempSync as _mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { arggonVersion } from "./docs.js";
import { runInit } from "./init.js";
import { runMcpServer } from "./mcp-server.js";

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
          resolve("error" in message ? message : (message.result as Record<string, unknown>) ?? {});
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

  start(): void {
    runMcpServer({
      cwd: this.cwd,
      input: this.serverInput,
      output: this.output,
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
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP" });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp" });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login" });
  return dir;
}

function textContent(result: Record<string, unknown>): unknown {
  const content = result.content as Array<{ type: string; text: string }>;
  expect(content[0]?.type).toBe("text");
  return JSON.parse(content[0]!.text);
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

  it("lists the nine tools with JSON-schema inputs", async () => {
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
      error: { message: "id 'nope' not found under tasks/", code: "UPDATE_FAILED" },
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

  it("answers ping, rejects unknown methods, and reports parse errors", async () => {    expect(await client.request("ping")).toEqual({});

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
    const toolsList = tools.tools as Array<{ name: string; inputSchema: { properties: Record<string, unknown> } }>;
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
    runCreate({ cwd: repoDir, type: "epic", title: "Billing", parent: "launch-mvp", id: "billing" });
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
      arguments: { type: "task", title: "Add rate limiting", parent: "story-login", id: "rate-limit" },
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
    const empty = await client.request("tools/call", { name: "arggon_next", arguments: { ready: true } });
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
    const file = join(repoDir, "tasks", "launch-mvp", "auth", "story-login", "task-rate-limit.md");
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
