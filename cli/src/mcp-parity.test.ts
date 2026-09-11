/**
 * CLI <-> MCP parity (task-mcp-tools): the same operation driven through the
 * real CLI (`--json` on stdout, tsx child process) and through the MCP server
 * in-process must produce identical envelope outcomes. Runs each side in its
 * own freshly initialized tree and normalizes the absolute repo root.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { runInit } from "./init.js";
import { runMcpServer } from "./mcp-server.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(root, "cli/src/cli.ts");
const tsx = join(root, "node_modules/tsx/dist/cli.mjs");

type Envelope = Record<string, unknown>;

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [tsx, cli, "--json", ...args], {
    encoding: "utf8",
    cwd,
  });
}

function cliJson(args: string[], cwd: string): Envelope {
  const proc = runCli(args, cwd);
  expect(proc.status, proc.stderr).toBe(0);
  return JSON.parse(proc.stdout) as Envelope;
}

/** In-process MCP client bound to one repo root (client #2). */
async function mcpCall(
  cwd: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: Envelope; isError: boolean }> {
  const input = new PassThrough();
  const output = new PassThrough();
  runMcpServer({ cwd, input, output });
  const responsePromise = new Promise<Envelope>((resolveResponse) => {
    output.on("data", (chunk: Buffer) => resolveResponse(JSON.parse(chunk.toString("utf8"))));
  });
  input.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name, arguments: args },
    })}\n`,
  );
  const response = await responsePromise;
  expect(response.id).toBe(7);
  const result = response.result as Envelope;
  const text = (result.content as Array<{ text: string }>)[0]!.text;
  return { result: JSON.parse(text) as Envelope, isError: result.isError === true };
}

function normalize(envelope: Envelope, dir: string): Envelope {
  return JSON.parse(JSON.stringify(envelope).replaceAll(dir, "<root>")) as Envelope;
}

function seedTree(dir: string): void {
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP" });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp" });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login" });
}

function twinTrees(): { cliDir: string; mcpDir: string } {
  const cliDir = mkdtempSync(join(tmpdir(), "arggon-parity-cli-"));
  seedTree(cliDir);
  const mcpDir = mkdtempSync(join(tmpdir(), "arggon-parity-mcp-"));
  cpSync(cliDir, mcpDir, { recursive: true });
  return { cliDir, mcpDir };
}

const CREATE_ARGS = {
  type: "task",
  title: "Add rate limiting",
  parent: "story-login",
  id: "rate-limit",
};

describe("CLI <-> MCP parity", () => {
  it("create produces the same envelope through both entry points", async () => {
    const { cliDir, mcpDir } = twinTrees();
    const cliResult = cliJson(
      ["create", "task", CREATE_ARGS.title, "--parent", CREATE_ARGS.parent, "--id", "rate-limit"],
      cliDir,
    );
    const mcpResult = await mcpCall(mcpDir, "arggon_create", CREATE_ARGS);
    expect(mcpResult.isError).toBe(false);
    expect(normalize(mcpResult.result, mcpDir)).toEqual(normalize(cliResult, cliDir));
  });

  it("update claims identically through both entry points", async () => {
    const { cliDir, mcpDir } = twinTrees();
    cliJson(["create", "task", CREATE_ARGS.title, "--parent", CREATE_ARGS.parent, "--id", "rate-limit"], cliDir);
    await mcpCall(mcpDir, "arggon_create", CREATE_ARGS);
    const cliResult = cliJson(
      ["update", "task-rate-limit", "--status", "in_progress", "--assignee", "same-user"],
      cliDir,
    );
    const mcpResult = await mcpCall(mcpDir, "arggon_update", {
      id: "task-rate-limit",
      status: "in_progress",
      assignee: "same-user",
    });
    expect(mcpResult.isError).toBe(false);
    expect(normalize(mcpResult.result, mcpDir)).toEqual(normalize(cliResult, cliDir));
  });

  it("update --add-depends-on emits identical depends_on through both entry points", async () => {
    const { cliDir, mcpDir } = twinTrees();
    cliJson(["create", "task", CREATE_ARGS.title, "--parent", CREATE_ARGS.parent, "--id", "rate-limit"], cliDir);
    await mcpCall(mcpDir, "arggon_create", CREATE_ARGS);
    cliJson(["create", "task", "Second", "--parent", "story-login", "--id", "second"], cliDir);
    await mcpCall(mcpDir, "arggon_create", {
      type: "task",
      title: "Second",
      parent: "story-login",
      id: "second",
    });
    const cliResult = cliJson(
      ["update", "task-rate-limit", "--add-depends-on", "task-second"],
      cliDir,
    );
    const mcpResult = await mcpCall(mcpDir, "arggon_update", {
      id: "task-rate-limit",
      add_depends_on: "task-second",
    });
    expect(mcpResult.isError).toBe(false);
    expect(normalize(mcpResult.result, mcpDir)).toEqual(normalize(cliResult, cliDir));
    const item = cliResult.item as { depends_on?: string[] };
    expect(item.depends_on).toEqual(["task-second"]);
  });

  it("list returns the same items through both entry points", async () => {
    const { cliDir, mcpDir } = twinTrees();
    cliJson(["create", "task", CREATE_ARGS.title, "--parent", CREATE_ARGS.parent, "--id", "rate-limit"], cliDir);
    await mcpCall(mcpDir, "arggon_create", CREATE_ARGS);
    const cliResult = cliJson(["list", "--type", "task"], cliDir);
    const mcpResult = await mcpCall(mcpDir, "arggon_list", { type: "task" });
    expect(mcpResult.isError).toBe(false);
    expect(normalize(mcpResult.result, mcpDir)).toEqual(normalize(cliResult, cliDir));
  });

  it("errors match: same message text and ok:false shape through both entry points", async () => {
    const { cliDir, mcpDir } = twinTrees();
    const cliProc = runCli(["update", "nope", "--status", "todo"], cliDir);
    expect(cliProc.status).not.toBe(0);
    const cliResult = JSON.parse(cliProc.stdout) as Envelope;
    const mcpResult = await mcpCall(mcpDir, "arggon_update", { id: "nope", status: "todo" });
    expect(mcpResult.isError).toBe(true);
    expect(mcpResult.result).toEqual(normalize(cliResult, cliDir));
  });
});
