/**
 * End-to-end smoke test for `arggon mcp` (task-mcp-scaffold).
 *
 * Spawns the real CLI (tsx) as a child process and speaks MCP over stdio,
 * newline-delimited JSON — client #2 beyond the in-process stream client in
 * mcp-server.test.ts. Covers the acceptance criteria: the handshake works
 * with a second client, tools/list advertises the kernel tools, and a
 * tools/call round trip returns the documented `--json` envelope.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runInit } from "./init.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(root, "cli/src/cli.ts");
const tsx = join(root, "node_modules/tsx/dist/cli.mjs");

type Message = Record<string, unknown>;

function startServer(cwd: string) {
  const child = spawn(process.execPath, [tsx, cli, "mcp"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const responses: Message[] = [];
  const waiters: Array<(message: Message) => void> = [];
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      const message = JSON.parse(line) as Message;
      if (waiters.length > 0) waiters.shift()!(message);
      else responses.push(message);
    }
  });
  child.stderr.on("data", (chunk: Buffer) => process.stderr.write(chunk));
  const send = (message: Message) => child.stdin!.write(`${JSON.stringify(message)}\n`);
  const request = (id: number, method: string, params?: Record<string, unknown>) => {
    const pending = new Promise<Message>((resolveRequest) => {
      waiters.push(resolveRequest);
    });
    send({ jsonrpc: "2.0", id, method, params });
    return pending;
  };
  return { child, send, request, waitNext: () => responses.shift() ?? waiters[0] };
}

function waitFor<T>(predicate: () => T | undefined, what: string): Promise<T> {
  const deadline = Date.now() + 15_000;
  return new Promise<T>((resolvePromise, reject) => {
    const tick = () => {
      const value = predicate();
      if (value !== undefined) return resolvePromise(value);
      if (Date.now() > deadline) return reject(new Error(`timed out waiting for ${what}`));
      setTimeout(tick, 50);
    };
    tick();
  });
}

describe("arggon mcp smoke (child process client)", () => {
  it("handshakes, lists tools, and serves a list round trip over real stdio", async () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-mcp-smoke-"));
    mkdirSync(dir, { recursive: true });
    runInit({ dir, force: false });

    const server = startServer(dir);
    try {
      const initialized = await server.request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke-client", version: "1.0" },
      });
      expect(initialized.result).toMatchObject({
        protocolVersion: "2025-06-18",
        serverInfo: { name: "arggon" },
      });
      server.send({ jsonrpc: "2.0", method: "notifications/initialized" });

      const tools = (await server.request(2, "tools/list")) as {
        result: { tools: Array<{ name: string }> };
      };
      expect(tools.result.tools.map((tool) => tool.name)).toEqual([
        "arggon_list",
        "arggon_create",
        "arggon_update",
        "arggon_comment",
      ]);

      await server.request(3, "tools/call", {
        name: "arggon_create",
        arguments: { type: "initiative", title: "Smoke initiative" },
      });
      const listed = await server.request(4, "tools/call", {
        name: "arggon_list",
        arguments: { type: "initiative" },
      });
      const result = listed.result as { content: Array<{ text: string }>; isError?: boolean };
      expect(result.isError).toBeUndefined();
      const envelope = JSON.parse(result.content[0]!.text) as {
        ok: boolean;
        command: string;
        items: Array<{ id: string }>;
      };
      expect(envelope).toMatchObject({ ok: true, command: "list" });
      expect(envelope.items.map((item) => item.id)).toContain("smoke-initiative");
    } finally {
      server.child.kill("SIGTERM");
      await waitFor(
        () => (server.child.exitCode !== null ? true : undefined),
        "server process exit",
      );
    }
  }, 30_000);
});
