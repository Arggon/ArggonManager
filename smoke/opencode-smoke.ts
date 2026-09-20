#!/usr/bin/env node
/**
 * OpenCode V2 smoke harness (plan-opencode2-009 T8 W2 + T9–T10 W3).
 *
 * Boots throwaway fixture repos, runs a real headless `opencode run`
 * (standalone server, JSON transcript + runtime logs) and asserts the bundled
 * plugin behavior end to end:
 *
 *   W3 — seam without MCP + the vendored bundle (task-native-commands-seam):
 *   1. fresh init      — the generated seam carries NO MCP stanza and the
 *                        vendored single-file plugin loads in a dependency-less
 *                        fixture (no `node_modules`), registering the fifteen
 *                        native tools with the kernel inlined; the model
 *                        executes `tools.arggon.next({})` in Code Mode.
 *   2. adopter config  — init writes no `opencode.jsonc`; the plugin alone
 *                        registers the native tools and the model uses them.
 *   3. never clobber   — a pre-existing `arggon` MCP server configured by the
 *                        adopter keeps running (sentinel marker) and the config
 *                        bytes are untouched.
 *   4. failure isolation — a broken sibling plugin is logged and ignored: the
 *                        session, the healthy arggon plugin and the CLI all
 *                        keep working.
 *   5. plugin absent   — the CLI is unaffected without the plugin (and no MCP
 *                        server is configured by default anymore).
 *   6. native tools    — one headless session calls all twelve kernel tools
 *                        (contract envelopes, create→update round-trip, the two
 *                        GitHub-dependent tools failing as typed errors while
 *                        the session continues) and finds the namespace in the
 *                        Code Mode catalog via `search` (all fifteen tools).
 *
 *   W4 — permissions, worktrees and lifecycle (task-native-permissions-worktrees):
 *  14. worktree lifecycle — a headless claim → worktree → commit → (stubbed) PR
 *                        → done → cleanup round-trip through the native tools:
 *                        `tools.arggon.start` creates `../<repo>-<id>` through
 *                        the OpenCode worktree domain and records branch +
 *                        worktree_path inside the worktree (the canonical
 *                        checkout stays untouched), the harness commits and
 *                        merges (the `gh` PR step is stubbed), then
 *                        `tools.arggon.cleanup({ prune: true })` removes the
 *                        worktree through the domain, deletes the merged branch
 *                        and clears the record in one tracker commit.
 *  15. invariants       — never-steal and no-reopen hold with the generated
 *                        permissions active (a real `arggon-worker` session):
 *                        the kernel refuses both through the native tools and
 *                        the session continues.
 *  16. permissions      — the shipped agent permissions load and stay
 *                        effective (reviewer: `arggon.update` hidden, `git push`
 *                        denied) without breaking ordinary sessions.
 *   7. commands        — one bounded headless session PER native command
 *                        (eleven), each expanded from the shipped
 *                        `.opencode/commands/arggon-*.md` body: the command
 *                        drives the native tools / writes the methodology
 *                        artifact and never shells out to the adapter. The
 *                        harness submits the BODY as a prompt, so the V2
 *                        command loader (discovery, frontmatter `agent:` /
 *                        `subagent:` selection) is not exercised here; the
 *                        generated frontmatter is validated by
 *                        `cli/src/init-opencode.test.ts`.
 *
 *   W3 — session context:
 *   8. branch          — a claimed item on `feat/<id>` resolves, injects the
 *                        bounded item block (the smoke measures the logged
 *                        block text itself, not the reported count) and
 *                        renames the session.
 *   9. storage map     — an observed native `tools.arggon.show` call on a
 *                        non-matching branch correlates the item for the next
 *                        model call (W3 correlation without MCP).
 *  10. env override    — `ARGON_ITEM` resolves with no branch match.
 *  11. nothing resolves — tracker present, no claim/branch/env/observed call:
 *                        the hook is silent.
 *  12. outside trees   — no tracker root: silent, session unaffected.
 *  13. hygiene         — a shell `git commit` with a broken tracker item logs
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
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "cli/src/cli.ts");
const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");
// W3: init vendors the committed single-file bundle (plugin + @arggon/lib
// inlined), not the source; the fixture needs no `node_modules`.
const PLUGIN_SOURCE = join(repoRoot, "opencode/plugins/arggon/index.bundle.ts");
const PLUGIN_DEST = ".opencode/plugins/arggon/index.ts";
const PLUGIN_MARKER = `// arggon:generated template="opencode/plugins/arggon/index.bundle.ts"`;
const NATIVE_TOOL_CODE = "return await tools.arggon.next({})";
const MODEL = process.env.OPENCODE_SMOKE_MODEL ?? "opencode-go/deepseek-v4-flash";
const TIMEOUT_MS = Number(process.env.OPENCODE_SMOKE_TIMEOUT_MS ?? 240_000);
// Mirrors ITEM_BLOCK_MAX_BYTES in the plugin source; asserted in unit tests.
// The smoke measures the logged block text itself instead of trusting the
// byte count the plugin reports (F8).
const CONTEXT_BLOCK_MAX_BYTES = 1024;
// Command sessions run a full command body; the default 240 s budget proved
// tight for the methodology commands (a timeout kills the session mid-flight
// even after the artifact is written).
const COMMAND_TIMEOUT_MS = Number(process.env.OPENCODE_SMOKE_COMMAND_TIMEOUT_MS ?? 420_000);

const TOOL_PROMPT = [
  "Use the execute tool with exactly this code:",
  NATIVE_TOOL_CODE,
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

  private run(
    command: string,
    args: string[],
    overrides?: NodeJS.ProcessEnv,
    timeoutMs: number = TIMEOUT_MS,
  ): RunResult {
    const proc = spawnSync(command, args, {
      cwd: this.dir,
      env: this.env(overrides),
      encoding: "utf8",
      timeout: timeoutMs,
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

  /** Copy the committed single-file plugin bundle into the fixture (no init). */
  copyPlugin(): void {
    this.write(PLUGIN_DEST, readFileSync(PLUGIN_SOURCE, "utf8"));
  }

  /** The shipped command body with `$ARGUMENTS` expanded (headless run). */
  commandPrompt(name: string, args: string, tail: string): string {
    const raw = this.read(`.opencode/commands/arggon-${name}.md`);
    const body = raw.replace(/^---[\s\S]*?\n---\n/, "").trim();
    return `${body.replaceAll("$ARGUMENTS", args).trim()}\n\n${tail}`;
  }

  private json(result: RunResult): Record<string, unknown> | undefined {
    try {
      return JSON.parse(result.stdout) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  itemId(result: RunResult): string | undefined {
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

  opencode(
    message: string,
    overrides?: NodeJS.ProcessEnv,
    timeoutMs?: number,
    agent?: string,
  ): RunResult {
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
        ...(agent === undefined ? [] : ["--agent", agent]),
        message,
      ],
      overrides,
      timeoutMs,
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

  /** Deterministic item worktree path (`../<repo>-<id>`, the start convention). */
  worktreePath(id: string): string {
    return join(dirname(this.dir), `${basename(this.dir)}-${id}`);
  }

  /** Frontmatter status of an item in this fixture (or a worktree copy). */
  itemStatus(directory: string, id: string, root = this.dir): string | undefined {
    try {
      const raw = readFileSync(join(root, ...directory.split("/"), `${id}.md`), "utf8");
      return /^status:\s*(\S+)\s*$/m.exec(raw)?.[1];
    } catch {
      return undefined;
    }
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

/** Completed Code Mode calls that ran the native `next` tool successfully. */
function successfulArggonNext(stdout: string): boolean {
  return parseTranscript(stdout).some((event) => {
    if (event.type !== "tool_use" || event.part?.tool !== "execute") return false;
    const state = event.part.state;
    if (state?.status !== "completed") return false;
    if (!(state.input?.code ?? "").includes("tools.arggon.next")) return false;
    const output = state.output ?? "";
    return output.includes('"ok": true') && output.includes('"command": "next"');
  });
}

/** True when a completed Code Mode call's code contains `needle`. */
function executedCode(stdout: string, needle: string): boolean {
  return parseTranscript(stdout).some((event) => {
    if (event.type !== "tool_use" || event.part?.tool !== "execute") return false;
    const state = event.part.state;
    return state?.status === "completed" && (state.input?.code ?? "").includes(needle);
  });
}

/**
 * True when a completed Code Mode call invokes one native tool, accepting both
 * spellings a model produces: `tools.arggon.<name>(…)` and
 * `tools.arggon["<name>"](…)` (observed in the bounded command sessions).
 */
function executedTool(stdout: string, name: string): boolean {
  const patterns = [`tools.arggon.${name}`, `tools.arggon["${name}"]`, `tools.arggon['${name}']`];
  return parseTranscript(stdout).some((event) => {
    if (event.type !== "tool_use" || event.part?.tool !== "execute") return false;
    const state = event.part.state;
    if (state?.status !== "completed") return false;
    const code = state.input?.code ?? "";
    return patterns.some((pattern) => code.includes(pattern));
  });
}

/**
 * Command sessions normally exit 0. On 2.0.10 the runtime can log
 * `InterruptError: All fibers interrupted without error` during shutdown and
 * exit non-zero AFTER the model finished (observed once on /explore, after the
 * artifact was written and the end marker emitted); accept that shape so a
 * runtime shutdown artifact is not reported as a command failure.
 */
function sessionCompleted(result: RunResult, name: string): boolean {
  return result.status === 0 || textContains(result.stdout, `CMD_${name.toUpperCase()}_OK`);
}

/** True when the transcript carries at least one assistant text/tool event. */
function hasModelOutput(stdout: string): boolean {
  return parseTranscript(stdout).some((event) => event.type === "text" || event.type === "tool_use");
}

/**
 * Run one bounded command session, retrying ONCE when the standalone runtime
 * aborted the session before any model output (`InterruptError: All fibers
 * interrupted without error` right after `step_start`, observed sporadically
 * on 2.0.10 while many short standalone servers run back to back). A session
 * with real output is never retried.
 */
function runCommandSession(f: Fixture, prompt: string, label: string): RunResult {
  const first = f.opencode(prompt, undefined, COMMAND_TIMEOUT_MS);
  if (hasModelOutput(first.stdout)) return first;
  console.log(`  retry ${label}: the runtime aborted the session before any model output`);
  return f.opencode(prompt, undefined, COMMAND_TIMEOUT_MS);
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
  scenario("fresh init: seam without MCP + dependency-less bundle registers the native tools");
  const f = new Fixture("fresh");
  const init = f.init();
  check("init exits 0", init.status === 0, runTail(init));
  check("init vendors the plugin", existsSync(f.path(PLUGIN_DEST)));
  if (existsSync(f.path(PLUGIN_DEST))) {
    check(
      "vendored plugin starts with the // provenance marker",
      f.read(PLUGIN_DEST).startsWith(`${PLUGIN_MARKER}\n`),
    );
    check(
      "vendored plugin is the single-file bundle with the kernel inlined",
      f.read(PLUGIN_DEST).includes('__arggonModules.set("lib/src/index.ts"'),
    );
  }
  const config = f.read("opencode.jsonc");
  check(
    "generated config has no MCP stanza (W3 seam)",
    !config.includes('"mcp"') && !config.includes('"arggon", "mcp"'),
  );
  check(
    "fixture has no node_modules (dependency-less adopter shape)",
    !existsSync(f.path("node_modules")),
  );
  const session = f.opencode(TOOL_PROMPT);
  f.saveTranscript("fresh-init", session);
  check("session runs in the fixture project", session.stderr.includes(`directory=${f.dir}`), runTail(session));
  check("plugin loads in the runtime", pluginLoaded(session), runTail(session));
  check(
    "native tools register from the inlined kernel (12)",
    session.stderr.includes('[arggon] tools: registered 15 native arggon tools (namespace="arggon":'),
    runTail(session),
  );
  check("no MCP server is registered by default", !mcpConnected(session), runTail(session));
  check("model executed the native next tool successfully", successfulArggonNext(session.stdout), runTail(session));
}

function scenarioAdopterConfig(): void {
  scenario("adopter config: plugin registers the native tools without opencode.jsonc");
  const f = new Fixture("adopter");
  f.write("opencode.json", '{\n  "$schema": "https://opencode.ai/config.json"\n}\n');
  const init = f.init();
  check("init exits 0", init.status === 0, runTail(init));
  check("no opencode.jsonc written over the adopter config", !existsSync(f.path("opencode.jsonc")));
  const session = f.opencode(TOOL_PROMPT);
  f.saveTranscript("adopter-config", session);
  check("plugin loads in the runtime", pluginLoaded(session), runTail(session));
  check(
    "plugin registers the fifteen native tools with no config entry",
    session.stderr.includes('[arggon] tools: registered 15 native arggon tools (namespace="arggon":'),
    runTail(session),
  );
  check("model executed the native next tool successfully", successfulArggonNext(session.stdout), runTail(session));
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
  check(
    "native tools still register alongside the adopter MCP server",
    session.stderr.includes('[arggon] tools: registered 15 native arggon tools (namespace="arggon":'),
    runTail(session),
  );
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
  check(
    "healthy arggon plugin still registers the native tools",
    session.stderr.includes('[arggon] tools: registered 15 native arggon tools (namespace="arggon":'),
    runTail(session),
  );
  const next = f.cli(["next", "--json"]);
  check("CLI unaffected", next.status === 0 && next.stdout.includes('"ok":true'), runTail(next));
}

function scenarioPluginAbsent(): void {
  scenario("plugin absent: the CLI keeps working (no MCP configured by default)");
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
  check("no MCP server connects without the plugin (W3 default)", !mcpConnected(session), runTail(session));
  const next = f.cli(["next", "--json"]);
  check("CLI unaffected without the plugin", next.status === 0 && next.stdout.includes('"ok":true'), runTail(next));
}

// ---------------------------------------------------------------------------
// Native-first W2 — the `arggon` tool namespace (task-native-tools)
// ---------------------------------------------------------------------------

/** The fifteen native tools (spec-native-first-011 §Tools + W4 worktree domain). */
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
  "start",
  "branch",
  "cleanup",
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

function scenarioNativeTools(): void {
  scenario("native tools (W3): every arggon tool runs in Code Mode from the dependency-less bundle");
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
  check(
    "fixture stays dependency-less (kernel inlined in the bundle)",
    !existsSync(f.path("node_modules")),
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
      '[arggon] tools: registered 15 native arggon tools (namespace="arggon":',
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
    "the namespace appears in the Code Mode catalog with all fifteen tools (search)",
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
  scenario("context: observed native show call correlates the item on a non-matching branch (W3)");
  const { fixture: f, item } = claimedItemFixture("context-storage");
  if (item === undefined) {
    check("fixture item created", false, "create chain failed");
    return;
  }
  f.git(["checkout", "-q", "-b", "smoke-base"]);
  const session = f.opencode(
    [
      "Use the execute tool with exactly this code:",
      `return await tools.arggon.show({ id: "${item.id}" })`,
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

// ---------------------------------------------------------------------------
// W3 — one bounded headless scenario per native command
// ---------------------------------------------------------------------------

/** The eleven native commands (spec-native-first-011 §Commands). */
const COMMAND_NAMES = [
  "next",
  "start",
  "done",
  "handoff",
  "review",
  "status",
  "spec",
  "adr",
  "explore",
  "playbook",
  "adopt",
] as const;

/** Methodology artifacts a command must write (no native scaffold tool). */
function methodologyDir(name: string): string | undefined {
  switch (name) {
    case "spec":
      return "ArggonManager/docs/specs";
    case "adr":
      return "ArggonManager/docs/adr";
    case "explore":
      return "ArggonManager/docs/explorations";
    case "playbook":
      return "ArggonManager/docs/playbooks";
    default:
      return undefined;
  }
}

/**
 * Bounded harness note: the smoke runs the shipped command body but keeps the
 * session deterministic — no skill loads, no repo exploration, no project test
 * suites — and asks for a visible end marker the checks assert on.
 */
const HARNESS_NOTE =
  "Harness note: this is a bounded smoke session — do not load the skill, do not " +
  "explore the repository and do not run unrelated shell commands; use the native " +
  "`tools.arggon.*` tools (git only where a step requires it), do exactly the " +
  "step(s) above, then reply with exactly:";

/** $ARGUMENTS value + bounded tail per command (the shipped body is what runs). */
function commandCase(name: string, itemId: string): { args: string; tail: string } {
  switch (name) {
    case "next":
      return { args: "", tail: "Report the item id only." };
    case "start":
      return {
        args: itemId,
        tail: `Claim ${itemId} and create its worktree with tools.arggon.start({ id: "${itemId}", assignee: "smoke" }); skip the skill load, the session move, the push and the PR steps.`,
      };
    case "done":
      return {
        args: itemId,
        tail: "Assume the PR is merged and the gates pass; flip the item to done. Do not run the project test suite.",
      };
    case "handoff":
      return { args: itemId, tail: 'Use next "continue the smoke run"; skip everything else.' };
    case "review":
      return {
        args: `the changes of ${itemId} in the working tree`,
        tail: "Post a one-line verdict comment on the item (state merge or no-merge). Do not run the project test suite.",
      };
    case "status":
      return { args: "", tail: "Report the counts only." };
    case "spec":
      return {
        args: "smoke command coverage",
        tail: "Write the spec file and stop before any plan.",
      };
    case "adr":
      return { args: "smoke command coverage", tail: "Write the ADR file as Proposed and stop." };
    case "explore":
      return {
        args: "smoke command coverage",
        tail: "Write the exploration file and stop; do NOT create or update any tracker item.",
      };
    case "playbook":
      return {
        args: "smoke",
        tail: "Write the playbook file (structure only, no web research) with a pinned version and stop.",
      };
    case "adopt":
      return {
        args: "",
        tail: "The bootstrap init has already run: skip step 1 and file the adoption task only. Do not run npx.",
      };
    default:
      return { args: "", tail: "" };
  }
}

function envelopeOf(result: RunResult): Record<string, unknown> | undefined {
  try {
    return JSON.parse(result.stdout) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function itemStatus(result: RunResult): string | undefined {
  const item = envelopeOf(result)?.item as { status?: unknown } | undefined;
  return typeof item?.status === "string" ? item.status : undefined;
}

function itemBody(result: RunResult): string {
  const body = envelopeOf(result)?.body;
  return typeof body === "string" ? body : "";
}

function scenarioCommands(only?: string): void {
  scenario("commands (W3): one bounded headless session per native command");
  const names = only === undefined ? COMMAND_NAMES : COMMAND_NAMES.filter((name) => name === only);
  for (const name of names) {
    const f = new Fixture(`cmd-${name}`);
    f.bootstrap();
    const init = f.init();
    if (init.status !== 0) {
      check(`/${name}: init exits 0`, false, runTail(init));
      continue;
    }
    const item = f.createTaskChain();
    if (item === undefined) {
      check(`/${name}: fixture item created`, false, "create chain failed");
      continue;
    }
    // Claimed item for the lifecycle commands (done needs a legal transition).
    if (name === "done" || name === "handoff" || name === "review") {
      f.claim(item.id);
    }
    const c = commandCase(name, item.id);
    const session = runCommandSession(
      f,
      f.commandPrompt(name, c.args, `${c.tail} ${HARNESS_NOTE} CMD_${name.toUpperCase()}_OK`),
      `/${name}`,
    );
    f.saveTranscript(`command-${name}`, session);
    const label = `/${name}`;
    check(`${label}: session completes`, sessionCompleted(session, name), runTail(session));
    check(`${label}: plugin loads in the runtime`, pluginLoaded(session), runTail(session));
    const dir = methodologyDir(name);
    if (dir !== undefined) {
      const abs = f.path(dir);
      const files = existsSync(abs)
        ? readdirSync(abs).filter((entry) => entry.endsWith(".md"))
        : [];
      check(
        `${label}: writes a methodology artifact under ${dir}/`,
        files.length > 0,
        `files: ${files.join(", ") || "none"}`,
      );
    } else if (name === "start") {
      // W4: /arggon-start drives the native start tool — claim + branch +
      // worktree are recorded inside the worktree copy; the canonical checkout
      // stays untouched.
      const worktree = f.worktreePath(item.id);
      check(
        `${label}: claims and creates the worktree through the native start tool`,
        executedTool(session.stdout, "start") &&
          existsSync(worktree) &&
          f.itemStatus(item.directory, item.id, worktree) === "in_progress",
        `worktree=${worktree} status=${f.itemStatus(item.directory, item.id, worktree) ?? "?"}`,
      );
    } else if (name === "done") {
      const shown = f.cli(["show", item.id, "--meta", "--json"]);
      check(
        `${label}: flips the item to done through the native update tool`,
        itemStatus(shown) === "done" && executedTool(session.stdout, "update"),
        `status=${itemStatus(shown) ?? "?"}`,
      );
    } else if (name === "handoff") {
      const shown = f.cli(["show", item.id, "--body", "--json"]);
      check(
        `${label}: appends the handoff through the native tool`,
        itemBody(shown).includes("continue the smoke run") &&
          executedTool(session.stdout, "handoff"),
        runTail(session),
      );
    } else if (name === "review") {
      const shown = f.cli(["show", item.id, "--body", "--json"]);
      check(
        `${label}: posts the verdict on the item`,
        executedTool(session.stdout, "comment") && itemBody(shown).includes("###"),
        runTail(session),
      );
    } else if (name === "adopt") {
      const listed = f.cli(["list", "--json"]);
      check(
        `${label}: files the tracked adoption task through the native tool`,
        listed.stdout.includes("Adopt ArggonManager") && executedTool(session.stdout, "create"),
        runTail(session),
      );
    } else {
      check(
        `${label}: drives the native tools`,
        executedCode(session.stdout, "tools.arggon."),
        runTail(session),
      );
    }
  }
}


// ---------------------------------------------------------------------------
// W4 — worktree lifecycle, invariants and permissions
// ---------------------------------------------------------------------------

/** True when a completed shell call for `needle` failed with a permission denial. */
function shellDenied(stdout: string, needle: string): boolean {
  return parseTranscript(stdout).some((event) => {
    if (event.type !== "tool_use" || event.part?.tool !== "shell") return false;
    const state = event.part.state;
    const input = state?.input as { command?: unknown } | undefined;
    if (state?.status !== "error") return false;
    if (typeof input?.command !== "string" || !input.command.includes(needle)) return false;
    return (state.output ?? "").includes("Permission denied");
  });
}

/** True when a completed shell call for `needle` succeeded. */
function shellCompleted(stdout: string, needle: string): boolean {
  return parseTranscript(stdout).some((event) => {
    if (event.type !== "tool_use" || event.part?.tool !== "shell") return false;
    const state = event.part.state;
    const input = state?.input as { command?: unknown } | undefined;
    return (
      state?.status === "completed" &&
      typeof input?.command === "string" &&
      input.command.includes(needle)
    );
  });
}

/**
 * W4 acceptance 1: headless claim → worktree → commit → (stubbed) PR → done →
 * cleanup through the native tools. The worktree is created by the OpenCode
 * worktree domain (`ctx.worktree.create`, name `<repo>-<id>`, parent
 * `../<repo>-<id>`), the harness performs the git commit and the merge that
 * stands in for the `gh` PR step, and `tools.arggon.cleanup({ prune: true })`
 * reaps the merged worktree through the domain.
 */
function scenarioWorktreeLifecycle(): void {
  scenario("worktree lifecycle (W4): claim → worktree → commit → stubbed PR → done → cleanup");
  const f = new Fixture("lifecycle");
  f.bootstrap();
  const init = f.init();
  check("init exits 0", init.status === 0, runTail(init));
  const item = f.createTaskChain();
  if (item === undefined) {
    check("fixture item created", false, "create chain failed");
    return;
  }
  check(
    "generated seam carries the W4 permission gates (permissions active)",
    f.read("opencode.jsonc").includes('"git push --force*"'),
  );

  const startSession = f.opencode(
    [
      "Use the execute tool with exactly this code:",
      `return await tools.arggon.start({ id: "${item.id}", assignee: "smoke" })`,
      "If the tool is not found, run the same code once more (the tool catalog can lag server startup).",
      "Reply with only the raw JSON result.",
    ].join("\n"),
  );
  f.saveTranscript("worktree-lifecycle-start", startSession);
  check("start session succeeds", startSession.status === 0, runTail(startSession));
  check("plugin loads in the runtime", pluginLoaded(startSession), runTail(startSession));
  const started = executeJson(startSession.stdout, "tools.arggon.start");
  check("model executed the native start tool", started !== undefined, runTail(startSession));
  if (started === undefined) return;
  const worktreePath = String(started.worktreePath ?? "");
  check(
    "start envelope carries the claim, branch and worktree",
    started.ok === true &&
      started.command === "start" &&
      started.branch === `feat/${item.id}` &&
      worktreePath.length > 0,
    JSON.stringify(started).slice(0, 400),
  );
  check(
    "worktree created at ../<repo>-<id> through the domain",
    worktreePath === f.worktreePath(item.id) && existsSync(worktreePath),
    `path=${worktreePath}`,
  );
  check(
    "branch checked out inside the worktree",
    f.git(["-C", worktreePath, "branch", "--show-current"]).stdout.trim() === `feat/${item.id}`,
    f.git(["-C", worktreePath, "branch", "--show-current"]).stdout.trim(),
  );
  check(
    "claim commit landed on the feature branch",
    f.git(["-C", worktreePath, "log", "-1", "--pretty=%s"]).stdout.trim() ===
      `chore(tasks): claimed ${item.id}`,
    f.git(["-C", worktreePath, "log", "-1", "--pretty=%s"]).stdout.trim(),
  );
  check(
    "claim + records live in the worktree copy",
    f.itemStatus(item.directory, item.id, worktreePath) === "in_progress" &&
      f.read(`${item.directory}/${item.id}.md`).length > 0,
    `worktree status=${f.itemStatus(item.directory, item.id, worktreePath) ?? "?"}`,
  );
  check(
    "canonical checkout stays untouched (still todo, no records)",
    f.itemStatus(item.directory, item.id) === "todo" &&
      !readFileSync(join(f.dir, item.directory, `${item.id}.md`), "utf8").includes("worktree_path"),
    `canonical status=${f.itemStatus(item.directory, item.id) ?? "?"}`,
  );

  // The agent's work commit + the merge that stands in for the `gh` PR step.
  writeFileSync(join(worktreePath, "work.txt"), "work\n", "utf8");
  f.git(["-C", worktreePath, "add", "work.txt"]);
  f.git(["-C", worktreePath, "commit", "-qm", "feat: lifecycle work"]);
  f.git(["merge", "--no-ff", `feat/${item.id}`, "-m", "Merge PR (stubbed)"]);
  check(
    "stubbed PR merge brings the records to the canonical copy",
    f.itemStatus(item.directory, item.id) === "in_progress" &&
      readFileSync(join(f.dir, item.directory, `${item.id}.md`), "utf8").includes("worktree_path"),
    `canonical status=${f.itemStatus(item.directory, item.id) ?? "?"}`,
  );

  const closeSession = f.opencode(
    [
      "Use the execute tool with exactly this code:",
      `const done = await tools.arggon.update({ id: "${item.id}", status: "done" });`,
      "const cleanup = await tools.arggon.cleanup({ prune: true });",
      "return { done, cleanup };",
      "If the tool is not found, run the same code once more (the tool catalog can lag server startup).",
      "Reply with only the raw JSON result.",
    ].join("\n"),
  );
  f.saveTranscript("worktree-lifecycle-close", closeSession);
  check("close session succeeds", closeSession.status === 0, runTail(closeSession));
  const closed = executeJson(closeSession.stdout, "tools.arggon.cleanup");
  check("model executed the native cleanup tool", closed !== undefined, runTail(closeSession));
  if (closed === undefined) return;
  const cleanup = (closed.cleanup ?? {}) as Record<string, unknown>;
  check(
    "cleanup reports the removable candidate and the three prune actions",
    cleanup.ok === true &&
      cleanup.command === "cleanup" &&
      Array.isArray(cleanup.candidates) &&
      (cleanup.candidates as Array<Record<string, unknown>>)[0]?.removable === true &&
      JSON.stringify(cleanup.pruned).includes(`removed worktree ${worktreePath}`) &&
      JSON.stringify(cleanup.pruned).includes(`deleted branch feat/${item.id}`) &&
      JSON.stringify(cleanup.pruned).includes("cleared worktree_path"),
    JSON.stringify(cleanup).slice(0, 500),
  );
  check(
    "cleanup committed the cleared record",
    JSON.stringify(cleanup.commit ?? {}).includes(`chore(tasks): pruned ${item.id}`),
    JSON.stringify(cleanup.commit ?? {}),
  );
  check(
    "worktree removed through the domain and gone from disk",
    !existsSync(worktreePath) && !f.git(["worktree", "list"]).stdout.includes(worktreePath),
  );
  check(
    "merged branch deleted",
    f.git(["branch", "--list", `feat/${item.id}`]).stdout.trim() === "",
  );
  check(
    "item is done with worktree_path cleared",
    f.itemStatus(item.directory, item.id) === "done" &&
      !readFileSync(join(f.dir, item.directory, `${item.id}.md`), "utf8").includes("worktree_path"),
    `status=${f.itemStatus(item.directory, item.id) ?? "?"}`,
  );
}

/**
 * W4 acceptance 2: never-steal and no-reopen hold with the generated
 * permissions active. The session runs as the shipped `arggon-worker` agent
 * (its frontmatter permissions are loaded) and the kernel — not the
 * permissions — is what refuses both invariants.
 */
function scenarioInvariants(): void {
  scenario("invariants (W4): never-steal and no-reopen hold with permissions active (worker agent)");
  const f = new Fixture("invariants");
  f.bootstrap();
  const init = f.init();
  check("init exits 0", init.status === 0, runTail(init));
  const item = f.createTaskChain();
  if (item === undefined) {
    check("fixture item created", false, "create chain failed");
    return;
  }
  check("fixture item claimed by smoke", f.claim(item.id).status === 0);
  const other = f.itemId(f.cli(["create", "task", "Second item", "--parent", item.story, "--json"]));
  check("second item created", other !== undefined);
  if (other === undefined) return;
  f.claim(other);
  check("second item done", f.cli(["update", other, "--status", "done"]).status === 0);
  check(
    "generated seam + shipped worker agent carry the permissions (active)",
    f.read("opencode.jsonc").includes('"permissions"') &&
      existsSync(f.path(".opencode/agents/arggon-worker.md")),
  );

  const session = f.opencode(
    [
      "Use the execute tool with exactly this code:",
      "const out = {};",
      `try { out.steal = await tools.arggon.update({ id: "${item.id}", status: "in_progress", assignee: "intruder" }); } catch (error) { out.stealError = String((error && error.message) || error); }`,
      `try { out.startSteal = await tools.arggon.start({ id: "${item.id}", assignee: "intruder" }); } catch (error) { out.startError = String((error && error.message) || error); }`,
      `try { out.reopen = await tools.arggon.update({ id: "${other}", status: "todo" }); } catch (error) { out.reopenError = String((error && error.message) || error); }`,
      "return out;",
      "If the tool is not found, run the same code once more (the tool catalog can lag server startup).",
      "Reply with only the raw JSON result.",
    ].join("\n"),
    undefined,
    undefined,
    "arggon-worker",
  );
  f.saveTranscript("invariants", session);
  check("session succeeds as the worker agent", session.status === 0, runTail(session));
  check("plugin loads in the runtime", pluginLoaded(session), runTail(session));
  const result = executeJson(session.stdout, "tools.arggon.update");
  check("model executed the invariants script", result !== undefined, runTail(session));
  if (result === undefined) return;
  const stealError = String(result.stealError ?? "");
  const startError = String(result.startError ?? "");
  const reopenError = String(result.reopenError ?? "");
  check(
    "kernel refuses the claim steal through update (never steal)",
    stealError.includes("claim conflict") && stealError.includes("UPDATE_FAILED"),
    stealError.slice(0, 200),
  );
  check(
    "kernel refuses the claim steal through start (never steal)",
    startError.includes("claim conflict") && startError.includes("START_FAILED"),
    startError.slice(0, 200),
  );
  check(
    "kernel refuses the reopen of a done item (no reopen)",
    reopenError.includes("must not reopen") && reopenError.includes("UPDATE_FAILED"),
    reopenError.slice(0, 200),
  );
  check(
    "both invariants hold: the item states are unchanged",
    f.itemStatus(item.directory, item.id) === "in_progress" &&
      f.itemStatus(item.directory, other) === "done" &&
      !existsSync(f.worktreePath(item.id)),
    `claimed=${f.itemStatus(item.directory, item.id) ?? "?"} done=${f.itemStatus(item.directory, other) ?? "?"}`,
  );
}

/**
 * W4 acceptance 4: the shipped permission defaults load without breaking
 * ordinary sessions — and stay effective. A reviewer session reads the item
 * and runs git inspection, while `arggon.update` (denied by the reviewer's
 * frontmatter) and `git push` (denied by the reviewer's shell gates) are
 * blocked.
 */
function scenarioPermissions(): void {
  scenario("permissions (W4): the reviewer gates load and stay effective without breaking the session");
  const f = new Fixture("permissions");
  f.bootstrap();
  const init = f.init();
  check("init exits 0", init.status === 0, runTail(init));
  const item = f.createTaskChain();
  if (item === undefined) {
    check("fixture item created", false, "create chain failed");
    return;
  }
  f.claim(item.id);

  const session = f.opencode(
    [
      "Use the execute tool with exactly this code:",
      "const out = {};",
      `out.show = await tools.arggon.show({ id: "${item.id}" });`,
      `try { out.update = await tools.arggon.update({ id: "${item.id}", status: "todo" }); } catch (error) { out.updateError = String((error && error.message) || error); }`,
      "return out;",
      "Then run these two shell commands in order: `git push origin main` and `git status`.",
      "If the tool is not found, run the same code once more (the tool catalog can lag server startup).",
      "Reply with only the raw JSON result and what each shell command returned.",
    ].join("\n"),
    undefined,
    undefined,
    "arggon-reviewer",
  );
  f.saveTranscript("permissions", session);
  check("session succeeds as the reviewer agent", session.status === 0, runTail(session));
  check("plugin loads in the runtime", pluginLoaded(session), runTail(session));
  const result = executeJson(session.stdout, "tools.arggon.show");
  check("model executed the reviewer script", result !== undefined, runTail(session));
  if (result !== undefined) {
    const show = (result.show ?? {}) as Record<string, unknown>;
    check(
      "the reviewer reads the item (show allowed)",
      show.ok === true && show.command === "show",
      JSON.stringify(show).slice(0, 200),
    );
    check(
      "the reviewer cannot mutate the tracker (arggon.update denied)",
      result.update === undefined &&
        /Unknown tool|Permission denied/.test(String(result.updateError ?? "")),
      String(result.updateError ?? "").slice(0, 200),
    );
  }
  check(
    "the reviewer's shell gate denies git push (permission denied)",
    shellDenied(session.stdout, "git push") || textContains(session.stdout, "Permission denied"),
    runTail(session),
  );
  check(
    "ordinary shell inspection still runs (session not broken)",
    shellCompleted(session.stdout, "git status"),
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
  // Dev aid: OPENCODE_SMOKE_ONLY=commands re-runs just the per-command group
  // (the full harness runs every scenario by default).
  if (process.env.OPENCODE_SMOKE_ONLY === "commands") {
    scenarioCommands();
  } else if (process.env.OPENCODE_SMOKE_ONLY?.startsWith("command:")) {
    // Dev aid: re-run one command scenario, e.g. OPENCODE_SMOKE_ONLY=command:adr.
    scenarioCommands(process.env.OPENCODE_SMOKE_ONLY.slice("command:".length));
  } else if (process.env.OPENCODE_SMOKE_ONLY === "w4") {
    scenarioWorktreeLifecycle();
    scenarioInvariants();
    scenarioPermissions();
  } else {
    scenarioFreshInit();
    scenarioAdopterConfig();
    scenarioNeverClobber();
    scenarioFailureIsolation();
    scenarioPluginAbsent();
    scenarioNativeTools();
    scenarioCommands();
    scenarioContextBranch();
    scenarioContextStorage();
    scenarioContextEnv();
    scenarioContextSilent();
    scenarioContextOutside();
    scenarioHygiene();
    scenarioWorktreeLifecycle();
    scenarioInvariants();
    scenarioPermissions();
  }

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
