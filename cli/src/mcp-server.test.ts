import { PassThrough } from "node:stream";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { runMcpServer } from "./mcp-server.js";

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
      serverInfo: { name: "arggon", version: "0.0.0" },
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

  it("lists the three tools with JSON-schema inputs", async () => {
    const result = await client.request("tools/list");
    const tools = result.tools as Array<{ name: string; inputSchema: Record<string, unknown> }>;
    expect(tools.map((tool) => tool.name)).toEqual([
      "arggon_list",
      "arggon_create",
      "arggon_update",
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
    }
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
    expect(items[0]).toHaveProperty("blocked_reason");

    const claimed = await client.request("tools/call", {
      name: "arggon_update",
      arguments: { id: "task-rate-limit", status: "in_progress", assignee: "agent-x" },
    });
    const updateEnvelope = textContent(claimed) as Record<string, unknown>;
    expect(updateEnvelope).toMatchObject({ ok: true, command: "update" });
    expect((updateEnvelope.item as Record<string, unknown>).status).toBe("in_progress");
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
