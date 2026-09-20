#!/usr/bin/env node
/**
 * OpenCode V2 smoke harness (plan-opencode2-009 T8 W2 + T9–T10 W3).
 *
 * Boots throwaway fixture repos, runs a real headless `opencode run`
 * (standalone server, JSON transcript + runtime logs) and asserts the bundled
 * plugin behavior end to end:
 *
 *   W2 — MCP auto-registration:
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
 *   Native-first W2 — the `arggon` tool namespace (task-native-tools):
 *   6. native tools    — with the workspace kernel linked, the plugin registers
 *                        the twelve `arggon` Code Mode tools and one headless
 *                        session calls every one of them (contract-shaped
 *                        envelopes, create→update round-trip, the two
 *                        GitHub-dependent tools failing as typed errors while
 *                        the session continues) and finds the namespace in the
 *                        Code Mode catalog via `search`.
 *
 *   W3 — session context:
 *   6. branch          — a claimed item on `feat/<id>` resolves, injects the
 *                        bounded item block (the smoke measures the logged
 *                        block text itself, not the reported count) and
 *                        renames the session.
 *   7. storage map     — an observed `arggon_show` call on a non-matching
 *                        branch correlates the item for the next model call.
 *   8. env override    — `ARGON_ITEM` resolves with no branch match.
 *   9. nothing resolves — tracker present, no claim/branch/env/observed call:
 *                        the hook is silent.
 *  10. outside trees   — no tracker root: silent, session unaffected.
 *  11. hygiene         — a shell `git commit` with a broken tracker item logs
 *                        the `arggon validate` warning; the commit is not
 *                        blocked.
 *
 * Compaction note: the block is re-injected on every agent-loop model call
 * (`ctx.session.hook("context")`), which is by construction the same call that
 * follows a compaction checkpoint. A headless run cannot force compaction
 * deterministically; the closest reproducible evidence is scenario 7, where
 * the block appears on a *later* model call of the same session, plus the W3
 * probe transcript (`.smoke-evidence/`): one `context` hook firing per model
 * request, including tool-driven continuations.
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
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "cli/src/cli.ts");
const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");
const PLUGIN_SOURCE = join(repoRoot, "opencode/plugins/arggon/index.ts");
const PLUGIN_DEST = ".opencode/plugins/arggon/index.ts";
const PLUGIN_MARKER = `// arggon:generated template="opencode/plugins/arggon/index.ts"`;
const MCP_TOOL_CODE = "return await tools.arggon.arggon_next({})";
const MODEL = process.env.OPENCODE_SMOKE_MODEL ?? "opencode-go/deepseek-v4-flash";
const TIMEOUT_MS = Number(process.env.OPENCODE_SMOKE_TIMEOUT_MS ?? 240_000);
// Mirrors ITEM_BLOCK_MAX_BYTES in the plugin source; asserted in unit tests.
// The smoke measures the logged block text itself instead of trusting the
// byte count the plugin reports (F8).
const CONTEXT_BLOCK_MAX_BYTES = 1024;

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

  private env(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    // PWD must follow cwd: OpenCode resolves the project directory from PWD
    // when present, and an inherited value would silently point the session at
    // the caller's repo instead of the fixture. ARGON_ITEM is cleared by
    // default so the harness is deterministic even under a leaked env; the
    // env-override scenario passes it explicitly.
    return {
      ...process.env,
      ARGON_ITEM: undefined,
      PWD: this.dir,
      PATH: `${this.binDir}:${process.env.PATH ?? ""}`,
      ...overrides,
    };
  }

  private run(command: string, args: string[], overrides?: NodeJS.ProcessEnv): RunResult {
    const proc = spawnSync(command, args, {
      cwd: this.dir,
      env: this.env(overrides),
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { status: proc.status, signal: proc.signal, stdout: proc.stdout ?? "", stderr: proc.stderr ?? "" };
  }

  cli(args: string[]): RunResult {
    return this.run(process.execPath, [tsx, cli, ...args]);
  }

  git(args: string[]): RunResult {
    return this.run("git", args);
  }

  /** git repo + identity so the tracker's auto-commits and shell commits work. */
  bootstrap(): void {
    this.git(["init", "-q"]);
    this.git(["config", "user.email", "smoke@example.com"]);
    this.git(["config", "user.name", "smoke-smoke"]);
  }

  init(): RunResult {
    return this.cli(["init", this.dir, "--json"]);
  }

  /** Copy the committed plugin source into the fixture (no `arggon init`). */
  copyPlugin(): void {
    this.write(PLUGIN_DEST, readFileSync(PLUGIN_SOURCE, "utf8"));
  }

  /**
   * Link this checkout's kernel package into the fixture so the plugin's
   * guarded `@arggon/lib` import resolves (ADR 0013: W2 consumes the workspace
   * package; W3 vendors the dependency-free bundle instead).
   */
  linkKernel(): void {
    const scope = this.path("node_modules/@arggon");
    mkdirSync(scope, { recursive: true });
    const link = join(scope, "lib");
    if (!existsSync(link)) symlinkSync(join(repoRoot, "lib"), link, "junction");
  }

  private json(result: RunResult): Record<string, unknown> | undefined {
    try {
      return JSON.parse(result.stdout) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  private itemId(result: RunResult): string | undefined {
    const item = this.json(result)?.item;
    const id = item !== null && typeof item === "object" ? (item as { id?: unknown }).id : undefined;
    return typeof id === "string" ? id : undefined;
  }

  /** initiative → epic → story → task; returns the task id, story id and directory. */
  createTaskChain(): { id: string; story: string; directory: string } | undefined {
    const initiative = this.itemId(this.cli(["create", "initiative", "Smoke Initiative", "--json"]));
    if (initiative === undefined) return undefined;
    const epic = this.itemId(this.cli(["create", "epic", "Smoke Epic", "--parent", initiative, "--json"]));
    if (epic === undefined) return undefined;
    const story = this.itemId(this.cli(["create", "story", "Smoke Story", "--parent", epic, "--json"]));
    if (story === undefined) return undefined;
    const task = this.json(this.cli(["create", "task", "Smoke Item", "--parent", story, "--json"]));
    const item = task?.item as { id?: unknown; path?: unknown } | undefined;
    if (typeof item?.id !== "string" || typeof item.path !== "string") return undefined;
    const directory = item.path.split("/").slice(0, -1).join("/");
    return { id: item.id, story, directory };
  }

  claim(id: string): RunResult {
    return this.cli(["update", id, "--status", "in_progress", "--assignee", "smoke"]);
  }

  opencode(message: string, overrides?: NodeJS.ProcessEnv): RunResult {
    return this.run(
      "opencode",
      [
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
      ],
      overrides,
    );
  }

  /** Session titles persisted by the standalone server for this project. */
  sessionTitles(): string[] {
    const listed = this.run("opencode", ["session", "list", "--standalone", "--format", "json"]);
    try {
      const parsed = JSON.parse(listed.stdout) as Array<{ title?: unknown }>;
      return parsed
        .map((entry) => (typeof entry?.title === "string" ? entry.title : undefined))
        .filter((title): title is string => title !== undefined);
    } catch {
      return [];
    }
  }

  /** Subject of the newest commit in the fixture. */
  headCommitSubject(): string {
    return this.git(["log", "-1", "--pretty=%s"]).stdout.trim();
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

type Injection = { id: string; bytes: number; text?: string };

/**
 * `[arggon] context: injected item <id> (<bytes> bytes) block=<json>`
 * observations. `text` is the exact injected block the plugin logs after
 * `block=`; the smoke measures it itself (F8). The suffix is optional so an
 * older runtime still parses (the independent check then fails loudly).
 */
function contextInjections(stderr: string): Injection[] {
  const injections: Injection[] = [];
  const pattern = /\[arggon\] context: injected item (\S+) \((\d+) bytes\)(?: block=(.+))?$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stderr)) !== null) {
    let text: string | undefined;
    if (match[3] !== undefined) {
      try {
        const parsed: unknown = JSON.parse(match[3]);
        if (typeof parsed === "string") text = parsed;
      } catch {
        // Not JSON: leave `text` unset and let the measured check report it.
      }
    }
    injections.push({ id: match[1], bytes: Number(match[2]), text });
  }
  return injections;
}

/** Independent UTF-8 measurement of a logged injection block (F8). */
function measuredInjectionBytes(injection: Injection): number | undefined {
  return injection.text === undefined ? undefined : Buffer.byteLength(injection.text, "utf8");
}

/**
 * The logged block text independently measures to the plugin-reported byte
 * count and stays within the hard bound — the smoke never trusts the plugin's
 * arithmetic alone (F8).
 */
function injectionMeasuredWithin(injection: Injection): boolean {
  const measured = measuredInjectionBytes(injection);
  return (
    measured !== undefined &&
    measured > 0 &&
    measured === injection.bytes &&
    measured <= CONTEXT_BLOCK_MAX_BYTES
  );
}

/** `id:reportedB/measuredB` detail for injection checks. */
function injectionDetail(injections: Injection[]): string {
  const entries = injections.map(
    (entry) => `${entry.id}:${entry.bytes}B/${measuredInjectionBytes(entry) ?? "?"}B`,
  );
  return entries.join(", ") || "no injection";
}

function renameLogged(stderr: string, id: string): boolean {
  return stderr.includes(`[arggon] session renamed to ${id}`);
}

/** Fixture with an initialized tracker and a claimed item; `<id>` is undefined on failure. */
function claimedItemFixture(name: string): { fixture: Fixture; item: { id: string; directory: string } | undefined } {
  const fixture = new Fixture(name);
  fixture.bootstrap();
  const init = fixture.init();
  check("init exits 0", init.status === 0, runTail(init));
  const item = fixture.createTaskChain();
  if (item === undefined) return { fixture, item };
  const claim = fixture.claim(item.id);
  check("fixture item claimed", claim.status === 0, runTail(claim));
  return { fixture, item };
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
  check(
    "no native tools registered without @arggon/lib (dependency-less adopter shape)",
    !session.stderr.includes("[arggon] tools: registered"),
    runTail(session),
  );
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

// ---------------------------------------------------------------------------
// Native-first W2 — the `arggon` tool namespace (task-native-tools)
// ---------------------------------------------------------------------------

/** The twelve native tools (spec-native-first-011 §Tools). */
const NATIVE_TOOL_NAMES = [
  "list",
  "create",
  "update",
  "show",
  "next",
  "report",
  "validate",
  "comment",
  "handoff",
  "priority",
  "sync",
  "import_issues",
] as const;

/** Contract commands the script must return `ok: true` for, keyed by tool. */
const NATIVE_TOOLS_OK: ReadonlyArray<readonly [string, string]> = [
  ["list", "list"],
  ["show", "show"],
  ["next", "next"],
  ["report", "report"],
  ["validate", "validate"],
  ["create", "create"],
  ["update", "update"],
  ["comment", "comment"],
  ["handoff", "handoff"],
  ["priority", "priority"],
];

/**
 * One Code Mode script calling every native tool: the ten environment-
 * independent ones for their envelopes, the two GitHub-dependent ones
 * (sync/import_issues) through try/catch to observe the typed tool error, plus
 * the namespace slice of the Code Mode catalog via `search`.
 */
function nativeToolsScript(story: string, task: string): string {
  return [
    "const out = {};",
    `out.list = await tools.arggon.list({});`,
    `out.show = await tools.arggon.show({ id: "${task}" });`,
    "out.next = await tools.arggon.next({});",
    "out.report = await tools.arggon.report({});",
    "out.validate = await tools.arggon.validate({});",
    `out.create = await tools.arggon.create({ type: "task", title: "Native smoke task", parent: "${story}" });`,
    "const created = out.create.item.id;",
    'out.update = await tools.arggon.update({ id: created, status: "in_progress", assignee: "smoke" });',
    'out.comment = await tools.arggon.comment({ id: created, text: "native smoke comment" });',
    'out.handoff = await tools.arggon.handoff({ id: created, next: "continue native smoke" });',
    "out.priority = await tools.arggon.priority({ dry_run: true });",
    'let syncError = "";',
    "try { out.sync = await tools.arggon.sync({}); } catch (error) { syncError = String((error && error.message) || error); }",
    'let importError = "";',
    "try { out.import_issues = await tools.arggon.import_issues({ dry_run: true }); } catch (error) { importError = String((error && error.message) || error); }",
    'const found = await search({ namespace: "arggon", limit: 20 });',
    "return { out, syncError, importError, search: found };",
  ].join("\n");
}

/**
 * Completed `execute` result whose code contains `needle`, parsed back to the
 * object the script returned. The Code Mode tool's transcript `output` is the
 * pretty-printed JSON of that value.
 */
function executeJson(stdout: string, needle: string): Record<string, unknown> | undefined {
  for (const event of parseTranscript(stdout)) {
    if (event.type !== "tool_use" || event.part?.tool !== "execute") continue;
    const state = event.part.state;
    if (state?.status !== "completed") continue;
    if (!(state.input?.code ?? "").includes(needle)) continue;
    try {
      return JSON.parse(state.output ?? "") as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Build `@arggon/lib` when the checkout has no dist/ (the smoke needs the artifact). */
function ensureKernelBuilt(): void {
  if (existsSync(join(repoRoot, "lib/dist/index.js"))) return;
  console.log("  building @arggon/lib (missing lib/dist)…");
  const execpath = process.env.npm_execpath;
  const command = execpath ? process.execPath : "npm";
  const argv = execpath
    ? [execpath, "run", "build", "--workspace", "@arggon/lib"]
    : ["run", "build", "--workspace", "@arggon/lib"];
  const proc = spawnSync(command, argv, { cwd: repoRoot, encoding: "utf8", timeout: 180_000 });
  if (proc.status !== 0) {
    throw new Error(`@arggon/lib build failed: ${proc.stderr?.slice(-500) ?? ""}`);
  }
}

function scenarioNativeTools(): void {
  scenario("native tools (W2): every arggon tool runs in Code Mode with contract-shaped results");
  try {
    ensureKernelBuilt();
  } catch (error) {
    check("@arggon/lib builds (needed by the native tools)", false, String(error));
    return;
  }
  const f = new Fixture("native-tools");
  f.bootstrap();
  const init = f.init();
  check("init exits 0", init.status === 0, runTail(init));
  check("init bundles the plugin", existsSync(f.path(PLUGIN_DEST)));
  const item = f.createTaskChain();
  if (item === undefined) {
    check("fixture item created", false, "create chain failed");
    return;
  }
  f.linkKernel();
  check(
    "workspace kernel linked into the fixture",
    existsSync(f.path("node_modules/@arggon/lib/package.json")),
  );

  const prompt = [
    "Use the execute tool with exactly this code:",
    nativeToolsScript(item.story, item.id),
    "If the tool is not found, run the same code once more (the tool catalog can lag server startup).",
    "Reply with only the raw JSON result.",
  ].join("\n");
  const session = f.opencode(prompt);
  f.saveTranscript("native-tools", session);
  check("session succeeds", session.status === 0, runTail(session));
  check("plugin loads in the runtime", pluginLoaded(session), runTail(session));
  check(
    "plugin logs the 12-tool registration with the namespace description",
    session.stderr.includes(
      '[arggon] tools: registered 12 native arggon tools (namespace="arggon":',
    ),
    runTail(session),
  );

  const result = executeJson(session.stdout, "tools.arggon.list");
  check("model executed the native tool script", result !== undefined, runTail(session));
  if (result === undefined) return;
  const out = (result.out ?? {}) as Record<string, Record<string, unknown>>;

  const contractFailures = NATIVE_TOOLS_OK.filter(([key, command]) => {
    const envelope = out[key];
    return (
      envelope?.ok !== true ||
      envelope.command !== command ||
      envelope.schemaVersion !== 1 ||
      typeof envelope.conventionVersion !== "number"
    );
  }).map(([key]) => key);
  check(
    "every tool returned its contract envelope (ok/schemaVersion/conventionVersion/command)",
    contractFailures.length === 0,
    `non-conforming: ${contractFailures.join(", ") || "none"}`,
  );

  const created = (out.create?.item ?? {}) as Record<string, unknown>;
  const updated = (out.update?.item ?? {}) as Record<string, unknown>;
  check(
    "create → update round-trip through the tools",
    created.id === "task-native-smoke-task" && updated.status === "in_progress",
    `created=${String(created.id)} status=${String(updated.status)}`,
  );
  const comment = (out.comment?.comment ?? {}) as Record<string, unknown>;
  const handoff = (out.handoff?.handoff ?? {}) as Record<string, unknown>;
  check(
    "comment/handoff default their author to the calling session id",
    typeof comment.author === "string" &&
      comment.author.startsWith("ses_") &&
      handoff.next === "continue native smoke",
    `author=${String(comment.author)} next=${String(handoff.next)}`,
  );

  const syncError = String(result.syncError ?? "");
  const importError = String(result.importError ?? "");
  check(
    "sync/import_issues surface as typed tool errors (code + envelope), not a broken session",
    syncError.startsWith("SYNC_FAILED: ") &&
      syncError.includes('"command":"sync"') &&
      importError.startsWith("IMPORT_FAILED: ") &&
      importError.includes('"command":"import-issues"'),
    `${syncError.slice(0, 120)}\n${importError.slice(0, 120)}`,
  );

  const search = (result.search ?? {}) as {
    items?: Array<{ path?: unknown }>;
    remaining?: unknown;
  };
  const paths = (search.items ?? []).map((entry) => entry.path).sort();
  const expectedPaths = NATIVE_TOOL_NAMES.map((name) => `tools.arggon.${name}`).sort();
  check(
    "the namespace appears in the Code Mode catalog with all twelve tools (search)",
    JSON.stringify(paths) === JSON.stringify(expectedPaths) && search.remaining === 0,
    JSON.stringify(paths),
  );

  // The writes landed in the tracker: the session's own tool calls are
  // observable through the CLI (same kernel, same tree).
  const shown = f.cli(["show", "task-native-smoke-task", "--body", "--json"]);
  const body = (() => {
    try {
      return String((JSON.parse(shown.stdout) as { body?: unknown }).body ?? "");
    } catch {
      return "";
    }
  })();
  check(
    "tool writes persist in the tracker (comment + handoff in the item body)",
    shown.status === 0 &&
      body.includes("native smoke comment") &&
      body.includes("continue native smoke"),
    runTail(shown),
  );
}

// ---------------------------------------------------------------------------
// W3 — session context
// ---------------------------------------------------------------------------

function scenarioContextBranch(): void {
  scenario("context: claimed item on feat/<id> injects the bounded block and renames the session");
  const { fixture: f, item } = claimedItemFixture("context-branch");
  if (item === undefined) {
    check("fixture item created", false, "create chain failed");
    return;
  }
  f.git(["checkout", "-q", "-b", `feat/${item.id}`]);
  const session = f.opencode("Reply with only the work item id shown in your system context.");
  f.saveTranscript("context-branch", session);
  const injections = contextInjections(session.stderr);
  const forItem = injections.filter((entry) => entry.id === item.id);
  check(
    `item block injected for ${item.id} within ${CONTEXT_BLOCK_MAX_BYTES} bytes`,
    forItem.some((entry) => entry.bytes > 0 && entry.bytes <= CONTEXT_BLOCK_MAX_BYTES),
    `${injectionDetail(forItem)}\n${runTail(session)}`,
  );
  check(
    "logged block text independently measures to the reported size",
    forItem.length > 0 && forItem.every((entry) => injectionMeasuredWithin(entry)),
    `${injectionDetail(forItem)}\n${runTail(session)}`,
  );
  check(
    "model echoed the injected item id (block reached the model)",
    textContains(session.stdout, item.id),
    runTail(session),
  );
  check("plugin logged the session rename", renameLogged(session.stderr, item.id), runTail(session));
  check(
    "session title persisted by the server as the item id",
    f.sessionTitles().includes(item.id),
    JSON.stringify(f.sessionTitles()),
  );
}

function scenarioContextStorage(): void {
  scenario("context: observed arggon_show call correlates the item on a non-matching branch");
  const { fixture: f, item } = claimedItemFixture("context-storage");
  if (item === undefined) {
    check("fixture item created", false, "create chain failed");
    return;
  }
  f.git(["checkout", "-q", "-b", "smoke-base"]);
  const session = f.opencode(
    [
      "Use the execute tool with exactly this code:",
      `return await tools.arggon.arggon_show({ id: "${item.id}" })`,
      "If the tool is not found, run the same code once more (the tool catalog can lag server startup).",
      "Then reply with only the work item id that appears in your system context.",
    ].join("\n"),
  );
  f.saveTranscript("context-storage", session);
  check("branch does not match feat/fix", f.git(["branch", "--show-current"]).stdout.trim() === "smoke-base");
  const injections = contextInjections(session.stderr);
  const forItem = injections.filter((entry) => entry.id === item.id);
  check(
    `item block injected for ${item.id} after the observed call`,
    forItem.some((entry) => entry.bytes > 0 && entry.bytes <= CONTEXT_BLOCK_MAX_BYTES),
    `${injectionDetail(forItem)}\n${runTail(session)}`,
  );
  check(
    "logged block text independently measures to the reported size",
    forItem.length > 0 && forItem.every((entry) => injectionMeasuredWithin(entry)),
    `${injectionDetail(forItem)}\n${runTail(session)}`,
  );
  check(
    "model echoed the injected item id (storage map reached the model)",
    textContains(session.stdout, item.id),
    runTail(session),
  );
}

function scenarioContextEnv(): void {
  scenario("context: ARGON_ITEM resolves with no branch match");
  const f = new Fixture("context-env");
  f.bootstrap();
  const init = f.init();
  check("init exits 0", init.status === 0, runTail(init));
  const item = f.createTaskChain();
  if (item === undefined) {
    check("fixture item created", false, "create chain failed");
    return;
  }
  f.git(["checkout", "-q", "-b", "smoke-base"]);
  const session = f.opencode("Reply with only the work item id shown in your system context.", {
    ARGON_ITEM: item.id,
  });
  f.saveTranscript("context-env", session);
  const injections = contextInjections(session.stderr);
  const forItem = injections.filter((entry) => entry.id === item.id);
  check(
    `item block injected for ${item.id} from the env override`,
    forItem.some((entry) => entry.bytes > 0 && entry.bytes <= CONTEXT_BLOCK_MAX_BYTES),
    `${injectionDetail(forItem)}\n${runTail(session)}`,
  );
  check(
    "logged block text independently measures to the reported size",
    forItem.length > 0 && forItem.every((entry) => injectionMeasuredWithin(entry)),
    `${injectionDetail(forItem)}\n${runTail(session)}`,
  );
  check(
    "model echoed the injected item id (env override reached the model)",
    textContains(session.stdout, item.id),
    runTail(session),
  );
}

function scenarioContextSilent(): void {
  scenario("context: nothing resolves (tracker present, no claim/branch/env/observed call) is silent");
  const f = new Fixture("context-silent");
  f.bootstrap();
  f.init();
  const item = f.createTaskChain();
  check("fixture item created (left unclaimed)", item !== undefined);
  f.git(["checkout", "-q", "-b", "smoke-base"]);
  const session = f.opencode("Reply with exactly: SILENT_OK");
  f.saveTranscript("context-silent", session);
  check(
    "session still succeeds",
    session.status === 0 && textContains(session.stdout, "SILENT_OK"),
    runTail(session),
  );
  check("plugin loads in the runtime", pluginLoaded(session), runTail(session));
  check("no item context injected", contextInjections(session.stderr).length === 0, runTail(session));
}

function scenarioContextOutside(): void {
  scenario("context: outside ArggonManager trees (no tracker root) the session context is silent");
  const f = new Fixture("context-outside");
  f.bootstrap();
  f.copyPlugin();
  check("plugin copied into the fixture", existsSync(f.path(PLUGIN_DEST)));
  const session = f.opencode("Reply with exactly: OUTSIDE_OK");
  f.saveTranscript("context-outside", session);
  check(
    "session still succeeds",
    session.status === 0 && textContains(session.stdout, "OUTSIDE_OK"),
    runTail(session),
  );
  check("plugin loads in the runtime", pluginLoaded(session), runTail(session));
  check("no item context injected", contextInjections(session.stderr).length === 0, runTail(session));
}

function scenarioHygiene(): void {
  scenario("hygiene: failing validate after an agent git commit logs a warning, never blocks");
  const f = new Fixture("hygiene");
  f.bootstrap();
  f.init();
  const item = f.createTaskChain();
  if (item === undefined) {
    check("fixture item created", false, "create chain failed");
    return;
  }
  f.write(
    `${item.directory}/task-smoke-bad.md`,
    '---\ntype: task\nstatus: nope\nid: task-smoke-bad\ntitle: "Bad state"\nparent: smoke-story\n---\n\nbroken on purpose\n',
  );
  const session = f.opencode(
    'Run the shell command: git add -A && git commit -m "hygiene check" --no-verify. Then reply with exactly: HYGIENE_OK',
  );
  f.saveTranscript("hygiene", session);
  check(
    "session succeeds (warning is not blocking)",
    session.status === 0 && textContains(session.stdout, "HYGIENE_OK"),
    runTail(session),
  );
  check("the commit ran", f.headCommitSubject() === "hygiene check", runTail(session));
  check(
    "validate warning logged after the commit",
    session.stderr.includes("[arggon] validate failed after git commit:"),
    runTail(session),
  );
}

function main(): void {
  console.log("smoke:opencode — OpenCode V2 plugin harness (W2 + W3)");
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
  scenarioNativeTools();
  scenarioContextBranch();
  scenarioContextStorage();
  scenarioContextEnv();
  scenarioContextSilent();
  scenarioContextOutside();
  scenarioHygiene();

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
