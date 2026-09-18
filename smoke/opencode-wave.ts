#!/usr/bin/env node
/**
 * OpenCode V2 orchestration wave harness (plan-opencode2-009 T12–T13, W4).
 *
 * Boots throwaway fixture repos with a **local bare remote** (no GitHub), runs
 * real headless `opencode run` sessions on opencode v2.0.7 and asserts the two
 * halves of W4:
 *
 *   T12 — permission probes on the generated agents:
 *   1. reviewer    — `arggon-reviewer` cannot perform an edit: the runtime
 *                    removes `edit`/`write`/`patch` from its tool catalog
 *                    (`permissions: edit * deny`) and the probe file is never
 *                    created. Read/shell stay available for the review.
 *   2. worker      — `arggon-worker` cannot launch a subagent: the `subagent`
 *                    tool is absent (nesting stays at one level).
 *   3. coordinator — `arggon-coordinator` launches `explore`, `arggon-worker`
 *                    and `arggon-reviewer` (allow-list) but `general` fails
 *                    with `Permission denied: subagent`.
 *
 *   T13 — scripted end-to-end wave, driven by one coordinator session:
 *   4. plan       — coordinator reads the tracker and plans a file-disjoint wave.
 *   5. delegate   — coordinator launches TWO `arggon-worker` subagents in ONE
 *                    message, foreground, each claiming its item via
 *                    `arggon start --worktree` and working its own worktree.
 *                    Foreground is required: a background subagent notifies the
 *                    parent later, but `opencode run` exits when the assistant
 *                    turn ends, so background children would end the headless
 *                    run before their work exists.
 *   6. review     — one `arggon-reviewer` subagent reviews both branches and
 *                    posts verdicts on the items via `arggon comment`.
 *   7. merge/done — coordinator merges both branches into the fixture main
 *                    locally (the local merge IS the merge here), ticks the
 *                    acceptance boxes and flips both items to done.
 *   8. accounting — context numbers for the run (feeds task-opencode2-context):
 *                    the injected item block measured with/without resolution
 *                    on the same agent+prompt, the real per-worker child-session
 *                    token totals (`opencode session export`), and the
 *                    coordinator's tool-call batching from the wave transcript.
 *
 * Assertions are observable outcomes: files exist with the acceptance content,
 * branches/worktrees are disjoint and pushed, verdicts and handoffs are on the
 * items, the local merges are ancestors of main, `arggon validate` is green,
 * and the tracker reads back done. Transcripts are kept under
 * `<fixture>/.wave-evidence/` (review evidence, ADR 0008 spirit).
 *
 * Bounded and cheap by design: one pinned small model, `--format json`, and
 * per-command timeouts (`OPENCODE_WAVE_TIMEOUT_MS`, default 10 min).
 * Fixtures live under OpenCode's managed temp dir (`<tmpdir>/opencode`) and
 * every run passes `--auto`: a headless run has no client to answer `ask`
 * permission prompts (e.g. a worker's sibling worktree), while configured
 * `deny` rules stay enforced — the permission probes depend on that.
 * Exit codes:
 *   0 — all checks passed, or `skipped: opencode not installed`
 *   1 — a check failed (fixtures are kept for inspection)
 *
 * Deliberately NOT part of `npm test`: CI has no `opencode` binary. Run with
 * `npm run smoke:opencode:wave`; set `ARGON_SMOKE_KEEP=1` to keep fixtures even
 * on success, `OPENCODE_WAVE_MODEL` to pick another model.
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
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "cli/src/cli.ts");
const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");
const MODEL =
  process.env.OPENCODE_WAVE_MODEL ??
  process.env.OPENCODE_SMOKE_MODEL ??
  "opencode-go/deepseek-v4-flash";
const TIMEOUT_MS = Number(process.env.OPENCODE_WAVE_TIMEOUT_MS ?? 600_000);
// Mirrors ITEM_BLOCK_MAX_BYTES in the plugin source; asserted here per call.
const CONTEXT_BLOCK_MAX_BYTES = 1024;

type RunResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

type TranscriptPart = {
  tool?: string;
  messageID?: string;
  text?: string;
  state?: {
    status?: string;
    input?: Record<string, unknown>;
    output?: string;
    error?: string;
  };
  tokens?: { input?: number; output?: number; cache?: { read?: number; write?: number } };
};
type TranscriptEvent = { type?: string; sessionID?: string; part?: TranscriptPart };

type Tokens = {
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};
type SubagentCall = {
  agent: string;
  status?: string;
  error?: string;
  output?: string;
  messageID?: string;
};
type ToolCall = { tool: string; status?: string; messageID?: string };

const failures: string[] = [];
const fixtures: Fixture[] = [];

function check(name: string, ok: boolean, detail?: string): void {
  const suffix =
    ok || detail === undefined ? "" : `\n      ${detail.split("\n").slice(0, 8).join("\n      ")}`;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${suffix}`);
  if (!ok) failures.push(name);
}

function scenario(name: string): void {
  console.log(`\n== ${name}`);
}

function info(line: string): void {
  console.log(`  --  ${line}`);
}

function opencodeAvailable(): boolean {
  const probe = spawnSync("opencode", ["--version"], { encoding: "utf8", timeout: 30_000 });
  return probe.error === undefined && probe.status === 0;
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

type WaveTask = { id: string; path: string; file: string; content: string };
type WaveChain = { story: string; alpha: WaveTask; beta: WaveTask };

class Fixture {
  readonly dir: string;
  readonly remoteDir: string;
  readonly worktreePaths: string[] = [];
  private readonly binDir: string;

  constructor(name: string) {
    // Place fixtures under OpenCode's own temp directory (`<tmpdir>/opencode`,
    // `opencode debug paths`): worktrees created as siblings then live inside
    // OpenCode's managed temp dir, so the default `external_directory: ask`
    // policy does not stall headless runs. `--auto` (below) is the second
    // guard: it approves remaining asks, never configured denies.
    const base = join(tmpdir(), "opencode");
    mkdirSync(base, { recursive: true });
    this.dir = mkdtempSync(join(base, `arggon-wave-${name}-`));
    this.remoteDir = `${this.dir}-remote.git`;
    fixtures.push(this);
    this.binDir = join(this.dir, ".wave-bin");
    mkdirSync(this.binDir, { recursive: true });
    // The generated config/plugin invokes `arggon mcp`; point that at THIS
    // checkout's CLI source instead of whatever is globally installed.
    const shim = join(this.binDir, "arggon");
    writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${tsx}" "${cli}" "$@"\n`);
    chmodSync(shim, 0o755);
  }

  private env(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    // PWD must follow cwd: OpenCode resolves the project directory from PWD.
    // ARGON_ITEM is cleared by default; the accounting scenario sets it.
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
    cwd?: string,
  ): RunResult {
    const proc = spawnSync(command, args, {
      cwd: cwd ?? this.dir,
      env: this.env(overrides),
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    return {
      status: proc.status,
      signal: proc.signal,
      stdout: proc.stdout ?? "",
      stderr: proc.stderr ?? "",
    };
  }

  cli(args: string[], cwd?: string): RunResult {
    return this.run(process.execPath, [tsx, cli, ...args], undefined, cwd);
  }

  git(args: string[], cwd?: string): RunResult {
    return this.run("git", args, undefined, cwd);
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

  /** git repo + identity + local bare remote (no GitHub). */
  bootstrap(): void {
    this.git(["init", "-q", "-b", "main"]);
    this.git(["config", "user.email", "wave@example.com"]);
    this.git(["config", "user.name", "wave-smoke"]);
    this.write(
      "package.json",
      `${JSON.stringify(
        { name: "wave-fixture", private: true, version: "0.0.0", scripts: { arggon: "arggon" } },
        null,
        2,
      )}\n`,
    );
    const bare = spawnSync("git", ["init", "-q", "--bare", "-b", "main", this.remoteDir], {
      encoding: "utf8",
    });
    if (bare.status !== 0) throw new Error(`bare remote init failed: ${bare.stderr}`);
    this.git(["remote", "add", "origin", this.remoteDir]);
  }

  init(): RunResult {
    return this.cli(["init", this.dir, "--json"]);
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
    const id =
      item !== null && typeof item === "object" ? (item as { id?: unknown }).id : undefined;
    return typeof id === "string" ? id : undefined;
  }

  /** initiative → epic → story → two file-disjoint tasks with acceptance boxes. */
  createWaveChain(): WaveChain | undefined {
    const initiative = this.itemId(this.cli(["create", "initiative", "Wave Initiative", "--json"]));
    if (initiative === undefined) return undefined;
    const epic = this.itemId(
      this.cli(["create", "epic", "Wave Epic", "--parent", initiative, "--json"]),
    );
    if (epic === undefined) return undefined;
    const story = this.itemId(
      this.cli(["create", "story", "Wave Story", "--parent", epic, "--json"]),
    );
    if (story === undefined) return undefined;
    const alpha = this.createAcceptanceTask(story, "Alpha file", "wave-alpha.txt", "alpha");
    const beta = this.createAcceptanceTask(story, "Beta file", "wave-beta.txt", "beta");
    if (alpha === undefined || beta === undefined) return undefined;
    this.git(["add", "-A"]);
    this.git(["commit", "-q", "-m", "wave fixture: tracker chain + two file-disjoint tasks"]);
    const push = this.git(["push", "-q", "-u", "origin", "main"]);
    if (push.status !== 0) return undefined;
    return { story, alpha, beta };
  }

  private createAcceptanceTask(
    parent: string,
    title: string,
    file: string,
    content: string,
  ): WaveTask | undefined {
    const created = this.json(this.cli(["create", "task", title, "--parent", parent, "--json"]));
    const item = created?.item as { id?: unknown; path?: unknown } | undefined;
    if (typeof item?.id !== "string" || typeof item.path !== "string") return undefined;
    const raw = this.read(item.path);
    const acceptance = `- [ ] Create the file ${file} at the repository root containing exactly: ${content}`;
    const rewritten = raw.replace(
      /## Acceptance\n\n- \[ \] ?\n/,
      `## Acceptance\n\n${acceptance}\n`,
    );
    if (rewritten === raw) return undefined;
    this.write(item.path, rewritten);
    return { id: item.id, path: item.path, file, content };
  }

  worktreePath(id: string): string {
    const path = join(dirname(this.dir), `${basename(this.dir)}-${id}`);
    this.worktreePaths.push(path);
    return path;
  }

  /** Headless `opencode run`; the transcript is persisted for review evidence. */
  runPrompt(
    label: string,
    message: string,
    opts: { agent?: string; session?: string; overrides?: NodeJS.ProcessEnv } = {},
  ): RunResult {
    const args = [
      "run",
      "--standalone",
      "--print-logs",
      "--log-level",
      "info",
      "--model",
      MODEL,
      "--format",
      "json",
      // Headless has no client to answer `ask` prompts (e.g. worktree access
      // on machines where the sibling path is not inside the managed temp
      // dir); `--auto` approves those. Configured `deny` rules stay enforced,
      // which is what the permission probes rely on.
      "--auto",
    ];
    if (opts.agent !== undefined) args.push("--agent", opts.agent);
    if (opts.session !== undefined) args.push("--session", opts.session);
    args.push(message);
    const result = this.run("opencode", args, opts.overrides);
    this.saveTranscript(label, result);
    return result;
  }

  saveTranscript(label: string, result: RunResult): void {
    this.write(`.wave-evidence/${label}.stdout.jsonl`, result.stdout);
    this.write(`.wave-evidence/${label}.stderr.log`, result.stderr);
  }

  /** Read-only child-session export (token accounting). */
  sessionExport(sessionID: string): Record<string, unknown> | undefined {
    const result = this.run("opencode", ["session", "export", sessionID, "--standalone"]);
    try {
      return JSON.parse(result.stdout) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  dispose(keep: boolean): void {
    if (keep) return;
    for (const worktree of this.worktreePaths) rmSync(worktree, { recursive: true, force: true });
    rmSync(this.remoteDir, { recursive: true, force: true });
    rmSync(this.dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Transcript helpers
// ---------------------------------------------------------------------------

function parseTranscript(stdout: string): TranscriptEvent[] {
  const events: TranscriptEvent[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      events.push(JSON.parse(line) as TranscriptEvent);
    } catch {
      // Non-JSON stdout line: transcript noise.
    }
  }
  return events;
}

function eventsOf(result: RunResult): TranscriptEvent[] {
  return parseTranscript(result.stdout);
}

function textOf(events: TranscriptEvent[]): string {
  return events
    .filter((event) => event.type === "text")
    .map((event) => event.part?.text ?? "")
    .join("\n");
}

function firstSessionId(events: TranscriptEvent[]): string | undefined {
  for (const event of events) {
    if (event.sessionID !== undefined) return event.sessionID;
  }
  return undefined;
}

function toolCalls(events: TranscriptEvent[]): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const event of events) {
    if (event.type !== "tool_use" || event.part?.tool === undefined) continue;
    calls.push({
      tool: event.part.tool,
      status: event.part.state?.status,
      messageID: event.part.messageID,
    });
  }
  return calls;
}

function subagentCalls(events: TranscriptEvent[]): SubagentCall[] {
  const calls: SubagentCall[] = [];
  for (const event of events) {
    if (event.type !== "tool_use" || event.part?.tool !== "subagent") continue;
    const input = event.part.state?.input ?? {};
    calls.push({
      agent: typeof input.agent === "string" ? input.agent : "?",
      status: event.part.state?.status,
      error: event.part.state?.error,
      output: event.part.state?.output,
      messageID: event.part.messageID,
    });
  }
  return calls;
}

function tokenTotals(events: TranscriptEvent[]): Tokens {
  const totals: Tokens = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const event of events) {
    if (event.type !== "step_finish" || event.part?.tokens === undefined) continue;
    totals.calls += 1;
    totals.input += event.part.tokens.input ?? 0;
    totals.output += event.part.tokens.output ?? 0;
    totals.cacheRead += event.part.tokens.cache?.read ?? 0;
    totals.cacheWrite += event.part.tokens.cache?.write ?? 0;
  }
  return totals;
}

/**
 * Per-session token totals from `opencode session export` — the durable
 * surface for any session (including child sessions, whose transcripts are not
 * in the parent's stdout). Falls back to the transcript's `step_finish`
 * events when the export is unavailable.
 */
function exportedTokenTotals(f: Fixture, sessionID: string | undefined): Tokens | undefined {
  if (sessionID === undefined) return undefined;
  const exported = f.sessionExport(sessionID);
  const messages = exported?.messages;
  if (!Array.isArray(messages)) return undefined;
  const totals: Tokens = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const message of messages as Array<Record<string, unknown>>) {
    const tokens = message.tokens as
      | { input?: number; output?: number; cache?: { read?: number; write?: number } }
      | undefined;
    if (tokens === undefined) continue;
    totals.calls += 1;
    totals.input += tokens.input ?? 0;
    totals.output += tokens.output ?? 0;
    totals.cacheRead += tokens.cache?.read ?? 0;
    totals.cacheWrite += tokens.cache?.write ?? 0;
  }
  return totals;
}

/** `[arggon] context: injected item <id> (<bytes> bytes)` observations. */
function contextInjections(stderr: string): Array<{ id: string; bytes: number }> {
  const injections: Array<{ id: string; bytes: number }> = [];
  const pattern = /\[arggon\] context: injected item (\S+) \((\d+) bytes\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stderr)) !== null) {
    injections.push({ id: match[1], bytes: Number(match[2]) });
  }
  return injections;
}

function subagentSessionId(call: SubagentCall): string | undefined {
  const match = /sessionID="(ses_[^"]+)"/.exec(call.output ?? "");
  return match?.[1];
}

/** Assistant steps (messageID groups) that issued two or more tool calls. */
function batchedSteps(
  events: TranscriptEvent[],
): Array<{ messageID: string; tools: string[]; input: number }> {
  const byStep = new Map<string, string[]>();
  for (const call of toolCalls(events)) {
    if (call.messageID === undefined) continue;
    const list = byStep.get(call.messageID) ?? [];
    list.push(call.tool);
    byStep.set(call.messageID, list);
  }
  const steps: Array<{ messageID: string; tools: string[]; input: number }> = [];
  for (const event of events) {
    if (event.type !== "step_finish" || event.part?.messageID === undefined) continue;
    const tools = byStep.get(event.part.messageID);
    if (tools === undefined || tools.length < 2) continue;
    steps.push({ messageID: event.part.messageID, tools, input: event.part.tokens?.input ?? 0 });
  }
  return steps;
}

function runTail(result: RunResult): string {
  const lines = [...result.stdout.split("\n"), "--- stderr ---", ...result.stderr.split("\n")];
  return lines.slice(-10).join("\n");
}

// ---------------------------------------------------------------------------
// T12 — permission probes
// ---------------------------------------------------------------------------

function permissionFixture(): Fixture {
  const f = new Fixture("perm");
  f.bootstrap();
  const init = f.init();
  check("permission fixture: init exits 0", init.status === 0, runTail(init));
  check(
    "permission fixture: generated agents exist",
    existsSync(f.path(".opencode/agents/arggon-reviewer.md")) &&
      existsSync(f.path(".opencode/agents/arggon-worker.md")) &&
      existsSync(f.path(".opencode/agents/arggon-coordinator.md")),
  );
  return f;
}

function scenarioReviewerEditDenied(f: Fixture): void {
  scenario("permissions: arggon-reviewer cannot edit (edit deny)");
  const result = f.runPrompt(
    "perm-reviewer-edit",
    [
      "Attempt this edit with the edit or write tool (never with the shell tool): create the file reviewer-write.txt with the content 'probe'.",
      "If the write/edit tool is unavailable or denied, do not create the file by any other means and say exactly: NO_EDIT_TOOL.",
      "Then, on a new line, list the exact names of every tool available to you, comma-separated.",
    ].join("\n"),
    { agent: "arggon-reviewer" },
  );
  const events = eventsOf(result);
  const calls = toolCalls(events);
  check("reviewer session ran", result.status === 0, runTail(result));
  check(
    "no edit/write/patch tool call appears in the reviewer transcript",
    calls.every((call) => !["edit", "write", "patch"].includes(call.tool)),
    JSON.stringify(calls.map((call) => call.tool)),
  );
  check(
    "the probe file was never created",
    !existsSync(f.path("reviewer-write.txt")),
    `reviewer-write.txt exists (edit permission not enforced)`,
  );
  info(
    `reviewer tool list reported by the model: ${textOf(events).split("\n").slice(-1)[0]?.slice(0, 400)}`,
  );
}

function scenarioWorkerSubagentDenied(f: Fixture): void {
  scenario("permissions: arggon-worker cannot launch a subagent (no nesting)");
  const result = f.runPrompt(
    "perm-worker-subagent",
    [
      "Use the subagent tool to launch the explore agent with the prompt: 'Reply with exactly the single word NESTED'.",
      "If the subagent tool is unavailable or denied, say exactly: NO_SUBAGENT_TOOL.",
      "Do not do anything else.",
    ].join("\n"),
    { agent: "arggon-worker" },
  );
  const events = eventsOf(result);
  const nested = subagentCalls(events);
  check("worker session ran", result.status === 0, runTail(result));
  check(
    "no completed subagent launch in the worker transcript",
    nested.every((call) => call.status !== "completed"),
    JSON.stringify(nested),
  );
  check(
    "no child session id appears in the worker transcript",
    !result.stdout.includes("<subagent sessionID="),
    runTail(result),
  );
  info(`worker reply: ${textOf(events).trim().split("\n").slice(-1)[0]?.slice(0, 300)}`);
}

function scenarioCoordinatorLaunch(
  f: Fixture,
  agent: string,
  expected: "completed" | "denied",
): void {
  scenario(
    `permissions: coordinator launches ${agent} (${expected === "denied" ? "deny-listed" : "allow-listed"})`,
  );
  const label = `perm-coordinator-${agent.replace(/[^a-z0-9]+/gi, "-")}`;
  // Denials are one prompt away from a model substitution (it may swap in an
  // allow-listed agent instead), so the deny probe spells out the exact
  // subagent call and gets a bounded retry. Both transcripts are kept.
  const attempts = expected === "denied" ? 2 : 1;
  let last: RunResult | undefined;
  let allCalls: SubagentCall[] = [];
  let ok = false;
  for (let attempt = 1; attempt <= attempts && !ok; attempt++) {
    const prompt =
      expected === "denied"
        ? [
            `Call the subagent tool with exactly this input: {"agent":"${agent}","description":"Denied probe","prompt":"Reply with exactly the single word PROBE_OK"}.`,
            "Do not change the agent value and do not substitute another agent; do not launch anything else.",
            "If the call is denied, quote the exact denial message verbatim.",
          ]
        : [
            `Use the subagent tool to launch the ${agent} agent with the prompt: 'Reply with exactly the single word PROBE_OK. Do not use any tools and do not do anything else.'`,
            "Then reply with one short line containing the subagent's reply.",
          ];
    last = f.runPrompt(attempt === 1 ? label : `${label}-retry`, prompt.join("\n"), {
      agent: "arggon-coordinator",
    });
    const calls = subagentCalls(eventsOf(last));
    allCalls = allCalls.concat(calls);
    const forAgent = calls.filter((call) => call.agent === agent);
    ok =
      expected === "completed"
        ? forAgent.some((call) => call.status === "completed" && /PROBE_OK/.test(call.output ?? ""))
        : forAgent.some(
            (call) => call.status === "error" && /Permission denied: subagent/i.test(call.error ?? ""),
          );
  }
  check(`coordinator session ran (${agent})`, last?.status === 0, last ? runTail(last) : "no run");
  check(
    `coordinator issued a subagent call for ${agent}`,
    allCalls.some((call) => call.agent === agent),
    JSON.stringify(allCalls),
  );
  check(
    expected === "completed" ? `launch of ${agent} completed` : `launch of ${agent} was denied`,
    ok,
    JSON.stringify(allCalls),
  );
}

// ---------------------------------------------------------------------------
// T13 — scripted end-to-end wave
// ---------------------------------------------------------------------------

function wavePlanPrompt(): string {
  return [
    "You are the coordinator for one orchestration wave in this repository (a fixture; no GitHub — origin is a local bare repo). Use the arggon CLI (on PATH; npm run arggon also works).",
    "",
    "PHASE 1 — plan only. Do this and nothing else:",
    "1. Run: arggon next --json",
    "2. Run: arggon list --status todo --json",
    "3. Identify the two claimable task items and confirm they are file-disjoint.",
    "4. Read both task files under tasks/ for their acceptance checklists.",
    "Reply with a short numbered wave plan: each item id, its branch, the single file its worker will create, and the worker prompt skeleton. Do NOT claim anything, do NOT launch subagents, do NOT edit or commit anything yet.",
  ].join("\n");
}

function waveDelegatePrompt(f: Fixture, chain: WaveChain): string {
  return [
    "PHASE 2 — delegate both items to workers NOW.",
    "",
    "Launch BOTH workers in ONE message with two subagent tool calls, FOREGROUND (never background: true — the headless run must wait for their results; a background notification would end this run early).",
    "",
    "Use agent arggon-worker for both. Each worker prompt must be self-contained and instruct exactly:",
    `- Step 1: run: arggon start <item-id> --worktree --assignee <login> --json   (workdir ${f.dir}) and read worktreePath from the JSON output.`,
    "- Step 2: inside that worktree (use the shell tool's workdir), create the single acceptance file with exactly the acceptance content.",
    "- Step 3: run: arggon validate   from the worktree (must be green).",
    `- Step 4: from the worktree: git add <file> && git commit -m "feat(<item-id>): create <file>" then git push -u origin feat/<item-id>.`,
    '- Step 5: from the worktree run: arggon comment <item-id> "<evidence: file, commit, validation>" and arggon handoff <item-id> --next "<next step>".',
    "- Rules: stay in the worktree, stage explicit paths only, NEVER flip the item to done, never merge, never reopen anything.",
    "",
    `Worker A: item ${chain.alpha.id}, acceptance file ${chain.alpha.file} containing exactly: ${chain.alpha.content}, assignee arggon-worker-a.`,
    `Worker B: item ${chain.beta.id}, acceptance file ${chain.beta.file} containing exactly: ${chain.beta.content}, assignee arggon-worker-b.`,
    "",
    "After both workers return, reply with one line per worker: item id, branch, worktree path, commit hash, push result.",
  ].join("\n");
}

function waveReviewPrompt(f: Fixture, chain: WaveChain): string {
  const perItem = (task: WaveTask): string[] => [
    `- Item ${task.id}: worktree ${f.worktreePath(task.id)}, branch feat/${task.id}, acceptance file ${task.file} (must contain exactly: ${task.content}).`,
    `  With shell workdir set to that worktree, inspect: git log --oneline main..HEAD ; git diff --stat main..HEAD ; cat ${task.file} ; arggon validate.`,
    `  Then POST THE VERDICT from that worktree: arggon comment ${task.id} "review verdict: <merge|no-merge> — findings in severity order, evidence, what was verified, what could not be".`,
  ];
  return [
    "PHASE 3 — review both branches with ONE arggon-reviewer subagent launch (foreground, single subagent call; never background).",
    "",
    "The reviewer prompt must be self-contained and instruct exactly:",
    ...perItem(chain.alpha),
    ...perItem(chain.beta),
    "- The reviewer has no edit tool; it must not modify project files. Read-only commands and arggon comment are allowed. Verdicts go on the items, never to GitHub.",
    "",
    "After the reviewer returns, reply with one line per item: verdict summary + merge/no-merge recommendation.",
  ].join("\n");
}

function waveMergePrompt(chain: WaveChain): string {
  return [
    "PHASE 4 — merge verification and completion. Both verdicts recommend merge. For EACH item, in this exact order, from the fixture root:",
    "",
    `For ${chain.alpha.id}:`,
    `1. Ensure the main tree is clean, then merge: git merge feat/${chain.alpha.id} --no-edit   (the local merge IS the merge — this fixture has no GitHub).`,
    `2. Verify ${chain.alpha.file} now exists on main with content ${chain.alpha.content} and that the item file on main is in_progress.`,
    "3. Tick the acceptance checkbox in the item file (change '- [ ]' to '- [x]').",
    `4. Flip it done: arggon update ${chain.alpha.id} --status done`,
    "",
    `For ${chain.beta.id}: same four steps with feat/${chain.beta.id} and ${chain.beta.file} (content ${chain.beta.content}).`,
    "",
    "Then git push origin main, arggon validate, and arggon report. Reply with the final state: item ids, statuses, merge commits, validate result.",
  ].join("\n");
}

function waveFixture(): { fixture: Fixture; chain: WaveChain } | undefined {
  const f = new Fixture("wave");
  f.bootstrap();
  const init = f.init();
  check("wave fixture: init exits 0", init.status === 0, runTail(init));
  const chain = f.createWaveChain();
  if (chain === undefined) return undefined;
  const validate = f.cli(["validate"]);
  check("wave fixture: arggon validate green", validate.status === 0, runTail(validate));
  return { fixture: f, chain };
}

function assertWavePhase2(f: Fixture, chain: WaveChain, result: RunResult): void {
  const events = eventsOf(result);
  const workers = subagentCalls(events).filter(
    (call) => call.agent === "arggon-worker" && call.status === "completed",
  );
  check(
    "phase 2 launched two arggon-worker subagents, foreground, completed",
    workers.length === 2,
    JSON.stringify(subagentCalls(events)),
  );
  const batched = batchedSteps(events);
  info(
    `batching: ${toolCalls(events).length} tool call(s) in ${tokenTotals(events).calls} step(s); ${batched.length} step(s) with >=2 calls (subagent launches batched: ${batched.some((step) => step.tools.filter((tool) => tool === "subagent").length >= 2)})`,
  );
  for (const [task, sibling] of [
    [chain.alpha, chain.beta],
    [chain.beta, chain.alpha],
  ] as Array<[WaveTask, WaveTask]>) {
    const worktree = f.worktreePath(task.id);
    check(`worktree exists for ${task.id}`, existsSync(worktree), worktree);
    const file = join(worktree, task.file);
    check(
      `${task.file} has the acceptance content in the ${task.id} worktree`,
      existsSync(file) && readFileSync(file, "utf8").trim() === task.content,
      existsSync(file) ? JSON.stringify(readFileSync(file, "utf8")) : "missing",
    );
    check(
      `${task.id} worktree does not carry the sibling file ${sibling.file}`,
      !existsSync(join(worktree, sibling.file)),
    );
    const remote = f.git(["ls-remote", "origin", `refs/heads/feat/${task.id}`]).stdout.trim();
    check(`feat/${task.id} is pushed to origin`, remote.length > 0, remote);
    const item = f.git(["show", `feat/${task.id}:${task.path}`]).stdout;
    check(
      `${task.id} is claimed (in_progress + assignee) on its branch`,
      /status: in_progress/.test(item) && /assignee: arggon-worker-/.test(item),
      item.slice(0, 300),
    );
    check(
      `${task.id} carries the worker comment and handoff`,
      /### handoff \d{4}-\d{2}-\d{2}/.test(item) && /### \d{4}-\d{2}-\d{2} @/.test(item),
      item.slice(0, 400),
    );
  }
}

function assertWavePhase3(f: Fixture, chain: WaveChain, result: RunResult): void {
  const events = eventsOf(result);
  const reviewers = subagentCalls(events).filter(
    (call) => call.agent === "arggon-reviewer" && call.status === "completed",
  );
  check(
    "phase 3 reviewer subagent completed",
    reviewers.length >= 1,
    JSON.stringify(subagentCalls(events)),
  );
  for (const task of [chain.alpha, chain.beta]) {
    const item = f.git(["show", `feat/${task.id}:${task.path}`]).stdout;
    check(
      `${task.id} branch carries the reviewer verdict`,
      /verdict/i.test(item) && /merge/i.test(item),
      item.slice(-400),
    );
  }
}

function assertWavePhase4(f: Fixture, chain: WaveChain, result: RunResult): void {
  check("phase 4 session ran", result.status === 0, runTail(result));
  for (const task of [chain.alpha, chain.beta]) {
    const ancestor = f.git(["merge-base", "--is-ancestor", `feat/${task.id}`, "HEAD"]);
    check(
      `feat/${task.id} is merged into main`,
      ancestor.status === 0,
      `${ancestor.status}: ${ancestor.stdout}${ancestor.stderr}`,
    );
    const file = f.path(task.file);
    check(
      `main carries ${task.file} with the acceptance content`,
      existsSync(file) && readFileSync(file, "utf8").trim() === task.content,
      existsSync(file) ? JSON.stringify(readFileSync(file, "utf8")) : "missing",
    );
    const item = f.read(task.path);
    check(`item ${task.id} is done`, /status: done/.test(item), item.slice(0, 200));
    check(`item ${task.id} acceptance box ticked`, /- \[x\]/.test(item));
    check(
      `item ${task.id} keeps the verdict on main`,
      /verdict/i.test(item) && /merge/i.test(item),
      item.slice(-300),
    );
  }
  const validate = f.cli(["validate"]);
  check("arggon validate is green after the wave", validate.status === 0, runTail(validate));
  const done = f.cli(["list", "--status", "done", "--json"]);
  check(
    "both items read back done from the tracker",
    done.stdout.includes(chain.alpha.id) && done.stdout.includes(chain.beta.id),
    runTail(done),
  );
  const remoteMain = f.git(["ls-remote", "origin", "refs/heads/main"]).stdout.trim();
  const localMain = f.git(["rev-parse", "HEAD"]).stdout.trim();
  check(
    "main was pushed to origin",
    remoteMain.startsWith(localMain),
    `origin=${remoteMain} local=${localMain}`,
  );
}

// ---------------------------------------------------------------------------
// T13 — context accounting (feeds task-opencode2-context)
// ---------------------------------------------------------------------------

function scenarioContextAccounting(f: Fixture, chain: WaveChain): void {
  scenario("context accounting: injected item block + per-worker token totals");
  const prompt = "Reply with exactly: CTX. Do not use any tools.";
  const withBlock = f.runPrompt("accounting-with-block", prompt, {
    agent: "arggon-worker",
    overrides: { ARGON_ITEM: chain.alpha.id },
  });
  const withoutBlock = f.runPrompt("accounting-without-block", prompt, {
    agent: "arggon-worker",
  });
  const injectionsWith = contextInjections(withBlock.stderr);
  const injectionsWithout = contextInjections(withoutBlock.stderr);
  check(
    "item block injected when the item resolves (bounded)",
    injectionsWith.length >= 1 &&
      injectionsWith.every((entry) => entry.bytes <= CONTEXT_BLOCK_MAX_BYTES),
    `${injectionsWith.map((entry) => `${entry.id}:${entry.bytes}B`).join(", ") || "no injection"}\n${runTail(withBlock)}`,
  );
  check(
    "no item block injected when nothing resolves",
    injectionsWithout.length === 0,
    runTail(withoutBlock),
  );
  const withTokens =
    exportedTokenTotals(f, firstSessionId(eventsOf(withBlock))) ?? tokenTotals(eventsOf(withBlock));
  const withoutTokens =
    exportedTokenTotals(f, firstSessionId(eventsOf(withoutBlock))) ??
    tokenTotals(eventsOf(withoutBlock));
  const bytes = injectionsWith[0]?.bytes ?? 0;
  info(`item-block accounting (model ${MODEL}, opencode v2.0.7; tokens via opencode session export):`);
  info(
    `  with block:    ${withTokens.calls} model call(s), ${injectionsWith.length} injection(s) x ${bytes} B, input ${withTokens.input} tok (fresh) + ${withTokens.cacheRead} cache-read, output ${withTokens.output} tok`,
  );
  info(
    `  without block: ${withoutTokens.calls} model call(s), 0 injection(s), input ${withoutTokens.input} tok (fresh) + ${withoutTokens.cacheRead} cache-read, output ${withoutTokens.output} tok`,
  );
  info(
    `  delta: +${bytes} B/call (~${Math.round(bytes / 4)} tok @4 B/tok heuristic); observed fresh-input delta ${withTokens.input - withoutTokens.input} tok over ${withTokens.calls} call(s)`,
  );
}

function scenarioWorkerSessionStats(f: Fixture, result: RunResult): void {
  scenario("context accounting: real per-worker child-session tokens");
  const workers = subagentCalls(eventsOf(result)).filter(
    (call) => call.agent === "arggon-worker" && call.status === "completed",
  );
  for (const call of workers) {
    const sessionID = subagentSessionId(call);
    if (sessionID === undefined) {
      check("worker subagent output carries a child session id", false, JSON.stringify(call.output));
      continue;
    }
    const totals = exportedTokenTotals(f, sessionID);
    if (totals === undefined) {
      check(`session export parsed for ${sessionID}`, false, "no message tokens");
      continue;
    }
    info(
      `  child session ${sessionID}: ${totals.calls} model call(s), input ${totals.input} tok (fresh) + ${totals.cacheRead} cache-read, output ${totals.output} tok`,
    );
    check(`worker child session ${sessionID} exported with token data`, totals.calls >= 1);
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("smoke:opencode:wave — OpenCode V2 orchestration harness (T12 + T13)");
  if (!opencodeAvailable()) {
    console.log("skipped: opencode not installed");
    return;
  }
  console.log(`model: ${MODEL}`);

  // T12 — permission probes on the generated agents.
  const permissions = permissionFixture();
  scenarioReviewerEditDenied(permissions);
  scenarioWorkerSubagentDenied(permissions);
  scenarioCoordinatorLaunch(permissions, "explore", "completed");
  scenarioCoordinatorLaunch(permissions, "arggon-worker", "completed");
  scenarioCoordinatorLaunch(permissions, "arggon-reviewer", "completed");
  scenarioCoordinatorLaunch(permissions, "general", "denied");

  // T13 — scripted wave: one coordinator session, four phases.
  const wave = waveFixture();
  if (wave === undefined) {
    check("wave fixture created", false, "tracker chain creation failed");
  } else {
    const { fixture: f, chain } = wave;
    scenario("wave: phase 1 — coordinator plans by file-disjointness");
    const plan = f.runPrompt("wave-1-plan", wavePlanPrompt(), { agent: "arggon-coordinator" });
    const planText = textOf(eventsOf(plan));
    check("plan phase ran", plan.status === 0, runTail(plan));
    check(
      "plan names both items",
      planText.includes(chain.alpha.id) && planText.includes(chain.beta.id),
      runTail(plan),
    );
    check(
      "plan names both acceptance files",
      planText.includes(chain.alpha.file) && planText.includes(chain.beta.file),
      runTail(plan),
    );
    const sessionID = firstSessionId(eventsOf(plan));
    check(
      "coordinator session id captured for the phase follows",
      sessionID !== undefined,
      runTail(plan),
    );

    if (sessionID === undefined) {
      check("wave phases 2-4 skipped (no session id)", false);
    } else {
      scenario("wave: phase 2 — two workers, foreground, own worktrees");
      const delegate = f.runPrompt("wave-2-delegate", waveDelegatePrompt(f, chain), {
        agent: "arggon-coordinator",
        session: sessionID,
      });
      check("delegate phase ran", delegate.status === 0, runTail(delegate));
      assertWavePhase2(f, chain, delegate);
      scenarioWorkerSessionStats(f, delegate);

      scenario("wave: phase 3 — reviewer verdicts on the items");
      const review = f.runPrompt("wave-3-review", waveReviewPrompt(f, chain), {
        agent: "arggon-coordinator",
        session: sessionID,
      });
      check("review phase ran", review.status === 0, runTail(review));
      assertWavePhase3(f, chain, review);

      scenario("wave: phase 4 — merge verification and done flips");
      const merge = f.runPrompt("wave-4-merge", waveMergePrompt(chain), {
        agent: "arggon-coordinator",
        session: sessionID,
      });
      assertWavePhase4(f, chain, merge);

      scenarioContextAccounting(f, chain);
    }
  }

  if (failures.length > 0) {
    console.error(
      `\nsmoke:opencode:wave FAILED — ${failures.length} check(s):\n${failures.map((f) => `- ${f}`).join("\n")}`,
    );
    console.error(`fixtures kept for inspection:\n${fixtures.map((f) => `- ${f.dir}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`\nsmoke:opencode:wave passed — ${fixtures.length} fixture(s), 0 failures`);
  if (process.env.ARGON_SMOKE_KEEP !== "1") {
    for (const f of fixtures) f.dispose(false);
  } else {
    console.log(
      `fixtures kept (ARGON_SMOKE_KEEP=1):\n${fixtures.map((f) => `- ${f.dir}`).join("\n")}`,
    );
  }
}

main();
