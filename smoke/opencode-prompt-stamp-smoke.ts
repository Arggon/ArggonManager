#!/usr/bin/env node
/**
 * task-opencode-prompt-stamp smoke: deterministic, model-free headless evidence
 * for the T4 hooks (plan-methodology-adapters-017 §T4, spec-methodology-adapters-017 §S4).
 *
 * What it drives
 * --------------
 * A real `opencode serve` (skipped when the binary is absent, like
 * `smoke:native-start-cold-smoke.ts`'s move leg) with THIS checkout's vendored
 * plugin bundle (`opencode/plugins/arggon/index.bundle.ts` — `npm run
 * check:plugin` is what proves it is derived from the source) loaded in a
 * disposable fixture whose tracker root is a git checkout, plus an item worktree
 * carrying the env contract (`prepareWorktreeEnv`, the real kernel writer) on
 * the item branch. The model is a SCRIPTED provider: an in-process
 * OpenAI-compatible SSE server that answers the compaction request with a
 * filled summary template. No model, no quota, no network.
 *
 * The checks
 * ----------
 *  1. admission stamp — a prompt admitted in the worktree is persisted with
 *     `payload.metadata.arggon` carrying item/branch/worktreePath/worktreeId and
 *     the `.arggon.env` path as its source; the submitted text and delivery are
 *     byte-identical (the rewrite contract: metadata only).
 *  2. compaction retention — the compaction request the host assembles carries
 *     the item block in its system instructions exactly once, and the hook did
 *     NOT record the compaction itself (the scripted provider's summary is what
 *     lands: a `compaction` message with status `completed`).
 *  3. retention after compaction — the agent-loop request that follows the
 *     compaction still carries the block (the item survives its transcript).
 *  4. no polling fallback — every provider request is accounted for by a drive
 *     step (prompt or compact); an idle window after the last step observes no
 *     request, so the plugin adds no timer-driven traffic.
 *  5. silence off-contract — a session in the plain primary checkout (no
 *     `.arggon.env`) and a session on a branch with no item correlation admit
 *     prompts WITHOUT an `argon` stamp.
 *  6. permission rules unchanged — the bundle registers the same native tool
 *     surface and permission-related behavior is untouched: the session's
 *     prompt/compact flow completes with no permission prompt raised, and the
 *     plugin source/bundle declares no `permission` domain call.
 *
 * Exit codes: 0 passed or `skipped: opencode not installed`; 1 a check failed
 * (the fixture is kept for inspection).
 */
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareWorktreeEnv, runCreate } from "@arggondev/lib";
import { runInit } from "../cli/src/init.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ITEM_ID = "task-prompt-stamp-smoke";
const ITEM_BRANCH = `feat/${ITEM_ID}`;
const PROVIDER_ID = "scripted-stamp";
const MODEL_ID = "stamp-model";
const SERVE_TIMEOUT_MS = 40_000;
const PROMPT_TIMEOUT_MS = 60_000;
const POLL_MS = 200;
/** The idle window that proves nothing is polling: no request may land in it. */
const IDLE_WINDOW_MS = 4_000;
const KEEP = process.env.ARGON_STAMP_SMOKE_KEEP === "1";

type Report = { passed: boolean };
function check(report: Report, name: string, ok: boolean, detail?: string): void {
  const mark = ok ? "ok  " : "FAIL";
  console.log(`  [${mark}] ${name}${ok || detail === undefined ? "" : `\n         ${detail}`}`);
  if (!ok) report.passed = false;
}

// ---------------------------------------------------------------------------
// Pure predicates (imported by smoke/opencode-prompt-stamp-smoke.test.ts)
// ---------------------------------------------------------------------------

/** One request the scripted provider received, in order. */
export type ProviderRequest = {
  call: number;
  at: number;
  /** Roles of the assembled messages, in order. */
  roles: string[];
  /** The system instructions the host assembled, concatenated. */
  system: string;
  /** True when this is the checkpoint-summary request. */
  compaction: boolean;
};

/** Faults in the observed admission stamp (empty = the contract held). */
export function admissionStampFaults(
  stamp: unknown,
  expected: { item: string; branch: string; worktreePath: string; worktreeId: string },
): string[] {
  const faults: string[] = [];
  if (stamp === null || typeof stamp !== "object") return ["the admitted payload carries no stamp"];
  const value = stamp as Record<string, unknown>;
  if (value.item !== expected.item) faults.push(`stamp item ${JSON.stringify(value.item)}`);
  if (value.branch !== expected.branch) faults.push(`stamp branch ${JSON.stringify(value.branch)}`);
  if (value.worktreePath !== expected.worktreePath) {
    faults.push(`stamp worktreePath ${JSON.stringify(value.worktreePath)}`);
  }
  if (value.worktreeId !== expected.worktreeId) {
    faults.push(`stamp worktreeId ${JSON.stringify(value.worktreeId)}`);
  }
  if (typeof value.source !== "string" || !value.source.endsWith(".arggon.env")) {
    faults.push(`stamp source ${JSON.stringify(value.source)} is not the env-contract file`);
  }
  return faults;
}

/** Faults in one admitted prompt payload (empty = the rewrite contract held). */
export function promptPayloadFaults(
  payload: Record<string, unknown> | undefined,
  submittedText: string,
  submittedMetadata: Record<string, unknown> | undefined,
): string[] {
  const faults: string[] = [];
  if (payload === undefined) return ["the host persisted no payload for the prompt"];
  if (payload.text !== submittedText) {
    faults.push(`text rewritten: ${JSON.stringify(payload.text)}`);
  }
  if (submittedMetadata !== undefined) {
    for (const [key, value] of Object.entries(submittedMetadata)) {
      const carried = (payload.metadata as Record<string, unknown> | undefined)?.[key];
      if (JSON.stringify(carried) !== JSON.stringify(value)) {
        faults.push(`caller metadata ${key} was not preserved`);
      }
    }
  }
  return faults;
}

/** Faults in the compaction request's evidence (empty = retention held). */
export function compactionRetentionFaults(requests: ProviderRequest[], itemId: string): string[] {
  const compaction = requests.filter((request) => request.compaction);
  if (compaction.length === 0) return ["the host issued no compaction request"];
  if (compaction.length > 1) return [`${compaction.length} compaction requests, expected 1`];
  const request = compaction[0];
  const faults: string[] = [];
  const occurrences = request.system.split("<arggon-item>").length - 1;
  if (occurrences !== 1) {
    faults.push(`the compaction request carries ${occurrences} item blocks, expected exactly 1`);
  }
  if (!request.system.includes(`id: ${itemId}`)) {
    faults.push("the compaction request's system does not name the item");
  }
  if (!request.system.includes("arggon: tracked work item")) {
    faults.push("the compaction request's system does not carry the item block header");
  }
  return faults;
}

/**
 * Faults in the request timeline (empty = no polling). Every request must be
 * attributable to a drive step, and the idle window after the last one must
 * observe nothing.
 */
export function idleFaults(requests: ProviderRequest[], afterLast: number): string[] {
  const late = requests.filter((request) => request.at > afterLast + 250);
  return late.length === 0
    ? []
    : [
        `${late.length} provider request(s) arrived after the drive finished (call ${late.map((r) => r.call).join(", ")})`,
      ];
}

/** Faults in the persisted compaction message (empty = the hook did not record it). */
export function compactionMessageFaults(message: Record<string, unknown> | undefined): string[] {
  if (message === undefined) return ["no compaction message was persisted"];
  if (message.status !== "completed") {
    return [`compaction message status is ${JSON.stringify(message.status)}, expected completed`];
  }
  if (typeof message.summary !== "string" || message.summary.trim() === "") {
    return ["the compaction message carries no summary"];
  }
  return [];
}

// ---------------------------------------------------------------------------
// The scripted provider
// ---------------------------------------------------------------------------

/** The filled summary template the scripted provider answers compaction with. */
export function scriptedSummary(itemId: string): string {
  return [
    "## Objective",
    `- Continue work on ${itemId}.`,
    "",
    "## Requirements",
    "- (none)",
    "",
    "## Decisions",
    "- (none)",
    "",
    "## Work State",
    "### Completed",
    "- (none)",
    "",
    "### Active",
    "- (none)",
    "",
    "### Blocked",
    "- (none)",
    "",
    "## Next Move",
    "1. (none)",
    "",
    "## Relevant Files",
    "- (none)",
    "",
    "## Important Context",
    "- (none)",
    "",
  ].join("\n");
}

export type RecordingProvider = {
  port: number;
  requests(): ProviderRequest[];
  close(): Promise<void>;
};

/**
 * An in-process OpenAI-compatible provider that records every request and
 * answers the checkpoint-summary request with {@link scriptedSummary}. The
 * summary instruction is recognizable by the host's own wording
 * ("You MUST summarize the conversation above"), observed on 2.0.26.
 */
export function startRecordingProvider(itemId: string): Promise<RecordingProvider> {
  const requests: ProviderRequest[] = [];
  let call = 0;
  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => {
      call += 1;
      const parsed = body === "" ? {} : (JSON.parse(body) as Record<string, unknown>);
      const stream = parsed.stream === true;
      const messages = (parsed.messages ?? []) as Array<{ role?: string; content?: unknown }>;
      const system = messages
        .filter((message) => message.role === "system")
        .map((message) =>
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content ?? ""),
        )
        .join("\n");
      const last = messages[messages.length - 1];
      const lastText = typeof last?.content === "string" ? last.content : "";
      const compaction = lastText.includes("You MUST summarize the conversation above");
      requests.push({
        call,
        at: Date.now(),
        roles: messages.map((message) => String(message.role)),
        system,
        compaction,
      });
      res.writeHead(200, {
        "content-type": stream ? "text/event-stream" : "application/json",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      const id = `chatcmpl-stamp-${call}`;
      const created = Math.floor(Date.now() / 1000);
      const model = typeof parsed.model === "string" ? parsed.model : MODEL_ID;
      const chunk = (delta: Record<string, unknown>, finish: string | null): void => {
        res.write(
          `data: ${JSON.stringify({
            id,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{ index: 0, delta, finish_reason: finish }],
          })}\n\n`,
        );
      };
      if (!stream) {
        res.end(
          JSON.stringify({
            id,
            object: "chat.completion",
            created,
            model,
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "scripted" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        );
        return;
      }
      if (compaction) {
        chunk({ role: "assistant", content: scriptedSummary(itemId) }, null);
      } else {
        chunk({ role: "assistant", content: "scripted done" }, null);
      }
      chunk({}, "stop");
      res.write("data: [DONE]\n\n");
      res.end();
    });
  });
  return new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address !== null && typeof address === "object" ? address.port : undefined;
      if (port === undefined) {
        rejectPromise(new Error("the scripted provider could not bind a port"));
        return;
      }
      resolvePromise({
        port,
        requests: () => requests.map((request) => structuredClone(request)),
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Fixture plumbing
// ---------------------------------------------------------------------------

type GitResult = { code: number; stdout: string; stderr: string };

function git(cwd: string, args: string[]): GitResult {
  const proc = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 60_000 });
  return { code: proc.status ?? -1, stdout: proc.stdout ?? "", stderr: proc.stderr ?? "" };
}

function gitOrThrow(cwd: string, args: string[]): string {
  const result = git(cwd, args);
  if (result.code !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed in ${cwd} (exit ${result.code}): ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  return result.stdout;
}

function freePort(): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address !== null && typeof address === "object" ? address.port : undefined;
      server.close(() =>
        port === undefined ? rejectPromise(new Error("no port")) : resolvePromise(port),
      );
    });
  });
}

function opencodeBinary(): string | undefined {
  const candidates = [
    process.env.OPENCODE_BIN,
    join(process.env.HOME ?? "", ".opencode", "bin", "opencode"),
    "/usr/local/bin/opencode",
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** `server password …` line from `opencode serve` stdout. */
export function servePassword(log: string): string | undefined {
  return /server password (\S+)/.exec(log)?.[1];
}

/** `server listening on http://127.0.0.1:PORT` line from the serve stdout. */
export function servePort(log: string): number | undefined {
  const raw = /server listening on http:\/\/127\.0\.0\.1:(\d+)/.exec(log)?.[1];
  const port = raw === undefined ? undefined : Number(raw);
  return port !== undefined && Number.isInteger(port) && port > 0 ? port : undefined;
}

type ApiResponse = { status: number; json: unknown };

async function opencodeApi(
  base: string,
  password: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResponse> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = text === "" ? undefined : (JSON.parse(text) as unknown);
  } catch {
    json = text;
  }
  return { status: response.status, json };
}

async function pollUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  intervalMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = predicate();
    const observed = value instanceof Promise ? await value : value;
    if (observed) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((done) => setTimeout(done, intervalMs));
  }
}

function findItemFile(root: string, itemId: string): string | null {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    for (const entry of spawnSync("ls", ["-A", dir], { encoding: "utf8" }).stdout.split("\n")) {
      if (entry === "" || entry === "node_modules" || entry === ".git") continue;
      const path = join(dir, entry);
      if (entry.endsWith(".md") && entry === `${itemId}.md`) return path;
      if (!entry.includes(".")) stack.push(path);
    }
  }
  return null;
}

/**
 * A checkout with an initialized tracker and one claimed item on its branch.
 * The tracker is seeded through the kernel's own operations, so the item file
 * the CLI reads is the real shape.
 */
function seedTracker(repo: string): void {
  runInit({ dir: repo, force: false });
  const chain: Array<[string, string, string | undefined, string]> = [
    ["initiative", "Stamp smoke", undefined, "stamp-smoke"],
    ["epic", "Real host", "stamp-smoke", "real-host"],
    ["story", "Prompt stamp", "real-host", "prompt-stamp"],
    ["task", "Prompt stamp smoke leg", "prompt-stamp", ITEM_ID],
  ];
  for (const [type, title, parentId, id] of chain) {
    runCreate({
      cwd: repo,
      type: type as "initiative" | "epic" | "story" | "task",
      title,
      ...(parentId !== undefined ? { parent: parentId } : {}),
      id,
    });
  }
  if (findItemFile(repo, ITEM_ID) === null) {
    throw new Error(`seeded item ${ITEM_ID}.md not found in the fixture`);
  }
}

// ---------------------------------------------------------------------------
// The scenario
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("smoke:opencode-prompt-stamp — T4 prompt-admission stamp + compaction retention");
  const report: Report = { passed: true };
  const bin = opencodeBinary();
  if (bin === undefined) {
    console.log("skipped: opencode not installed");
    return;
  }

  const parent = realpathSync(mkdtempSync(join(tmpdir(), "arggon-stamp-smoke-")));
  const repo = join(parent, "repo-stamp");
  const worktree = join(parent, `repo-stamp-${ITEM_ID}`);
  const provider = await startRecordingProvider(ITEM_ID);
  let serve: ReturnType<typeof spawn> | undefined;
  const acc = { text: "" };
  const sessions: string[] = [];
  let serverBase = "";
  let serverPassword = "";

  try {
    // 1. The fixture: tracker + vendored bundle + scripted provider + worktree.
    seedTracker(repo);
    gitOrThrow(repo, ["init", "-q", "-b", "main"]);
    gitOrThrow(repo, ["config", "user.email", "stamp-smoke@example.test"]);
    gitOrThrow(repo, ["config", "user.name", "Stamp Smoke"]);
    gitOrThrow(repo, ["config", "maintenance.auto", "false"]);
    const pluginDir = join(repo, ".opencode", "plugins", "arggon");
    mkdirSync(pluginDir, { recursive: true });
    copyFileSync(
      fileURLToPath(new URL("../opencode/plugins/arggon/index.bundle.ts", import.meta.url)),
      join(pluginDir, "index.ts"),
    );
    writeFileSync(
      join(repo, "opencode.json"),
      `${JSON.stringify(
        {
          $schema: "https://opencode.ai/config.json",
          provider: {
            [PROVIDER_ID]: {
              npm: "@ai-sdk/openai-compatible",
              name: "Scripted Stamp",
              options: { baseURL: `http://127.0.0.1:${provider.port}/v1`, apiKey: "sk-scripted" },
              models: { [MODEL_ID]: { name: "Stamp Model" } },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    gitOrThrow(repo, ["add", "-A"]);
    gitOrThrow(repo, ["commit", "-qm", "chore: stamp-smoke fixture"]);
    gitOrThrow(repo, ["worktree", "add", "-b", ITEM_BRANCH, worktree]);
    check(
      report,
      "the fixture carries the vendored plugin and its worktree is on the item branch",
      existsSync(join(worktree, ".opencode", "plugins", "arggon", "index.ts")) &&
        gitOrThrow(worktree, ["rev-parse", "--abbrev-ref", "HEAD"]).trim() === ITEM_BRANCH,
      `worktree: ${worktree}`,
    );

    // The env contract, written by the REAL kernel writer (not a hand-typed
    // file): the six documented keys at the worktree root. This is the only
    // thing the stamp's `source` can name, so the smoke must produce it the way
    // `arggon start --worktree` does.
    const envReceipt = prepareWorktreeEnv(repo, worktree, {
      identity: { itemId: ITEM_ID, branch: ITEM_BRANCH },
    });
    check(
      report,
      "the worktree env contract was written with the six documented keys",
      envReceipt.written === true &&
        existsSync(join(worktree, ".arggon.env")) &&
        readFileSync(join(worktree, ".arggon.env"), "utf8").includes(`ARGON_ITEM=${ITEM_ID}`),
      JSON.stringify(envReceipt),
    );

    // The bin shim: the plugin's CLI fallbacks resolve THIS checkout's CLI.
    const binDir = join(parent, "stamp-bin");
    mkdirSync(binDir, { recursive: true });
    const shim = join(binDir, "arggon");
    writeFileSync(
      shim,
      `#!/bin/sh\nexec "${process.execPath}" "${join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs")}" "${join(repoRoot, "cli", "src", "cli.ts")}" "$@"\n`,
      "utf8",
    );
    chmodSync(shim, 0o755);

    // A hermetic HOME: the plugin supervisor resolves plugin ids globally and
    // keeps the FIRST registration, so a machine-global
    // `~/.config/opencode/plugins/arggon/index.ts` (this box has one) shadows
    // the fixture's vendored bundle with "Duplicate plugin ID: arggon" and every
    // check below would silently exercise the wrong plugin. An empty HOME keeps
    // every global plugin, MCP server and config out of the run.
    const home = join(parent, "home");
    mkdirSync(home, { recursive: true });
    const port = await freePort();
    serve = spawn(bin, ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: worktree,
      env: {
        ...process.env,
        HOME: home,
        XDG_CONFIG_HOME: join(home, ".config"),
        XDG_DATA_HOME: join(home, ".local", "share"),
        XDG_STATE_HOME: join(home, ".local", "state"),
        XDG_CACHE_HOME: join(home, ".cache"),
        ARGON_ITEM: undefined,
        PWD: worktree,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const append = (chunk: Buffer): void => {
      acc.text += chunk.toString();
      if (acc.text.length > 256 * 1024) acc.text = acc.text.slice(-128 * 1024);
    };
    serve.stdout.on("data", append);
    serve.stderr.on("data", append);
    const ready = await pollUntil(
      () => servePassword(acc.text) !== undefined && servePort(acc.text) !== undefined,
      SERVE_TIMEOUT_MS,
      100,
    );
    if (!ready)
      throw new Error(`opencode serve did not become ready\nlog: ${acc.text.slice(-2_000)}`);
    serverBase = `http://127.0.0.1:${port}`;
    serverPassword = servePassword(acc.text) ?? "";
    const base = serverBase;
    const password = serverPassword;

    const createSession = async (directory: string, title: string): Promise<string | undefined> => {
      const created = await opencodeApi(base, password, "POST", "/api/session", {
        title,
        model: { providerID: PROVIDER_ID, id: MODEL_ID },
        location: { directory },
      });
      const id = (created.json as { data?: { id?: string } } | undefined)?.data?.id;
      if (id !== undefined) sessions.push(id);
      return id;
    };

    // 2. A session in the worktree: the stamp rides the admitted prompt.
    const sessionID = await createSession(worktree, "stamp smoke worktree");
    if (sessionID === undefined) {
      check(
        report,
        "the host hosted a session rooted at the item worktree",
        false,
        `status dump: ${JSON.stringify(provider.requests())}`,
      );
      return;
    }
    // The session record's own location is what the hook resolves its directory
    // from (2.0.26: the plugin instance is loaded from the project's canonical
    // checkout, so `ctx.location.directory` would name the primary — the exact
    // reason the stamp resolves per session).
    const locationView = await opencodeApi(base, password, "GET", `/api/session/${sessionID}`);
    const sessionDirectory = (
      locationView.json as { data?: { location?: { directory?: string } } } | undefined
    )?.data?.location?.directory;
    check(
      report,
      "the host's session record answers location.directory with the item worktree",
      sessionDirectory === worktree,
      `observed: ${String(sessionDirectory)}\nexpected: ${worktree}`,
    );

    // The plugin identity under test. The supervisor resolves plugin ids
    // globally and keeps the FIRST registration, so a machine-global
    // `~/.config/opencode/plugins/arggon/index.ts` would shadow this fixture's
    // copy with "Duplicate plugin ID: arggon" and every check below would
    // silently exercise the wrong plugin. Three things pin it down: the fixture
    // carries the committed artifact byte for byte, the serve log carries no
    // duplicate-id failure, and (decisively) the stamp/retention checks only
    // pass when THIS bundle's T4 hooks run.
    const vendored = readFileSync(
      join(worktree, ".opencode", "plugins", "arggon", "index.ts"),
      "utf8",
    );
    const committed = readFileSync(
      fileURLToPath(new URL("../opencode/plugins/arggon/index.bundle.ts", import.meta.url)),
      "utf8",
    );
    check(
      report,
      "the fixture carries the committed bundle byte for byte and no plugin id was shadowed",
      vendored === committed &&
        vendored.includes("onPromptAdmission") &&
        !acc.text.includes("Duplicate plugin ID"),
      `vendored bytes: ${vendored.length}; committed bytes: ${committed.length}`,
    );

    const submitted = "admit this prompt with a stamp";
    const admitted = await opencodeApi(base, password, "POST", `/api/session/${sessionID}/prompt`, {
      text: submitted,
      metadata: { caller: "smoke", keep: 7 },
    });
    const payload = (admitted.json as { data?: { payload?: Record<string, unknown> } } | undefined)
      ?.data?.payload;
    check(
      report,
      "the admitted prompt carries the env-contract stamp and preserves the caller metadata",
      promptPayloadFaults(payload, submitted, { caller: "smoke", keep: 7 }).length === 0 &&
        admissionStampFaults((payload?.metadata as Record<string, unknown> | undefined)?.arggon, {
          item: ITEM_ID,
          branch: ITEM_BRANCH,
          worktreePath: worktree,
          worktreeId: `repo-stamp-${ITEM_ID}`,
        }).length === 0,
      JSON.stringify(payload),
    );
    check(
      report,
      "the rewrite contract: the submitted prompt text is byte-identical and delivery stays steer",
      payload?.text === submitted &&
        (admitted.json as { data?: { delivery?: string } }).data?.delivery === "steer",
      JSON.stringify(admitted.json),
    );

    // 3. A second admission overwrites the stamp instead of accumulating one.
    const second = await opencodeApi(base, password, "POST", `/api/session/${sessionID}/prompt`, {
      text: "second admission",
    });
    const secondPayload = (
      second.json as { data?: { payload?: Record<string, unknown> } } | undefined
    )?.data?.payload;
    const stamped = (secondPayload?.metadata as Record<string, unknown> | undefined)?.arggon;
    check(
      report,
      "a second admission re-stamps (one stamp, not an accumulation)",
      stamped !== undefined &&
        admissionStampFaults(stamped, {
          item: ITEM_ID,
          branch: ITEM_BRANCH,
          worktreePath: worktree,
          worktreeId: `repo-stamp-${ITEM_ID}`,
        }).length === 0,
      JSON.stringify(secondPayload),
    );

    // 4. Compaction retention: the item block rides the summary request and
    //    the model still writes the summary.
    const compacted = await opencodeApi(
      base,
      password,
      "POST",
      `/api/session/${sessionID}/compact`,
      {},
    );
    const summaryLanded = await pollUntil(
      async () => {
        const view = await opencodeApi(base, password, "GET", `/api/session/${sessionID}/message`);
        const data =
          (view.json as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [];
        return data.some(
          (message) => message.type === "compaction" && message.status === "completed",
        );
      },
      PROMPT_TIMEOUT_MS,
      POLL_MS,
    );
    const messageView = await opencodeApi(
      base,
      password,
      "GET",
      `/api/session/${sessionID}/message`,
    );
    const messages =
      (messageView.json as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [];
    const compactionMessage = messages.find(
      (message) => message.type === "compaction" && message.status === "completed",
    );
    check(
      report,
      "the compaction request carries the item block exactly once and the model still wrote the summary",
      compactionRetentionFaults(provider.requests(), ITEM_ID).length === 0 &&
        compactionMessageFaults(compactionMessage).length === 0,
      `${compactionRetentionFaults(provider.requests(), ITEM_ID).join("; ")} ${compactionMessageFaults(compactionMessage).join("; ")}`,
    );
    check(
      report,
      "the compaction was admitted by the host (the hook did not record it itself)",
      compacted.status === 200 && summaryLanded,
      `compact status ${compacted.status}; summary landed: ${String(summaryLanded)}`,
    );

    // 5. Retention after compaction: the post-compaction agent-loop request
    //    still carries the block.
    const beforeAfter = provider.requests().length;
    await opencodeApi(base, password, "POST", `/api/session/${sessionID}/prompt`, {
      text: "continue after compaction",
    });
    const afterLanded = await pollUntil(
      () => provider.requests().length > beforeAfter,
      PROMPT_TIMEOUT_MS,
      POLL_MS,
    );
    const postCompaction = provider
      .requests()
      .filter((request) => !request.compaction)
      .at(-1);
    check(
      report,
      "the agent-loop request after compaction still carries the item block",
      afterLanded &&
        postCompaction !== undefined &&
        postCompaction.system.includes("<arggon-item>"),
      `requests: ${JSON.stringify(provider.requests().map((request) => request.roles)).slice(0, 300)}`,
    );

    // 6. No polling fallback: an idle window observes no further request.
    const idleStart = Date.now();
    await new Promise((done) => setTimeout(done, IDLE_WINDOW_MS));
    const faults = idleFaults(provider.requests(), idleStart);
    check(
      report,
      `no polling fallback: no provider request in the ${IDLE_WINDOW_MS} ms idle window`,
      faults.length === 0,
      faults.join("; ") || `${provider.requests().length} requests total`,
    );

    // 7. Off-contract silence: the plain primary checkout declares nothing.
    const plainSession = await createSession(repo, "stamp smoke primary");
    const plainAdmitted = await opencodeApi(
      base,
      password,
      "POST",
      `/api/session/${plainSession}/prompt`,
      {
        text: "no worktree here",
      },
    );
    const plainPayload = (
      plainAdmitted.json as { data?: { payload?: Record<string, unknown> } } | undefined
    )?.data?.payload;
    const plainStamp = (plainPayload?.metadata as Record<string, unknown> | undefined)?.arggon;
    check(
      report,
      "outside a worktree declaration the stamp is absent (no empty stamp is written)",
      plainStamp === undefined &&
        promptPayloadFaults(plainPayload, "no worktree here", undefined).length === 0,
      JSON.stringify(plainPayload),
    );

    // 8. Permission rules unchanged: the prompt/compact flow raised no
    //    permission prompt and the bundle declares no permission domain call.
    const permissionView = await opencodeApi(
      base,
      password,
      "GET",
      `/api/session/${sessionID}/permission`,
    );
    const permissionData = (permissionView.json as { data?: unknown[] } | undefined)?.data ?? [];
    const bundleText = readFileSync(
      join(worktree, ".opencode", "plugins", "arggon", "index.ts"),
      "utf8",
    );
    check(
      report,
      "permission rules unchanged: no permission request was raised and the bundle declares no permission call",
      Array.isArray(permissionData) &&
        permissionData.length === 0 &&
        !bundleText.includes("ctx.permission") &&
        !bundleText.includes("permission.rules("),
      `pending: ${JSON.stringify(permissionData).slice(0, 200)}`,
    );
  } finally {
    for (const sessionID of sessions) {
      if (serverBase === "") continue;
      try {
        await opencodeApi(serverBase, serverPassword, "DELETE", `/api/session/${sessionID}`);
      } catch {
        // Best-effort teardown.
      }
    }
    if (serve !== undefined) {
      serve.kill("SIGTERM");
      const force = setTimeout(() => serve?.kill("SIGKILL"), 5_000);
      force.unref?.();
    }
    await provider.close();
    if (existsSync(join(repo, ".git"))) {
      git(repo, ["worktree", "remove", "--force", worktree]);
      git(repo, ["worktree", "prune"]);
    }
    if (!KEEP && existsSync(parent)) rmSync(parent, { recursive: true, force: true });
  }

  if (report.passed) {
    console.log(
      "\nsmoke:opencode-prompt-stamp passed — the admission stamp rides the persisted prompt, " +
        "the compaction request retains the item block, and nothing polls",
    );
    if (KEEP) console.log(`fixture kept: ${parent}`);
    return;
  }
  // The bounded serve-log tail is the first thing a failing run needs: it names
  // the hook that ran (or the one that never did).
  console.error(`\nserve log tail:\n${acc.text.slice(-3_000)}`);
  console.error(
    `\nsmoke:opencode-prompt-stamp FAILED — see the failing checks above` +
      (existsSync(parent) ? ` (fixture kept: ${parent})` : ""),
  );
  process.exitCode = 1;
}

// Direct-run guard: the pure helpers stay importable by the unit test wrapper.
const invokedDirectly = ((): boolean => {
  try {
    return (
      process.argv[1] !== undefined &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(
      `smoke:opencode-prompt-stamp FAILED — ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
