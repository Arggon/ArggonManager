#!/usr/bin/env node
/**
 * OpenCode V2 smoke harness (plan-opencode2-009 T8, W2 scope).
 *
 * Boots throwaway fixture repos, runs a real headless `opencode run`
 * (standalone server, JSON transcript + runtime logs) and asserts the bundled
 * plugin behavior end to end:
 *
 *   1. fresh init      — plugin bundled with its `//` marker, loads, and the
 *                        arggon MCP server is registered and usable (the model
 *                        executes `tools.arggon.arggon_next`).
 *   2. adopter config  — init writes no `opencode.jsonc`; the plugin alone
 *                        registers arggon and the model uses it.
 *   3. never clobber   — a pre-existing `arggon` server configured by the
 *                        adopter keeps running (sentinel marker) and the config
 *                        bytes are untouched.
 *   4. failure isolation — a broken sibling plugin is logged and ignored: the
 *                        session, the healthy arggon plugin and the CLI all
 *                        keep working.
 *   5. plugin absent   — the CLI and the config-registered MCP server are
 *                        unaffected without the plugin.
 *
 * Bounded and cheap by design: one short prompt per session, `--format json`,
 * and a pinned small model (`OPENCODE_SMOKE_MODEL` overrides). Exit codes:
 *   0 — all checks passed, or `skipped: opencode not installed`
 *   1 — a check failed (fixtures are kept for inspection)
 *
 * Deliberately NOT part of `npm test`: CI has no `opencode` binary. Run with
 * `npm run smoke:opencode`; set `ARGON_SMOKE_KEEP=1` to keep fixtures even on
 * success, `OPENCODE_SMOKE_TIMEOUT_MS` to change the per-command timeout.
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "cli/src/cli.ts");
const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");
const PLUGIN_DEST = ".opencode/plugins/arggon/index.ts";
const PLUGIN_MARKER = `// arggon:generated template="opencode/plugins/arggon/index.ts"`;
const MCP_TOOL_CODE = "return await tools.arggon.arggon_next({})";
const MODEL = process.env.OPENCODE_SMOKE_MODEL ?? "opencode-go/deepseek-v4-flash";
const TIMEOUT_MS = Number(process.env.OPENCODE_SMOKE_TIMEOUT_MS ?? 240_000);

const TOOL_PROMPT = [
  "Use the execute tool with exactly this code:",
  MCP_TOOL_CODE,
  "If the tool is not found, run the same code once more (the tool catalog can lag server startup).",
  "Reply with only the raw JSON result.",
].join("\n");

type RunResult = { status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string };

type TranscriptPart = {
  type?: string;
  tool?: string;
  state?: { status?: string; input?: { code?: string }; output?: string };
};
type TranscriptEvent = { type?: string; part?: TranscriptPart };

const failures: string[] = [];
const fixtures: Fixture[] = [];

function check(name: string, ok: boolean, detail?: string): void {
  const suffix = ok || detail === undefined ? "" : `\n      ${detail.split("\n").slice(0, 6).join("\n      ")}`;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${suffix}`);
  if (!ok) failures.push(name);
}

function scenario(name: string): void {
  console.log(`\n== ${name}`);
}

function opencodeAvailable(): boolean {
  const probe = spawnSync("opencode", ["--version"], { encoding: "utf8", timeout: 30_000 });
  return probe.error === undefined && probe.status === 0;
}

class Fixture {
  readonly dir: string;
  private readonly binDir: string;

  constructor(name: string) {
    this.dir = mkdtempSync(join(tmpdir(), `arggon-smoke-${name}-`));
    fixtures.push(this);
    this.binDir = join(this.dir, ".smoke-bin");
    mkdirSync(this.binDir, { recursive: true });
    // The generated config/plugin invokes `arggon mcp`; point that at THIS
    // checkout's CLI source instead of whatever is globally installed.
    const shim = join(this.binDir, "arggon");
    writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${tsx}" "${cli}" "$@"\n`);
    chmodSync(shim, 0o755);
  }

  private env(): NodeJS.ProcessEnv {
    // PWD must follow cwd: OpenCode resolves the project directory from PWD
    // when present, and an inherited value would silently point the session at
    // the caller's repo instead of the fixture.
    return {
      ...process.env,
      PWD: this.dir,
      PATH: `${this.binDir}:${process.env.PATH ?? ""}`,
    };
  }

  private run(command: string, args: string[]): RunResult {
    const proc = spawnSync(command, args, {
      cwd: this.dir,
      env: this.env(),
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { status: proc.status, signal: proc.signal, stdout: proc.stdout ?? "", stderr: proc.stderr ?? "" };
  }

  cli(args: string[]): RunResult {
    return this.run(process.execPath, [tsx, cli, ...args]);
  }

  init(): RunResult {
    return this.cli(["init", this.dir, "--json"]);
  }

  opencode(message: string): RunResult {
    return this.run("opencode", [
      "run",
      "--standalone",
      "--print-logs",
      "--log-level",
      "info",
      "--model",
      MODEL,
      "--format",
      "json",
      message,
    ]);
  }

  path(rel: string): string {
    return join(this.dir, ...rel.split("/"));
  }

  read(rel: string): string {
    return readFileSync(this.path(rel), "utf8");
  }

  write(rel: string, content: string): void {
    const abs = this.path(rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }

  /** Persist the raw session transcript next to the fixture (review evidence). */
  saveTranscript(label: string, result: RunResult): void {
    this.write(`.smoke-evidence/${label}.stdout.jsonl`, result.stdout);
    this.write(`.smoke-evidence/${label}.stderr.log`, result.stderr);
  }
}

function parseTranscript(stdout: string): TranscriptEvent[] {
  const events: TranscriptEvent[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      events.push(JSON.parse(line) as TranscriptEvent);
    } catch {
      // Non-JSON line on stdout: transcript noise, not a check failure.
    }
  }
  return events;
}

/** Completed Code Mode calls that ran `arggon_next` and returned the next envelope. */
function successfulArggonNext(stdout: string): boolean {
  return parseTranscript(stdout).some((event) => {
    if (event.type !== "tool_use" || event.part?.tool !== "execute") return false;
    const state = event.part.state;
    if (state?.status !== "completed") return false;
    if (!(state.input?.code ?? "").includes("arggon_next")) return false;
    const output = state.output ?? "";
    return output.includes('"ok": true') && output.includes('"command": "next"');
  });
}

function textContains(stdout: string, needle: string): boolean {
  return parseTranscript(stdout).some(
    (event) => event.type === "text" && JSON.stringify(event.part).includes(needle),
  );
}

function runTail(result: RunResult): string {
  const lines = [...result.stdout.split("\n"), "--- stderr ---", ...result.stderr.split("\n")];
  return lines.slice(-12).join("\n");
}

function pluginLoaded(result: RunResult): boolean {
  return /msg="loading plugin" id=.*plugins\/arggon/.test(result.stderr);
}

function mcpConnected(result: RunResult): boolean {
  return result.stderr.includes('message="mcp connected" server=arggon');
}

function scenarioFreshInit(): void {
  scenario("fresh init: bundled plugin loads and registers MCP");
  const f = new Fixture("fresh");
  const init = f.init();
  check("init exits 0", init.status === 0, runTail(init));
  check("init bundles the plugin", existsSync(f.path(PLUGIN_DEST)));
  if (existsSync(f.path(PLUGIN_DEST))) {
    check("bundled plugin starts with the // provenance marker", f.read(PLUGIN_DEST).startsWith(`${PLUGIN_MARKER}\n`));
  }
  const session = f.opencode(TOOL_PROMPT);
  f.saveTranscript("fresh-init", session);
  check("session runs in the fixture project", session.stderr.includes(`directory=${f.dir}`), runTail(session));
  check("plugin loads in the runtime", pluginLoaded(session), runTail(session));
  check("arggon MCP server registered", mcpConnected(session), runTail(session));
  check("model executed arggon_next successfully", successfulArggonNext(session.stdout), runTail(session));
}

function scenarioAdopterConfig(): void {
  scenario("adopter config: plugin registers MCP without opencode.jsonc");
  const f = new Fixture("adopter");
  f.write("opencode.json", '{\n  "$schema": "https://opencode.ai/config.json"\n}\n');
  const init = f.init();
  check("init exits 0", init.status === 0, runTail(init));
  check("no opencode.jsonc written over the adopter config", !existsSync(f.path("opencode.jsonc")));
  const session = f.opencode(TOOL_PROMPT);
  f.saveTranscript("adopter-config", session);
  check("plugin loads in the runtime", pluginLoaded(session), runTail(session));
  check("plugin registers arggon MCP (no config entry exists)", mcpConnected(session), runTail(session));
  check("model executed arggon_next successfully", successfulArggonNext(session.stdout), runTail(session));
}

function scenarioNeverClobber(): void {
  scenario("never clobber: adopter-configured arggon server keeps running");
  const f = new Fixture("clobber");
  const sentinel = f.path("sentinel-used");
  const config = [
    "{",
    '  "$schema": "https://opencode.ai/config.json",',
    '  "mcp": {',
    '    "servers": {',
    '      "arggon": {',
    '        "type": "local",',
    `        "command": ["/bin/sh", "-c", "echo sentinel > ${sentinel}; sleep 1"]`,
    "      }",
    "    }",
    "  }",
    "}",
    "",
  ].join("\n");
  f.write("opencode.json", config);
  const init = f.init();
  check("init exits 0", init.status === 0, runTail(init));
  const session = f.opencode("Reply with exactly: CLOBBER_CHECK");
  f.saveTranscript("never-clobber", session);
  check("session still succeeds", session.status === 0, runTail(session));
  check("plugin loads in the runtime", pluginLoaded(session), runTail(session));
  check("adopter command ran (server was not replaced)", existsSync(sentinel));
  check("adopter config bytes untouched", f.read("opencode.json") === config);
}

function scenarioFailureIsolation(): void {
  scenario("failure isolation: broken sibling plugin never breaks the session");
  const f = new Fixture("isolation");
  f.write("opencode.json", '{\n  "$schema": "https://opencode.ai/config.json"\n}\n');
  f.init();
  f.write(
    ".opencode/plugins/broken/index.ts",
    'export default {\n  id: "broken",\n  async setup() {\n    throw new Error("synthetic smoke failure")\n  },\n}\n',
  );
  const session = f.opencode("Reply with exactly: ISOLATED");
  f.saveTranscript("failure-isolation", session);
  check(
    "session survives the broken plugin",
    session.status === 0 && textContains(session.stdout, "ISOLATED"),
    runTail(session),
  );
  check(
    "broken plugin failure is logged, not fatal",
    session.stderr.includes("failed to load plugin") && session.stderr.includes("synthetic smoke failure"),
    runTail(session),
  );
  check("healthy arggon plugin still registers MCP", mcpConnected(session), runTail(session));
  const next = f.cli(["next", "--json"]);
  check("CLI unaffected", next.status === 0 && next.stdout.includes('"ok":true'), runTail(next));
}

function scenarioPluginAbsent(): void {
  scenario("plugin absent: CLI and configured MCP keep working");
  const f = new Fixture("absent");
  f.init();
  rmSync(f.path(".opencode/plugins"), { recursive: true, force: true });
  check("plugin removed from the fixture", !existsSync(f.path(PLUGIN_DEST)));
  const session = f.opencode("Reply with exactly: PLUGIN_ABSENT");
  f.saveTranscript("plugin-absent", session);
  check(
    "session runs without the plugin",
    session.status === 0 && textContains(session.stdout, "PLUGIN_ABSENT"),
    runTail(session),
  );
  check("config-registered MCP server still connects", mcpConnected(session), runTail(session));
  const next = f.cli(["next", "--json"]);
  check("CLI unaffected without the plugin", next.status === 0 && next.stdout.includes('"ok":true'), runTail(next));
}

function main(): void {
  console.log("smoke:opencode — OpenCode V2 plugin harness (W2)");
  if (!opencodeAvailable()) {
    console.log("skipped: opencode not installed");
    return;
  }
  console.log(`model: ${MODEL}`);
  scenarioFreshInit();
  scenarioAdopterConfig();
  scenarioNeverClobber();
  scenarioFailureIsolation();
  scenarioPluginAbsent();

  if (failures.length > 0) {
    console.error(`\nsmoke:opencode FAILED — ${failures.length} check(s):\n${failures.map((f) => `- ${f}`).join("\n")}`);
    console.error(`fixtures kept for inspection:\n${fixtures.map((f) => `- ${f.dir}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`\nsmoke:opencode passed — ${fixtures.length} scenarios, 0 failures`);
  if (process.env.ARGON_SMOKE_KEEP !== "1") {
    for (const f of fixtures) rmSync(f.dir, { recursive: true, force: true });
  }
}

main();
