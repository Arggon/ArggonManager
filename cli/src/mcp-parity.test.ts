/**
 * CLI <-> MCP parity (task-mcp-tools): the same operation driven through the
 * real CLI (`--json` on stdout, tsx child process) and through the MCP server
 * in-process must produce identical envelope outcomes. Runs each side in its
 * own freshly initialized tree and normalizes the absolute repo root.
 *
 * Also the standing invariant (task-mcp-cli-parity): the MCP tool input
 * schemas for the four wrapped commands are derived against the ACTUAL
 * commander option definitions in cli/src/cli.ts (parsed from source) and
 * must match BOTH ways, minus the documented exception list below.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
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
  // claimed_at leases are stamped per invocation (ms precision), so parity
  // compares their presence/shape rather than the exact instant.
  return JSON.parse(
    JSON.stringify(envelope)
      .replaceAll(dir, "<root>")
      .replace(/"claimed_at":"[^"]*"/g, '"claimed_at":"<lease>"'),
  ) as Envelope;
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

/**
 * Standing invariant (task-mcp-cli-parity): MCP and CLI stay in sync ALWAYS.
 *
 * The CLI option surface is derived by introspecting the real commander
 * definitions in cli/src/cli.ts (source parse of the `.command("...")` blocks:
 * every `.option(...)` flag before `.action(`). The MCP surface is derived by
 * asking the running MCP server itself (tools/list), so both sides of the
 * comparison are the live artifacts, not a static table that can drift.
 *
 * Documented exceptions — CLI options with intentionally NO MCP counterpart
 * (one-line reason each; adding a flag here without a reason fails review):
 */
const PARITY_EXCEPTIONS: Record<string, Record<string, string>> = {
  list: {
    "--json": "the agent-contract output switch itself; MCP tool text is always the JSON envelope",
  },
  create: {
    "--json": "the agent-contract output switch itself; MCP tool text is always the JSON envelope",
    "--no-commit":
      "default-on flip semantics governed tree-wide by x-tracker.auto-commit; MCP resolves commit identically without a flag",
  },
  update: {
    "--json": "the agent-contract output switch itself; MCP tool text is always the JSON envelope",
    "--no-commit":
      "default-on flip semantics governed tree-wide by x-tracker.auto-commit; MCP resolves commit identically without a flag",
    "--force": "human-only claim steal; the shared rules layer refuses agents (MCP passes agent: true)",
    "--steal": "human-only supervised takeover (TTY-gated); agents are refused by the shared rules layer",
    "--reason": "rationale recorded only by the human-only --steal takeover; meaningless without it",
  },
  comment: {
    "--json": "the agent-contract output switch itself; MCP tool text is always the JSON envelope",
    "--no-commit":
      "default-on flip semantics governed tree-wide by x-tracker.auto-commit; MCP resolves commit identically without a flag",
    "--file":
      "shell/TTY stdin helper for humans; MCP callers pass the text inline as the `text` property",
  },
};

/** Positional CLI arguments and the MCP schema property each maps to. */
const POSITIONAL_MAP: Record<string, string[]> = {
  list: [],
  create: ["type", "title"],
  update: ["id"],
  comment: ["id", "text"],
};

/** `.command("name")` blocks whose CLI surface must be mirrored by MCP. */
const PARITY_COMMANDS = ["list", "create", "update", "comment"] as const;

/** Extract the long flags of every `.option(...)` call in a command block. */
function deriveCliOptions(command: string): string[] {
  const source = readFileSync(cli, "utf8");
  const marker = `.command("${command}")`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`parity harness: .command("${command}") not found in cli.ts`);
  const next = source.indexOf("\nprogram", start + marker.length);
  const block = source.slice(start, next < 0 ? undefined : next);
  const actionAt = block.indexOf(".action(");
  const definitions = actionAt < 0 ? block : block.slice(0, actionAt);
  const flags: string[] = [];
  const optionRe = /\.option\(/g;
  for (const match of definitions.matchAll(optionRe)) {
    // Skip whitespace/quote after `.option(`, then take the FIRST long flag
    // token (`--name` or `--no-name`); short aliases like `-p,` are ignored.
    const rest = definitions.slice(match.index + match[0].length);
    const token = rest.slice(rest.indexOf("--"));
    const flag = token.match(/^--(?:no-)?[a-z][a-z0-9-]*/)?.[0];
    if (!flag) throw new Error(`parity harness: cannot parse an .option() flag for ${command}`);
    flags.push(flag);
  }
  return flags;
}

function flagToMcpProperty(flag: string): string {
  // --blocked-reason -> blocked_reason; --no-cascade -> no_cascade.
  const negated = flag.startsWith("--no-");
  const name = negated ? flag.slice(5) : flag.slice(2);
  const snake = name.replaceAll(/-([a-z])/g, (_m, c: string) => `_${c}`);
  return negated ? `no_${snake}` : snake;
}

/** Fetch the live tool definitions from an in-process MCP server. */
async function mcpTools(): Promise<Array<{ name: string; inputSchema: Record<string, unknown> }>> {
  const input = new PassThrough();
  const output = new PassThrough();
  runMcpServer({ cwd: process.cwd(), input, output });
  const responsePromise = new Promise<Envelope>((resolveResponse) => {
    output.on("data", (chunk: Buffer) => resolveResponse(JSON.parse(chunk.toString("utf8"))));
  });
  input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
  const response = await responsePromise;
  expect(response.id).toBe(1);
  return (response.result as Envelope).tools as Array<{
    name: string;
    inputSchema: Record<string, unknown>;
  }>;
}

describe("CLI <-> MCP option-surface parity (task-mcp-cli-parity)", () => {
  it("every MCP tool schema property maps back to a CLI option, and vice versa", async () => {
    const tools = await mcpTools();
    for (const command of PARITY_COMMANDS) {
      const tool = tools.find((t) => t.name === `arggon_${command}`);
      if (!tool) throw new Error(`parity: MCP tool arggon_${command} is missing`);
      const properties = Object.keys(
        (tool.inputSchema.properties ?? {}) as Record<string, unknown>,
      ).sort();
      const cliFlags = deriveCliOptions(command);
      const exceptions = PARITY_EXCEPTIONS[command] ?? {};

      // Exceptions must reference flags that actually exist (no stale entries).
      for (const [flag] of Object.entries(exceptions)) {
        expect(
          cliFlags.includes(flag),
          `stale parity exception '${flag}' on ${command}: the CLI option no longer exists; delete the exception`,
        ).toBe(true);
      }

      // Forward: every non-exception CLI option has an MCP schema counterpart.
      const expectedProperties = new Set(POSITIONAL_MAP[command] ?? []);
      for (const flag of cliFlags) {
        if (exceptions[flag]) continue;
        expectedProperties.add(flagToMcpProperty(flag));
      }
      const missing = [...expectedProperties].filter((p) => !properties.includes(p));
      expect(
        missing,
        `CLI options of \`${command}\` missing from the arggon_${command} MCP schema ` +
          `(add them to cli/src/mcp-server.ts, or document an exception in mcp-parity.test.ts)`,
      ).toEqual([]);

      // Reverse: every MCP schema property maps back to a CLI option/argument.
      const unmapped = properties.filter((p) => !expectedProperties.has(p));
      expect(
        unmapped,
        `arggon_${command} MCP schema properties with no CLI counterpart ` +
          `(remove them, or wire the CLI option up in cli/src/cli.ts)`,
      ).toEqual([]);
    }
  });
});
