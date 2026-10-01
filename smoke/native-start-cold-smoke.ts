#!/usr/bin/env node
/**
 * task-native-start-cold-smoke: deterministic, model-free cold-start smoke for
 * the native `tools.arggon.start` worktree path
 * (after bug-native-start-worktree-no-install).
 *
 * Why this harness exists
 * -----------------------
 * The native tool path repeatedly produced a cold worktree whose
 * dependency-requiring pre-commit gate could not run: the claim commit never
 * landed while the item looked claimed. The CLI integration tests prove link
 * preparation; this smoke proves the real native seam end to end — offline, no
 * OpenCode runtime, no provider, no quota. `npm run smoke:opencode` and
 * `npm run smoke:opencode:wave` stay the model-driven evidence and are
 * documented as such; this one is the durable, deterministic regression gate.
 *
 * What it drives
 * --------------
 * This checkout's own `opencode/plugins/arggon/index.ts` source (never the
 * vendored bundle — `npm run check:plugin` is what proves the committed bundle
 * is derived from it) with a `ctx.worktree` domain double backed by real
 * `git worktree`, matching the 2.0.10 Git strategy probed for W4: a detached
 * worktree at the start ref, `directory` as the parent, `list` from the git
 * inventory, `remove` with force. The kernel is the workspace build resolved
 * from THIS checkout (`import.meta.resolve`), so a stale primary build can
 * never stand in for the branch's — both paths are printed and asserted. The
 * process is a fresh `tsx` run per invocation, so no long-lived session's
 * module cache can serve a stale plugin build.
 *
 * The scenario
 * ------------
 * 1. a disposable fixture: a git repo whose primary checkout has an initialized
 *    tracker, a project install (`node_modules/native-gate-dep`) and a real,
 *    executable, dependency-requiring `pre-commit` gate that also writes a
 *    marker file;
 * 2. the gate is proven to FAIL in a cold worktree (no `node_modules`) — the
 *    exact failure the bug shipped. Never bypassed: no `--no-verify`, no
 *    skipped hook anywhere in this harness;
 * 3. `tools.arggon.start` on the item: a cold worktree is created through the
 *    domain, its dependencies are prepared, and the claim commit must land with
 *    the gate's marker written inside that worktree — and must contain only the
 *    item file;
 * 4. a second `start` attaches deterministically (no second domain create, no
 *    duplicate claim commit) and every install stays untouched;
 * 4a. strict mode SATISFIED (task-start-gate-strict-mode): arming
 *    `x-tracker.strict-gate-bins` in the fixture's tracker config and claiming
 *    a second item must not change a healthy worktree — the claim lands with
 *    the same worktree-owned `gateBins` receipt (the flag changes the
 *    consequence of a foreign resolution, never the observation);
 * 4a-2. N sequential cold starts (bug-start-install-ordering): five fresh
 *    worktrees in a row on the strict-armed fixture, each with a link farm
 *    laid, the workspace package built and flipped, `gateBins` resolving
 *    inside the worktree, the gate running there, and the claim commit landing
 *    FIRST TRY with the instrumented preparation log naming the path that ran;
 * 5. a second, install-free fixture reproduces BOTH incident flavors of
 *    bug-start-worktree-npm-ci-claim in DEFAULT mode (flag unset): a sibling
 *    checkout's `.bin` on PATH (the masking flavor) and a worktree with no
 *    install anywhere both now REFUSE the claim BEFORE the claim update
 *    (bug-start-install-ordering — a start that created the worktree must
 *    leave a gate-usable install or fail with the named cause); the receipt
 *    still names the foreign `path`/`missing` source and the `npm ci` fix;
 * 5a. strict mode REFUSING (task-start-gate-strict-mode): a third fixture with
 *    the same no-install shape but `x-tracker.strict-gate-bins: true` refuses
 *    with the shipped strict reason — the not-attempted receipt names the
 *    offending bin, its observed source and the `npm ci` fix, the worktree is
 *    kept for the remediation, and the item copy stays unclaimed;
 * 6. the MOVE leg (task-native-session-move-smoke-leg): a REAL OpenCode server
 *    (`opencode serve`, skipped when the binary is absent — CI) hosts a session
 *    on a fourth fixture, `POST /api/session/{id}/move` moves it into an item
 *    worktree, and a SCRIPTED provider (an in-process OpenAI-compatible SSE
 *    server returning canned responses — deterministic, model-free) drives the
 *    session's agent loop through one Code Mode `execute` call running the
 *    native `tools.arggon.comment`. The assertions are behavioral: the host's
 *    own session record answers `location.directory` with the worktree, the
 *    comment commit lands on the item branch IN THE WORKTREE (gate marker
 *    proving the pre-commit hook ran there), and the primary checkout is
 *    untouched — the exact failure the pre-fix code shipped (commits on the
 *    primary's `main`: d24215b9, b65ef7c6, adacc20a). The negative direction
 *    drives the REAL plugin resolver (`sessionDirectoryResolver` +
 *    `resolveToolCwd`) with the host's observed no-record shape for an unknown
 *    session: a typed `SESSION_ROOT_UNRESOLVED` refusal and nothing written.
 *    What stays simulated is documented on the item: the host cannot carry a
 *    tool call for a session it has no record of, so the refusal is driven at
 *    the plugin seam with the host's observed absence, not through a live tool
 *    call; the scripted provider stands in for the model's DECISION, while the
 *    session, the move, the tool execution and the commit are all real.
 * 7. teardown removes the worktrees, their git registrations and the whole
 *    disposable root, and the bounded receipts are asserted along the way.
 *
 * Exit codes: 0 passed; 1 a check failed (the fixture is kept for inspection);
 * 2 the harness could not run (this checkout's kernel build is missing).
 * `git` is a hard prerequisite. `ARGON_NATIVE_START_SMOKE_KEEP=1` keeps the
 * fixture on success too.
 *
 * Pure helpers (`isInside`, `installFingerprint`, `installDrift`,
 * `claimCommitFaults`, `receiptOverBudget`, the move-leg helpers) are exported
 * for `smoke/native-start-cold-smoke.test.ts`; the scenario only runs when this
 * file is the process entrypoint.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
// Type-only: the runtime import below is deliberately dynamic (see main), so a
// checkout whose kernel was never built gets the actionable "build first" line
// instead of a bare ERR_MODULE_NOT_FOUND stack.
import type { ArgonToolDefinition, ArgonKernel } from "../opencode/plugins/arggon/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The item claimed by the smoke, and the branch the convention generates. */
const ITEM_ID = "task-cold-start-smoke";
/** The only dependency the primary checkout's install carries. */
const GATE_DEP = "native-gate-dep";
/** Marker the pre-commit gate appends to, proving it really ran. */
const GATE_MARKER = ".native-gate-ran";
/**
 * The workspace package the fixture carries (bug-start-install-ordering): the
 * worktree owns a copy with NO build output (gitignored), so every cold start
 * must lay the link farm, run the package's own build in the worktree copy and
 * flip the farm entry — the exact ordering the eight-incident record flagged —
 * before the gate can load the package.
 */
const WORKSPACE_PKG = "@cold/libx";
const WORKSPACE_DIR = "libx";
/**
 * How many sequential cold starts the smoke drives (bug-start-install-ordering
 * acceptance: N >= 5, all first-try claims on fresh fixtures, strict armed).
 */
const SEQUENTIAL_COLD_STARTS = 5;
const KEEP = process.env.ARGON_NATIVE_START_SMOKE_KEEP === "1";
const PROJECT_ID = "cold-smoke-project";

// ---------------------------------------------------------------------------
// Move leg (section 6, task-native-session-move-smoke-leg)
// ---------------------------------------------------------------------------

/** The item the move leg claims a worktree branch for. */
const MOVE_ITEM_ID = "task-cold-move-leg";
/** Branch the convention generates for it. */
const MOVE_BRANCH = `feat/${MOVE_ITEM_ID}`;
/** The scripted provider's model id, declared in the fixture's opencode.json. */
const MOVE_MODEL_ID = "cold-move-model";
/** Provider id the fixture config declares for the scripted provider. */
const MOVE_PROVIDER_ID = "scripted";
/** Marker the move fixture's trivial gate appends to, proving it ran. */
const MOVE_GATE_MARKER = ".move-gate-ran";
/** Commit subject the kernel writes for a native comment. */
const MOVE_COMMENT_SUBJECT = `chore(tasks): commented ${MOVE_ITEM_ID}`;
/** Bounded waits: the host answers in seconds when healthy. */
const MOVE_SERVE_TIMEOUT_MS = 30_000;
const MOVE_PROMPT_TIMEOUT_MS = 90_000;
const MOVE_POLL_INTERVAL_MS = 250;
/** A session id the host has no record of (the negative leg's probe). */
const MOVE_UNKNOWN_SESSION = "ses-cold-smoke-unknown";

/**
 * The move fixture's pre-commit gate: trivially passing, but it records the
 * directory it ran in — so the comment commit proves the hook executed inside
 * the worktree, not in the primary.
 */
const MOVE_GATE_SCRIPT = [
  "#!/bin/sh",
  `# task-native-start-cold-smoke move leg: a real, marker-writing gate.`,
  `printf 'move gate ran in %s\\n' "$PWD" >> ${MOVE_GATE_MARKER}`,
  "exit 0",
  "",
].join("\n");

/**
 * The Code Mode script the scripted provider submits through the host's
 * `execute` tool: one native committing call, `tools.arggon.comment`, with the
 * arguments inlined as JSON (so quoting survives any content).
 */
export function codemodeCommentScript(id: string, text: string): string {
  return `return await tools.arggon.comment(${JSON.stringify({ id, text })});`;
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

/** `[arggon] tools: registered N native arggon tools` — the real plugin ran. */
export function serveRegisteredTools(log: string): number | undefined {
  const raw = /registered (\d+) native arggon tools/.exec(log)?.[1];
  const count = raw === undefined ? undefined : Number(raw);
  return count !== undefined && Number.isInteger(count) && count >= 0 ? count : undefined;
}

/** One scripted-provider round: what the host offered and what it answered. */
export type ScriptedRound = {
  call: number;
  offers: string[];
  action:
    | { kind: "tool"; name: string; arguments: { code?: string } }
    | { kind: "text" };
};

/**
 * Faults in the recorded provider rounds (empty = the scripted drive was
 * exactly one `execute` round carrying the native comment script, then a final
 * text round that closed the agent loop).
 */
export function executeCallFaults(rounds: ScriptedRound[], expectedCode: string): string[] {
  const faults: string[] = [];
  const tool = rounds.filter(
    (round): round is ScriptedRound & { action: { kind: "tool"; name: string; arguments: { code?: string } } } =>
      round.action.kind === "tool",
  );
  if (tool.length !== 1) {
    faults.push(`expected exactly 1 tool round, observed ${tool.length}`);
  }
  const execute = tool[0];
  if (execute !== undefined) {
    if (execute.action.name !== "execute") {
      faults.push(`tool round called ${execute.action.name}, expected execute`);
    }
    if (execute.action.arguments.code !== expectedCode) {
      faults.push("the execute round did not carry the expected Code Mode script");
    }
  }
  const lastText = [...rounds].reverse().find((round) => round.action.kind === "text");
  if (lastText === undefined) {
    faults.push("no final text round: the agent loop never closed");
  } else if (execute !== undefined && lastText.call < execute.call) {
    faults.push("the final text round preceded the tool round");
  }
  return faults;
}

/** Everything the move-leg assertions read out of git and the host. */
export type MoveLegObservation = {
  /** Branch checked out in the worktree. */
  branch: string;
  /** The commit subjects on that branch. */
  worktreeSubjects: string[];
  /** Paths of the comment commit. */
  commitPaths: string[];
  /** The item file's content as the commit left it. */
  commitText: string;
  /** The gate marker's content inside the worktree. */
  gateMarker: string | undefined;
  /** The primary's branch head before/after the leg. */
  primaryHeadBefore: string;
  primaryHeadAfter: string;
  /** The primary's porcelain status before/after the leg. */
  primaryPorcelainBefore: string;
  primaryPorcelainAfter: string;
  /** Subjects on the primary's branch (the P1 signature lands here). */
  primarySubjects: string[];
  /** Where the gate was expected to have run. */
  worktreePath: string;
  /** Expected values. */
  expectedBranch: string;
  expectedSubject: string;
  expectedItemPath: string;
  expectedText: string;
};

/** Faults in a move-leg observation (empty = the invariant held). */
export function moveLegFaults(o: MoveLegObservation): string[] {
  const faults: string[] = [];
  if (o.branch !== o.expectedBranch) {
    faults.push(`worktree is on ${o.branch}, expected ${o.expectedBranch}`);
  }
  if (!o.worktreeSubjects.includes(o.expectedSubject)) {
    faults.push(`no "${o.expectedSubject}" commit on the worktree branch`);
  }
  const paths = o.commitPaths.filter((path) => path !== "");
  if (paths.length !== 1 || paths[0] !== o.expectedItemPath) {
    faults.push(`commit touches [${paths.join(", ")}], expected only ${o.expectedItemPath}`);
  }
  if (!o.commitText.includes(o.expectedText)) {
    faults.push("the committed item file does not carry the scripted comment");
  }
  if (o.gateMarker !== `move gate ran in ${o.worktreePath}`) {
    faults.push(`gate marker is ${JSON.stringify(o.gateMarker)}, expected the hook to run in the worktree`);
  }
  if (o.primaryHeadBefore !== o.primaryHeadAfter) {
    faults.push(`primary HEAD moved: ${o.primaryHeadBefore} -> ${o.primaryHeadAfter}`);
  }
  if (o.primaryPorcelainBefore !== o.primaryPorcelainAfter) {
    faults.push(
      `primary porcelain changed:\nbefore: ${JSON.stringify(o.primaryPorcelainBefore)}\nafter: ${JSON.stringify(o.primaryPorcelainAfter)}`,
    );
  }
  if (o.primarySubjects.includes(o.expectedSubject)) {
    faults.push("the P1 signature: the comment commit landed on the primary's branch");
  }
  return faults;
}

/**
 * The scripted provider: an in-process OpenAI-compatible STREAMING chat
 * completions server with a two-round state machine — the first round that is
 * offered tools gets one `execute` tool call carrying the Code Mode script
 * (the native committing comment); any round that already carries a tool
 * result gets the closing text; requests without tools (session title
 * generation) get plain text. No model, no outbound network: the host
 * connects to 127.0.0.1.
 */
export type ScriptedProvider = {
  port: number;
  target: { id: string; text: string };
  /** The rounds the host drove, in order. */
  rounds(): ScriptedRound[];
  close(): Promise<void>;
};

export function startScriptedProvider(target: { id: string; text: string }): Promise<ScriptedProvider> {
  const rounds: ScriptedRound[] = [];
  let call = 0;
  const server: Server = createHttpServer((req, res) => {
    let body = "";
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => {
      call += 1;
      const parsed = body === "" ? {} : (JSON.parse(body) as Record<string, unknown>);
      const stream = parsed.stream === true;
      const messages = (parsed.messages ?? []) as Array<{ role?: string }>;
      const offers = ((parsed.tools ?? []) as Array<{ function?: { name?: string }; name?: string }>)
        .map((tool) => tool?.function?.name ?? tool?.name)
        .filter((name): name is string => typeof name === "string");
      const hasToolResult = messages.some((message) => message.role === "tool");
      const action: ScriptedRound["action"] =
        offers.length > 0 && !hasToolResult
          ? {
              kind: "tool",
              name: "execute",
              arguments: { code: codemodeCommentScript(target.id, target.text) },
            }
          : { kind: "text" };
      rounds.push({ call, offers, action });

      const id = `chatcmpl-scripted-${call}`;
      const created = Math.floor(Date.now() / 1000);
      const model = typeof parsed.model === "string" ? parsed.model : MOVE_MODEL_ID;
      res.writeHead(200, {
        "content-type": stream ? "text/event-stream" : "application/json",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
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
      if (action.kind === "tool") {
        chunk({ role: "assistant", content: null }, null);
        chunk(
          {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: `call_scripted_${call}`,
                type: "function",
                function: { name: action.name, arguments: JSON.stringify(action.arguments) },
              },
            ],
          },
          null,
        );
        chunk({}, "tool_calls");
      } else {
        chunk({ role: "assistant", content: "scripted done" }, null);
        chunk({}, "stop");
      }
      res.write("data: [DONE]\n\n");
      res.end();
    });
  });
  return new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        address !== null && typeof address === "object" ? address.port : undefined;
      if (port === undefined) {
        rejectPromise(new Error("the scripted provider could not bind a port"));
        return;
      }
      resolvePromise({
        port,
        target,
        rounds: () => rounds.map((round) => structuredClone(round)),
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

/**
 * The gate installed in the fixture's primary checkout. It resolves a package
 * that only that checkout's install carries, so a cold worktree fails the
 * commit — and it records the directory it ran in, which is how the smoke
 * proves the gate executed inside the freshly prepared worktree.
 */
const GATE_SCRIPT = [
  "#!/bin/sh",
  `# task-native-start-cold-smoke: a real, dependency-requiring pre-commit gate.`,
  `if ! node -e "require('${GATE_DEP}')" >/dev/null 2>&1; then`,
  `  echo "cold-start gate: dependency ${GATE_DEP} is not installed" >&2`,
  "  exit 1",
  "fi",
  `# The workspace package must resolve to the WORKTREE's own build (the link`,
  `# farm was flipped after the pre-build) — the primary's copy reports a`,
  `# different build directory and fails here (bug-start-install-ordering).`,
  `if ! node -e "const v = require('${WORKSPACE_PKG}'); process.exit(v === 'built in ' + process.cwd() ? 0 : 1)" >/dev/null 2>&1; then`,
  `  echo "cold-start gate: ${WORKSPACE_PKG} is not the worktree's own build" >&2`,
  "  exit 1",
  "fi",
  `printf 'gate ran in %s\\n' "$PWD" >> ${GATE_MARKER}`,
  "",
].join("\n");

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in smoke/native-start-cold-smoke.test.ts)
// ---------------------------------------------------------------------------

/** True when `path` is `root` itself or lives under it. */
export function isInside(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`));
}

/**
 * What an install looks like right now: its entry count, a digest of the
 * entry names and the directory mtime, so comparing two fingerprints of the
 * SAME install is the honest "the primary was not touched" assertion. The count
 * and the digest are the load-bearing signals (an install that was emptied,
 * reified or swapped moves both); the mtime adds the reification case where
 * the same names come back re-linked. Two limits are load-bearing and are
 * asserted by the unit test: an mtime is a coarse-clock signal (Linux stamps a
 * directory from the current tick, so a remove-and-refill inside one tick is
 * caught by the count/digest, not by the mtime), and it only ever compares
 * against another fingerprint of the same path, because an mtime belongs to one
 * directory.
 */
export type InstallFingerprint = {
  path: string;
  entries: number;
  names: string;
  mtimeMs: number;
};

/** Fingerprint of `<dir>/node_modules` (throws when there is no install). */
export function installFingerprint(dir: string): InstallFingerprint {
  const modules = join(dir, "node_modules");
  const stat = statSync(modules);
  const names = readdirSync(modules).sort();
  return {
    path: modules,
    entries: names.length,
    names: createHash("sha256").update(names.join("\n")).digest("hex").slice(0, 16),
    mtimeMs: stat.mtimeMs,
  };
}

/** How an install changed between two fingerprints (empty = untouched). */
export function installDrift(before: InstallFingerprint, after: InstallFingerprint): string[] {
  const drift: string[] = [];
  if (before.entries !== after.entries) {
    drift.push(`entry count ${before.entries} -> ${after.entries}`);
  }
  if (before.names !== after.names) {
    drift.push(`entry set changed (${before.names} -> ${after.names})`);
  }
  // An mtime belongs to one directory: two different installs are never
  // "drifted" by their clocks, only by their contents.
  if (before.path === after.path && before.mtimeMs !== after.mtimeMs) {
    drift.push(`mtime ${before.mtimeMs} -> ${after.mtimeMs}`);
  }
  return drift;
}

/** Faults in a claim commit's file list (empty = exactly the item file). */
export function claimCommitFaults(committed: string[], itemPath: string): string[] {
  const faults: string[] = [];
  const extra = committed.filter((path) => path !== itemPath);
  if (extra.length > 0) {
    faults.push(`stages ${extra.length} non-item path(s): ${extra.join(", ")}`);
  }
  if (!committed.includes(itemPath)) {
    faults.push(`does not stage the item file ${itemPath}`);
  }
  return faults;
}

/**
 * Receipt bounds, mirroring the plugin's own caps (MAX_NATIVE_PREPARATION_*,
 * MAX_NATIVE_DETAIL_CHARS). A `node_modules` report must stay bounded however
 * attacker-shaped the install state is.
 */
export const NATIVE_RECEIPT_LIMITS = {
  maxNames: 32,
  maxNameChars: 200,
  maxValueChars: 500,
  maxBytes: 1024,
} as const;

/** Receipt fields over budget (empty = the receipt is bounded). */
export function receiptOverBudget(
  receipt: unknown,
  limits: {
    maxNames: number;
    maxNameChars: number;
    maxValueChars: number;
    maxBytes: number;
  } = NATIVE_RECEIPT_LIMITS,
): string[] {
  const over: string[] = [];
  const strings: Array<{ path: string; value: string }> = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      strings.push({ path, value });
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > limits.maxNames) {
        over.push(`${path} carries ${value.length} names (max ${limits.maxNames})`);
      }
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        walk(entry, path === "" ? key : `${path}.${key}`);
      }
    }
  };
  walk(receipt, "");
  for (const { path, value } of strings) {
    const max = path.endsWith("]") ? limits.maxNameChars : limits.maxValueChars;
    if (value.length > max) over.push(`${path} is ${value.length} chars (max ${max})`);
  }
  const bytes = Buffer.byteLength(JSON.stringify(receipt) ?? "", "utf8");
  if (bytes > limits.maxBytes) over.push(`receipt is ${bytes} bytes (max ${limits.maxBytes})`);
  return over;
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

/** The canonical checkout of this repo (the main worktree), for read-only asserts. */
function canonicalCheckout(): string {
  for (const line of gitOrThrow(repoRoot, ["worktree", "list", "--porcelain"]).split("\n")) {
    if (line.startsWith("worktree ")) return resolve(line.slice("worktree ".length).trim());
  }
  return repoRoot;
}

/**
 * `ctx.worktree` domain double backed by real git: the observable contract of
 * the 2.0.10 Git strategy (detached worktree at the start ref, `directory` is
 * the parent, `list` reads the git inventory, `remove` needs force for a dirty
 * tree). Calls are recorded so the smoke can assert the plugin went through the
 * domain instead of shelling out to `git worktree` itself.
 */
function worktreeDomain(repo: string): {
  domain: {
    create(input: { projectID: string; name: string; directory?: string }): Promise<unknown>;
    list(input: { projectID: string }): Promise<unknown>;
    refresh(input: { projectID: string }): Promise<unknown>;
    remove(input: { projectID: string; directory: string; force?: boolean }): Promise<unknown>;
  };
  calls: { create: string[]; remove: string[] };
} {
  const calls = { create: [] as string[], remove: [] as string[] };
  return {
    calls,
    domain: {
      async create(input) {
        const target = join(String(input.directory ?? repo), input.name);
        gitOrThrow(repo, ["worktree", "add", "--detach", target]);
        calls.create.push(target);
        return { directory: target };
      },
      async list() {
        return gitOrThrow(repo, ["worktree", "list", "--porcelain"])
          .split("\n")
          .filter((line) => line.startsWith("worktree "))
          .map((line) => ({ directory: line.slice("worktree ".length).trim() }));
      },
      async refresh() {
        // The Git strategy has no saved inventory to refresh; nothing to do.
      },
      async remove(input) {
        gitOrThrow(repo, [
          "worktree",
          "remove",
          ...(input.force === true ? ["--force"] : []),
          input.directory,
        ]);
        calls.remove.push(input.directory);
      },
    },
  };
}

/** The disposable root: a temp dir holding the primary checkout + worktrees. */
function makeParent(): string {
  return realpathSync(mkdtempSync(join(tmpdir(), "arggon-native-start-cold-")));
}

/** A dependency only the primary checkout's install carries. */
function writeInstall(repo: string): void {
  const dep = join(repo, "node_modules", GATE_DEP);
  mkdirSync(dep, { recursive: true });
  writeFileSync(
    join(dep, "package.json"),
    `${JSON.stringify(
      { name: GATE_DEP, version: "1.0.0", main: "index.js", bin: { [GATE_DEP]: "./index.js" } },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(dep, "index.js"), "module.exports = 'cold-start gate dependency';\n");
  // The .bin shim npm leaves behind for a package with a `bin` field: the
  // readiness probe's resolution target (bug-start-worktree-npm-ci-claim).
  const binDir = join(repo, "node_modules", ".bin");
  mkdirSync(binDir, { recursive: true });
  writeFileSync(join(binDir, GATE_DEP), `#!/bin/sh\nexit 0\n`, "utf8");
  chmodSync(join(binDir, GATE_DEP), 0o755);
  // The shape npm leaves behind, so the fixture's install is a plausible one.
  writeFileSync(
    join(repo, "node_modules", ".package-lock.json"),
    `${JSON.stringify({ name: GATE_DEP, lockfileVersion: 3, packages: {} }, null, 2)}\n`,
  );
  // The workspace link npm leaves for a workspace package (the shape
  // `primaryWorkspaceLinks` detects, bug-start-install-ordering): the primary
  // install carries `@cold/libx -> ../../libx`.
  const scope = join(repo, "node_modules", "@cold");
  mkdirSync(scope, { recursive: true });
  symlinkSync(`../../${WORKSPACE_DIR}`, join(scope, "libx"), "dir");
  // The primary's own workspace build (the `npm ci` + `prepare` shape): the
  // entry names the build directory, so the gate can tell which copy loaded.
  // Gitignored — a fresh worktree never inherits it, which is what forces the
  // per-worktree pre-build.
  writeFileSync(
    join(repo, WORKSPACE_DIR, "index.js"),
    `module.exports = 'built in ' + ${JSON.stringify(repo)};\n`,
    "utf8",
  );
}

/**
 * The fixture's workspace package source: a build script that emits the
 * package entry naming ITS build directory, so the gate can tell the
 * worktree's own build from the primary's (bug-start-install-ordering). The
 * entry itself is gitignored — a fresh worktree never has it, which is what
 * forces the pre-build ordering.
 */
function writeWorkspacePackage(repo: string): void {
  const pkg = join(repo, WORKSPACE_DIR);
  mkdirSync(pkg, { recursive: true });
  writeFileSync(
    join(pkg, "package.json"),
    `${JSON.stringify(
      {
        name: WORKSPACE_PKG,
        version: "1.0.0",
        main: "index.js",
        scripts: { build: "node build.js" },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(pkg, "build.js"),
    `require("fs").writeFileSync(__dirname + "/index.js", "module.exports = 'built in ' + process.cwd();\\n");\n`,
    "utf8",
  );
}

/** The fixture's project manifest (declares the gate dependency). */
function writeManifest(
  repo: string,
  manifest: Record<string, unknown> = {
    name: "cold-start-smoke-fixture",
    private: true,
    dependencies: { [WORKSPACE_PKG]: "1.0.0" },
    devDependencies: { [GATE_DEP]: "1.0.0" },
  },
): void {
  writeFileSync(join(repo, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

/**
 * The bin-lookup gate: passes ONLY when the `native-gate-dep` binary resolves
 * through the shell's PATH lookup — the lookup a sibling checkout's
 * `node_modules/.bin` on PATH can satisfy even though the worktree's own
 * install resolves nothing (bug-start-worktree-npm-ci-claim, incident 1).
 */
const BIN_GATE_SCRIPT = [
  "#!/bin/sh",
  `# task-native-start-cold-smoke: a PATH-lookup pre-commit gate.`,
  `if ! command -v ${GATE_DEP} >/dev/null 2>&1; then`,
  `  echo "cold-start gate: bin ${GATE_DEP} is not on PATH" >&2`,
  "  exit 1",
  "fi",
  `printf 'bin gate ran in %s\\n' "$PWD" >> ${GATE_MARKER}`,
  "",
].join("\n");

function writePreCommitGate(repo: string, script: string = GATE_SCRIPT): void {
  const hook = join(repo, ".git", "hooks", "pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(hook, script, "utf8");
  chmodSync(hook, 0o755);
}

/**
 * A "sibling worktree": another checkout of the fixture repo with its own
 * install, whose `.bin` lands on PATH for the masking scenario. The absolute
 * path is returned so the receipt's named resolution source can be asserted.
 */
function writeSiblingInstall(parent: string): string {
  const sibling = join(parent, "sibling-checkout");
  const binDir = join(sibling, "node_modules", ".bin");
  mkdirSync(binDir, { recursive: true });
  writeFileSync(join(binDir, GATE_DEP), `#!/bin/sh\nexit 0\n`, "utf8");
  chmodSync(join(binDir, GATE_DEP), 0o755);
  return join(binDir, GATE_DEP);
}

/** Recursively find `<itemId>.md` under `root` (bounded: a four-item tree). */
function findItemFile(root: string, itemId: string): string | null {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === `${itemId}.md`) return full;
    }
  }
  return null;
}

/** The kernel's frontmatter parser, narrowed to what the smoke needs. */
type FrontmatterParser = (raw: string) => { data: Record<string, unknown> };

/** Frontmatter of an item file, as the kernel parses it. */
function readItemData(parseFrontmatter: FrontmatterParser, file: string): Record<string, unknown> {
  if (file === "" || !existsSync(file)) return {};
  return parseFrontmatter(readFileSync(file, "utf8")).data;
}

type Report = { passed: boolean };

function check(report: Report, name: string, ok: boolean, detail?: string): void {
  const suffix =
    ok || detail === undefined ? "" : `\n      ${detail.split("\n").slice(0, 8).join("\n      ")}`;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${suffix}`);
  if (!ok) report.passed = false;
}

// ---------------------------------------------------------------------------
// The move leg (section 6): a real OpenCode server hosts a session, moves it
// into an item worktree, and a scripted (model-free) provider drives one
// committing native tool call through the host's agent loop.
// ---------------------------------------------------------------------------

type PluginModule = typeof import("../opencode/plugins/arggon/index.js");
type RunInit = (input: { dir: string; force: boolean }) => unknown;

/** `opencode --version` succeeds → the binary is usable. */
function opencodeBinary(): string | undefined {
  const probe = spawnSync("opencode", ["--version"], { encoding: "utf8", timeout: 30_000 });
  return probe.error === undefined && probe.status === 0 ? "opencode" : undefined;
}

/** A free localhost port (bound and released; the serve spawn re-binds it). */
function freePort(): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createHttpServer();
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address !== null && typeof address === "object" ? address.port : undefined;
      server.close(() => {
        if (port === undefined) rejectPromise(new Error("no free port"));
        else resolvePromise(port);
      });
    });
  });
}

type ApiResponse = { status: number; json: unknown };

/** One authenticated call against the fixture's OpenCode server. */
async function opencodeApi(
  base: string,
  password: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const text = await response.text();
    let json: unknown = undefined;
    if (text !== "") {
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = text;
      }
    }
    return { status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/** Bounded polling for an eventually-consistent observation. */
async function pollUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  intervalMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() + intervalMs > deadline) return predicate() instanceof Promise ? await predicate() : predicate();
    await new Promise((resolvePromise) => setTimeout(resolvePromise, intervalMs));
  }
}

type ServingOpenCode = {
  child: ReturnType<typeof spawn>;
  base: string;
  password: string;
  /** The accumulated stdout+stderr, updated as the child prints. */
  logText(): string;
};

/** Spawn `opencode serve` in the fixture and wait for the auth + URL lines. */
async function serveOpenCode(
  bin: string,
  cwd: string,
  port: number,
  env: NodeJS.ProcessEnv,
): Promise<ServingOpenCode> {
  const child = spawn(bin, ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // The holder is mutated by the data handlers, so readers via logText() see
  // the live output instead of the snapshot from spawn time.
  const acc = { text: "" };
  const append = (chunk: Buffer): void => {
    acc.text += chunk.toString();
    if (acc.text.length > 256 * 1024) acc.text = acc.text.slice(-128 * 1024);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  const ready = await pollUntil(
    () => servePassword(acc.text) !== undefined && servePort(acc.text) !== undefined,
    MOVE_SERVE_TIMEOUT_MS,
    100,
  );
  if (!ready) {
    child.kill("SIGTERM");
    throw new Error(`opencode serve did not become ready within ${MOVE_SERVE_TIMEOUT_MS}ms\nlog: ${acc.text.slice(-2_000)}`);
  }
  const printedPort = servePort(acc.text);
  if (printedPort !== port) {
    child.kill("SIGTERM");
    throw new Error(`opencode serve printed port ${printedPort}, expected ${port}\nlog: ${acc.text.slice(-2_000)}`);
  }
  return { child, base: `http://127.0.0.1:${port}`, password: servePassword(acc.text) ?? "", logText: () => acc.text };
}

/** Bounded, readable transcript tail for a failed prompt wait. */
async function transcriptDetail(
  base: string,
  password: string,
  sessionID: string,
): Promise<string> {
  try {
    const { json } = await opencodeApi(base, password, "GET", `/api/session/${sessionID}/message`);
    const data = (json as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [];
    const lines: string[] = [];
    for (const message of data.slice(-6)) {
      for (const part of (message.parts ?? []) as Array<Record<string, unknown>>) {
        if (part.type === "tool") {
          const state = (part.state ?? {}) as Record<string, unknown>;
          lines.push(
            `tool ${String(part.tool)}: ${String(state.status)} ${JSON.stringify(state.error ?? "")}`.slice(0, 300),
          );
        } else if (part.type === "text") {
          lines.push(`text: ${String(part.text).slice(0, 120)}`);
        }
      }
      const error = message.error as Record<string, unknown> | undefined;
      if (error !== undefined && error !== null) {
        lines.push(`message error: ${JSON.stringify(error).slice(0, 300)}`);
      }
    }
    return lines.join("\n");
  } catch (error) {
    return `transcript unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** The whole move leg; every check lands on `report`. */
async function runMoveLeg(
  report: Report,
  deps: {
    bin: string;
    parent: string;
    kernel: ArgonKernel;
    plugin: PluginModule;
    runInit: RunInit;
  },
): Promise<void> {
  const { bin, parent, kernel, plugin, runInit } = deps;
  const { runCreate } = kernel;
  const { sessionDirectoryResolver, resolveToolCwd, SESSION_ROOT_UNRESOLVED } = plugin;
  const repoMove = join(parent, "repo-move");
  const worktree = join(parent, `repo-move-${MOVE_ITEM_ID}`);
  const moveText = `move-leg scripted evidence ${Date.now()}`;
  const expectedCode = codemodeCommentScript(MOVE_ITEM_ID, moveText);
  const itemRelPath = (() => {
    runInit({ dir: repoMove, force: false });
    const chain: Array<[string, string, string | undefined, string]> = [
      ["initiative", "Move leg", undefined, "move-leg-initiative"],
      ["epic", "Real host", "move-leg-initiative", "real-host"],
      ["story", "Moved sessions", "real-host", "moved-sessions"],
      ["task", "Session move smoke leg", "moved-sessions", MOVE_ITEM_ID],
    ];
    for (const [type, title, parentId, id] of chain) {
      runCreate({
        cwd: repoMove,
        type: type as "initiative" | "epic" | "story" | "task",
        title,
        ...(parentId !== undefined ? { parent: parentId } : {}),
        ...(id !== "" ? { id } : {}),
      });
    }
    const found = findItemFile(repoMove, MOVE_ITEM_ID);
    if (found === null) throw new Error(`seeded item ${MOVE_ITEM_ID}.md not found in the move fixture`);
    return relative(repoMove, found).split(sep).join("/");
  })();

  const provider = await startScriptedProvider({ id: MOVE_ITEM_ID, text: moveText });
  let serve: ServingOpenCode | undefined;
  let sessionID: string | undefined;
  try {
    // The fixture: tracker + trivial marker gate + the vendored plugin bundle
    // (check:plugin keeps it derived from this checkout's source) + the
    // scripted provider config + the item worktree on its branch.
    gitOrThrow(repoMove, ["init", "-q", "-b", "main"]);
    gitOrThrow(repoMove, ["config", "user.email", "cold-smoke@example.test"]);
    gitOrThrow(repoMove, ["config", "user.name", "Cold Start Smoke"]);
    gitOrThrow(repoMove, ["config", "maintenance.auto", "false"]);
    writePreCommitGate(repoMove, MOVE_GATE_SCRIPT);
    const pluginDir = join(repoMove, ".opencode", "plugins", "arggon");
    mkdirSync(pluginDir, { recursive: true });
    copyFileSync(
      fileURLToPath(new URL("../opencode/plugins/arggon/index.bundle.ts", import.meta.url)),
      join(pluginDir, "index.ts"),
    );
    writeFileSync(
      join(repoMove, "opencode.json"),
      `${JSON.stringify(
        {
          $schema: "https://opencode.ai/config.json",
          provider: {
            [MOVE_PROVIDER_ID]: {
              npm: "@ai-sdk/openai-compatible",
              name: "Scripted",
              options: { baseURL: `http://127.0.0.1:${provider.port}/v1`, apiKey: "sk-scripted" },
              models: { [MOVE_MODEL_ID]: { name: "Scripted Model" } },
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    gitOrThrow(repoMove, ["add", "-A"]);
    gitOrThrow(repoMove, ["commit", "-qm", "chore: move-leg fixture (plugin + scripted provider)"]);
    gitOrThrow(repoMove, ["worktree", "add", "-b", MOVE_BRANCH, worktree]);
    check(
      report,
      "the move fixture carries the vendored plugin and its worktree is on the item branch",
      existsSync(join(worktree, ".opencode", "plugins", "arggon", "index.ts")) &&
        gitOrThrow(worktree, ["rev-parse", "--abbrev-ref", "HEAD"]).trim() === MOVE_BRANCH,
      `worktree: ${worktree}`,
    );

    // The primary's invariant baseline, taken before the host does anything.
    const primaryHeadBefore = gitOrThrow(repoMove, ["rev-parse", "HEAD"]).trim();
    const primaryPorcelainBefore = gitOrThrow(repoMove, [
      "status",
      "--porcelain",
      "--untracked-files=all",
    ]);
    const primarySubjectsBefore = gitOrThrow(repoMove, ["log", "--format=%s", "refs/heads/main"])
      .split("\n")
      .map((line) => line.trim());

    // The bin shim: the plugin's CLI fallbacks (item views) resolve THIS
    // checkout's CLI, like smoke:opencode's fixtures do.
    const binDir = join(parent, "move-bin");
    mkdirSync(binDir, { recursive: true });
    const shim = join(binDir, "arggon");
    writeFileSync(
      shim,
      `#!/bin/sh\nexec "${process.execPath}" "${join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs")}" "${join(repoRoot, "cli", "src", "cli.ts")}" "$@"\n`,
      "utf8",
    );
    chmodSync(shim, 0o755);

    const port = await freePort();
    serve = await serveOpenCode(bin, repoMove, port, {
      ...process.env,
      ARGON_ITEM: undefined,
      PWD: repoMove,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    });
    const { base, password } = serve;

    // 1. a real session on the primary checkout.
    const created = await opencodeApi(base, password, "POST", "/api/session", {
      model: { providerID: MOVE_PROVIDER_ID, id: MOVE_MODEL_ID },
      location: { directory: repoMove },
    });
    sessionID = (created.json as { data?: { id?: string } } | undefined)?.data?.id;
    if (sessionID === undefined) {
      check(report, "the real OpenCode server hosts a session rooted at the fixture primary", false, `status ${created.status}`);
      return;
    }
    const readLocation = async (): Promise<string | undefined> => {
      const view = await opencodeApi(base, password, "GET", `/api/session/${sessionID}`);
      return (view.json as { data?: { location?: { directory?: string } } })?.data?.location
        ?.directory;
    };
    const locationBefore = await readLocation();
    check(
      report,
      "the real OpenCode server hosts a session rooted at the fixture primary",
      created.status === 200 && locationBefore === repoMove,
      `status ${created.status}\nsession ${sessionID}\nlocation: ${String(locationBefore)}`,
    );

    // 2. the real move: the host re-roots the session into the worktree. The
    // re-rooting is also what loads the moved project's plugin (the
    // registration line follows the move, not the create — observed on
    // 2.0.21), so its check comes after this.
    const moved = await opencodeApi(base, password, "POST", `/api/session/${sessionID}/move`, {
      directory: worktree,
    });
    // The move is eventually consistent server-side: poll the record briefly
    // instead of racing the first read.
    await pollUntil(async () => (await readLocation()) === worktree, 10_000, 200);
    const locationAfter = await readLocation();
    check(
      report,
      "the host moved the session and its record answers location.directory with the worktree (the link resolveToolCwd reads per call)",
      moved.status === 204 && locationAfter === worktree,
      `move status ${moved.status}\nlocation: ${String(locationAfter)}\nexpected: ${worktree}`,
    );
    const registered = await pollUntil(
      () => serveRegisteredTools(serve.logText()) !== undefined,
      15_000,
      200,
    );
    check(
      report,
      "the real host loaded the vendored plugin and registered the native tools",
      registered && serveRegisteredTools(serve.logText()) !== undefined,
      `registered: ${String(serveRegisteredTools(serve.logText()))}`,
    );

    // 3. the scripted drive: one Code Mode execute round calling the native
    // comment tool, then the closing text round.
    const primaryHeadAtPrompt = gitOrThrow(repoMove, ["rev-parse", "HEAD"]).trim();
    await opencodeApi(base, password, "POST", `/api/session/${sessionID}/prompt`, {
      text: "append the scripted comment to the item",
    });
    const itemFile = join(worktree, ...itemRelPath.split("/"));
    const landed = await pollUntil(
      () =>
        provider.rounds().some((round) => round.action.kind === "tool") &&
        existsSync(itemFile) &&
        gitOrThrow(worktree, ["log", "--format=%s", MOVE_BRANCH])
          .split("\n")
          .map((line) => line.trim())
          .includes(MOVE_COMMENT_SUBJECT),
      MOVE_PROMPT_TIMEOUT_MS,
      MOVE_POLL_INTERVAL_MS,
    );
    if (!landed) {
      check(
        report,
        "the scripted drive produced the comment commit in the worktree",
        false,
        `rounds: ${JSON.stringify(provider.rounds()).slice(0, 600)}\n${await transcriptDetail(base, password, sessionID)}`,
      );
      return;
    }

    // 4. the behavioral assertions: the commit is on the item branch in the
    // worktree, the gate ran there, and the primary is untouched.
    const commentHash = gitOrThrow(worktree, ["log", "--format=%H %s", MOVE_BRANCH])
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.endsWith(MOVE_COMMENT_SUBJECT))
      ?.split(" ")[0];
    const commitPaths =
      commentHash === undefined
        ? []
        : gitOrThrow(worktree, ["show", "--name-only", "--pretty=format:", commentHash])
            .split("\n")
            .map((line) => line.trim());
    const commitText =
      commentHash === undefined ? "" : gitOrThrow(worktree, ["show", `${commentHash}:${itemRelPath}`]);
    const observation: MoveLegObservation = {
      branch: gitOrThrow(worktree, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(),
      worktreeSubjects: gitOrThrow(worktree, ["log", "--format=%s", MOVE_BRANCH])
        .split("\n")
        .map((line) => line.trim()),
      commitPaths,
      commitText,
      gateMarker: existsSync(join(worktree, MOVE_GATE_MARKER))
        ? readFileSync(join(worktree, MOVE_GATE_MARKER), "utf8").trim()
        : undefined,
      primaryHeadBefore: primaryHeadAtPrompt,
      primaryHeadAfter: gitOrThrow(repoMove, ["rev-parse", "HEAD"]).trim(),
      primaryPorcelainBefore,
      primaryPorcelainAfter: gitOrThrow(repoMove, ["status", "--porcelain", "--untracked-files=all"]),
      primarySubjects: gitOrThrow(repoMove, ["log", "--format=%s", "refs/heads/main"])
        .split("\n")
        .map((line) => line.trim()),
      worktreePath: worktree,
      expectedBranch: MOVE_BRANCH,
      expectedSubject: MOVE_COMMENT_SUBJECT,
      expectedItemPath: itemRelPath,
      expectedText: moveText,
    };
    const faults = moveLegFaults(observation);
    check(
      report,
      "the commit leg: the scripted native call committed to the item branch IN the worktree; the primary is untouched",
      faults.length === 0 &&
        primaryHeadBefore === primaryHeadAtPrompt &&
        !primarySubjectsBefore.includes(MOVE_COMMENT_SUBJECT),
      faults.join("; ") || `commit ${commentHash} on ${observation.branch}`,
    );
    check(
      report,
      "the scripted drive was exactly one execute round with the native comment script, then a closing text round",
      executeCallFaults(provider.rounds(), expectedCode).length === 0,
      executeCallFaults(provider.rounds(), expectedCode).join("; ") ||
        JSON.stringify(provider.rounds()).slice(0, 400),
    );

    // 5. the negative direction: the host has no record of an unknown session
    // (observed over the same server API), and the REAL plugin resolver +
    // per-call root resolution refuse it with the typed code — writing
    // nothing, anywhere.
    const unknown = await opencodeApi(base, password, "GET", `/api/session/${MOVE_UNKNOWN_SESSION}`);
    const worktreeHeadBeforeNegative = gitOrThrow(worktree, ["rev-parse", "HEAD"]).trim();
    const resolver = sessionDirectoryResolver({
      session: { get: async () => undefined },
    });
    const throwingResolver = sessionDirectoryResolver({
      session: {
        get: async () => {
          throw new Error("host storage unavailable");
        },
      },
    });
    const refusal = await resolveToolCwd(kernel, "comment", { cwd: repoMove, sessionDirectory: resolver }, {
      sessionID: MOVE_UNKNOWN_SESSION,
    });
    const refusalThrowing = await resolveToolCwd(
      kernel,
      "comment",
      { cwd: repoMove, sessionDirectory: throwingResolver },
      { sessionID: MOVE_UNKNOWN_SESSION },
    );
    const refusalCode =
      "error" in refusal ? refusal.error.code : "(resolved unexpectedly)";
    const refusalMessage = "error" in refusal ? refusal.error.message : "";
    const throwingCode =
      "error" in refusalThrowing ? refusalThrowing.error.code : "(resolved unexpectedly)";
    const negativeFaults: string[] = [];
    if (unknown.status !== 404) negativeFaults.push(`unknown session returned ${unknown.status}, expected 404`);
    if (refusalCode !== SESSION_ROOT_UNRESOLVED) {
      negativeFaults.push(`resolver refusal code ${refusalCode}, expected ${SESSION_ROOT_UNRESOLVED}`);
    }
    if (throwingCode !== SESSION_ROOT_UNRESOLVED) {
      negativeFaults.push(`throwing-resolver refusal code ${throwingCode}, expected ${SESSION_ROOT_UNRESOLVED}`);
    }
    if (!refusalMessage.includes(MOVE_UNKNOWN_SESSION) || !refusalMessage.includes(repoMove)) {
      negativeFaults.push("the refusal does not name the session and the refused fallback location");
    }
    if (gitOrThrow(worktree, ["rev-parse", "HEAD"]).trim() !== worktreeHeadBeforeNegative) {
      negativeFaults.push("the negative round moved the worktree HEAD");
    }
    if (gitOrThrow(repoMove, ["rev-parse", "HEAD"]).trim() !== primaryHeadBefore) {
      negativeFaults.push("the negative round moved the primary HEAD");
    }
    if (gitOrThrow(repoMove, ["status", "--porcelain", "--untracked-files=all"]) !== primaryPorcelainBefore) {
      negativeFaults.push("the negative round dirtied the primary");
    }
    check(
      report,
      "the negative leg: an unresolvable session root is refused with SESSION_ROOT_UNRESOLVED and nothing is written anywhere",
      negativeFaults.length === 0,
      negativeFaults.join("; ") || `unknown session: HTTP ${unknown.status}; refusal code ${refusalCode}`,
    );
  } finally {
    // Local teardown: the session record, the server process, the provider
    // socket, the worktree + its registration. Best-effort — a failure here
    // must not mask the checks.
    try {
      if (sessionID !== undefined && serve !== undefined) {
        await opencodeApi(serve.base, serve.password, "DELETE", `/api/session/${sessionID}`);
      }
    } catch {
      // Best-effort: the disposable parent is removed regardless.
    }
    if (serve !== undefined) {
      serve.child.kill("SIGTERM");
      const force = setTimeout(() => serve?.child.kill("SIGKILL"), 5_000);
      force.unref?.();
    }
    await provider.close();
    if (existsSync(join(repoMove, ".git"))) {
      git(repoMove, ["worktree", "remove", "--force", worktree]);
      git(repoMove, ["worktree", "prune"]);
    }
  }
}

// ---------------------------------------------------------------------------
// The scenario
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("smoke:native-start-cold — native tools.arggon.start cold worktree check");

  // Hermetic git: a machine-global `core.hooksPath` (or signing/identity
  // defaults) would silently move the fixture's pre-commit gate or fail its
  // commits. Set once for this process, so the plugin's own `git` calls inherit
  // it too.
  const nullConfig = process.platform === "win32" ? "NUL" : "/dev/null";
  process.env.GIT_CONFIG_GLOBAL = nullConfig;
  process.env.GIT_CONFIG_SYSTEM = nullConfig;

  const pluginSource = realpathSync(
    fileURLToPath(new URL("../opencode/plugins/arggon/index.ts", import.meta.url)),
  );
  // The plugin, the kernel and the CLI's own `init` are loaded dynamically on
  // purpose: all three resolve `@arggondev/lib` at import time, so a checkout
  // whose kernel was never built would otherwise die with a bare
  // ERR_MODULE_NOT_FOUND stack instead of the actionable line below.
  type PluginModule = typeof import("../opencode/plugins/arggon/index.js");
  let plugin: PluginModule | undefined;
  let kernel: ArgonKernel | undefined;
  let runInit: (input: { dir: string; force: boolean }) => unknown;
  try {
    plugin = await import("../opencode/plugins/arggon/index.js");
    kernel = await plugin.loadArgonKernel();
    if (kernel === undefined) throw new Error("@arggondev/lib is not loadable from this checkout");
    ({ runInit } = await import("../cli/src/init.js"));
  } catch (error) {
    console.error(
      "smoke:native-start-cold FAILED — the kernel build this smoke needs is missing " +
        `(${error instanceof Error ? error.message.split("\n")[0] : String(error)}). ` +
        `Build this checkout first: npm run build (it produces ${join(repoRoot, "lib", "dist")}).`,
    );
    process.exitCode = 2;
    return;
  }
  const { argonToolDefinitions, pluginTemplatesDir } = plugin;
  const { parseFrontmatter, runCreate } = kernel;
  let kernelPath: string;
  try {
    kernelPath = fileURLToPath(import.meta.resolve("@arggondev/lib"));
  } catch {
    console.error(
      "smoke:native-start-cold FAILED — @arggondev/lib is not resolvable from this checkout",
    );
    process.exitCode = 2;
    return;
  }
  const report: Report = { passed: true };
  console.log(`runtime: plugin ${pluginSource}`);
  console.log(`runtime: kernel ${kernelPath}`);
  check(
    report,
    "the runtime is this checkout's own plugin source and kernel build (no stale vendored/primary copy)",
    isInside(repoRoot, pluginSource) && isInside(repoRoot, kernelPath),
    `plugin ${pluginSource}\nkernel ${kernelPath}\ncheckout ${repoRoot}`,
  );

  const canonical = canonicalCheckout();
  const canonicalBefore = installFingerprint(canonical);
  const checkoutBefore = gitOrThrow(repoRoot, ["status", "--porcelain", "--untracked-files=all"]);

  const parent = makeParent();
  const repo = join(parent, "repo");
  mkdirSync(repo);
  let worktree = join(parent, `repo-${ITEM_ID}`);
  /** Worktrees of the failure-flavor fixtures (section 4b), for teardown. */
  const extraWorktrees: string[] = [];
  /** Additional worktrees of the MAIN fixture (section 4a), for teardown. */
  const repoOwnedWorktrees: string[] = [];
  /** Worktrees of the strict fixture (section 5a), for teardown. */
  const strictWorktrees: string[] = [];
  /** The no-install fixture repo that owns the section-4b worktrees. */
  const repoNoInstall = join(parent, "repo-no-install");
  /** The strict fixture repo that owns the section-5a worktrees. */
  const repoStrict = join(parent, "repo-strict");
  console.log(`fixture: ${parent}`);
  try {
    // --- 1. the fixture: tracker, primary install, real pre-commit gate ----
    runInit({ dir: repo, force: false });
    const chain: Array<[string, string, string | undefined, string]> = [
      ["initiative", "Native start", undefined, "native-start"],
      ["epic", "Worktree", "native-start", "worktree"],
      ["story", "Cold start", "worktree", "cold-start"],
      ["task", "Native start cold smoke", "cold-start", "cold-start-smoke"],
      // Claimed only in section 4a, after the strict flag is armed: strict
      // mode must not change a healthy worktree (task-start-gate-strict-mode).
      ["task", "Strict mode satisfied", "cold-start", "cold-strict-happy"],
      // Claimed by the N-sequential-cold-start loop (4a-2,
      // bug-start-install-ordering): every one first-try, strict armed.
      ...Array.from(
        { length: SEQUENTIAL_COLD_STARTS },
        (_, index) =>
          ["task", `Sequential cold start ${index + 1}`, "cold-start", `cold-seq-${index + 1}`] as [
            string,
            string,
            string | undefined,
            string,
          ],
      ),
    ];
    for (const [type, title, parentId, id] of chain) {
      runCreate({
        cwd: repo,
        type: type as "initiative" | "epic" | "story" | "task",
        title,
        ...(parentId !== undefined ? { parent: parentId } : {}),
        ...(id !== "" ? { id } : {}),
      });
    }
    writeFileSync(
      join(repo, ".gitignore"),
      `node_modules/\n${WORKSPACE_DIR}/index.js\n.arggon.env\n`,
      "utf8",
    );
    writeManifest(repo);
    writeWorkspacePackage(repo);
    gitOrThrow(repo, ["init", "-q"]);
    gitOrThrow(repo, ["config", "user.email", "cold-smoke@example.test"]);
    gitOrThrow(repo, ["config", "user.name", "Cold Start Smoke"]);
    gitOrThrow(repo, ["config", "maintenance.auto", "false"]);
    gitOrThrow(repo, ["add", "-A"]);
    gitOrThrow(repo, ["commit", "-qm", "chore: fixture"]);
    writeInstall(repo);
    writePreCommitGate(repo);
    const itemFile = findItemFile(repo, ITEM_ID);
    if (itemFile === null) throw new Error(`seeded item ${ITEM_ID}.md not found in the fixture`);
    const itemPath = relative(repo, itemFile).split(sep).join("/");
    const fixtureBefore = installFingerprint(repo);
    check(
      report,
      "the fixture primary checkout has a project install and a dependency-requiring pre-commit gate",
      existsSync(join(repo, "node_modules", GATE_DEP, "index.js")) &&
        existsSync(join(repo, ".git", "hooks", "pre-commit")) &&
        // Executable, not merely present: git only runs a hook it can exec.
        (statSync(join(repo, ".git", "hooks", "pre-commit")).mode & 0o111) === 0o111,
      `item: ${itemPath}\ninstall: ${fixtureBefore.path} (${fixtureBefore.entries} entries)\ngate: ${join(repo, ".git", "hooks", "pre-commit")} (mode ${(statSync(join(repo, ".git", "hooks", "pre-commit")).mode & 0o777).toString(8)})`,
    );

    // --- 2. the gate really needs the dependency (the shipped failure) -----
    const probe = join(parent, "cold-probe");
    gitOrThrow(repo, ["worktree", "add", "--detach", probe]);
    writeFileSync(join(probe, "cold-probe.txt"), "cold\n", "utf8");
    gitOrThrow(probe, ["add", "--", "cold-probe.txt"]);
    const coldCommit = git(probe, ["commit", "-qm", "probe: commit in a cold worktree"]);
    check(
      report,
      "a cold worktree has no install, and the gate fails its commit there (no --no-verify)",
      !existsSync(join(probe, "node_modules")) &&
        coldCommit.code !== 0 &&
        coldCommit.stderr.includes(`dependency ${GATE_DEP} is not installed`) &&
        !existsSync(join(probe, GATE_MARKER)),
      `exit ${coldCommit.code}\nstderr: ${coldCommit.stderr.trim()}`,
    );
    gitOrThrow(repo, ["worktree", "remove", "--force", probe]);
    check(report, "the cold-probe worktree is removed again", !existsSync(probe), probe);

    // --- 3. the native start path on a cold worktree ----------------------
    const { domain, calls } = worktreeDomain(repo);
    const defs: ArgonToolDefinition[] = argonToolDefinitions(kernel, {
      cwd: repo,
      templatesDir: pluginTemplatesDir(),
      worktree: { projectID: PROJECT_ID, canonical: repo, domain },
    });
    const start = (id: string = ITEM_ID): Promise<{ output: Record<string, unknown> }> => {
      const definition = defs.find((candidate) => candidate.name === "start");
      if (definition === undefined) throw new Error("the native namespace has no start tool");
      return definition.execute(
        { id, assignee: "cold-smoke" },
        {
          sessionID: "cold-smoke",
        },
      ) as Promise<{ output: Record<string, unknown> }>;
    };

    let first: Record<string, unknown>;
    try {
      first = (await start()).output;
    } catch (error) {
      // A native start failure is a typed tool error carrying the envelope. The
      // bug this smoke guards is exactly this shape (a cold worktree whose gate
      // could not run), so report the receipt fields, never a raw dump.
      const envelope = ((error as { envelope?: unknown }).envelope ?? {}) as Record<
        string,
        unknown
      >;
      const failure = (envelope.error ?? {}) as Record<string, unknown>;
      throw new Error(
        [
          `native start failed (${String(failure.code ?? "no code")}): ${String(failure.message ?? error)}`,
          `preparation: ${JSON.stringify(envelope.preparation ?? null)}`,
          `claimCommitted: ${String(envelope.claimCommitted)}`,
          `claimCommit: ${JSON.stringify(envelope.claimCommit ?? null)}`,
        ].join("\n"),
      );
    }
    worktree = String(first.worktreePath);
    const preparation = (first.preparation ?? {}) as Record<string, unknown>;
    const claimCommit = (first.claimCommit ?? {}) as Record<string, unknown>;
    check(
      report,
      "start creates the cold worktree through the domain and claims the item there",
      first.ok === true &&
        first.worktreeCreated === true &&
        worktree === join(parent, `repo-${ITEM_ID}`) &&
        calls.create.length === 1 &&
        first.branch === `feat/${ITEM_ID}`,
      `worktree: ${worktree}\nbranch: ${String(first.branch)}\ndomain create calls: ${calls.create.length}`,
    );
    check(
      report,
      "the dependency preparation is explicit and ready before the claim commit",
      preparation.ready === true &&
        preparation.install === "linked" &&
        preparation.linkedNodeModules === true &&
        Array.isArray(preparation.linkedWorkspaces) &&
        preparation.linkedWorkspaces.length === 0,
      `preparation: ${JSON.stringify(preparation)}`,
    );
    const gateBins = (preparation.gateBins ?? []) as Array<Record<string, unknown>>;
    check(
      report,
      "the readiness receipt names the gate bin as resolving INSIDE the worktree (bug-start-worktree-npm-ci-claim)",
      gateBins.length === 1 &&
        gateBins[0].name === GATE_DEP &&
        gateBins[0].source === "worktree" &&
        typeof gateBins[0].path === "string" &&
        String(gateBins[0].path).startsWith(worktree),
      `gateBins: ${JSON.stringify(gateBins)}\nworktree: ${worktree}`,
    );
    const builtWorkspaces = (preparation.builtWorkspaces ?? []) as string[];
    const prepSteps = (preparation.steps ?? []) as Array<Record<string, unknown>>;
    check(
      report,
      "the preparation log names the path that ran: farm laid, workspace built and flipped, probe verdict (bug-start-install-ordering)",
      Array.isArray(prepSteps) &&
        prepSteps.some((entry) => entry.step === "link" && entry.outcome === "farm-created") &&
        prepSteps.some(
          (entry) =>
            entry.step === "build" && entry.outcome === "built" && entry.pkg === WORKSPACE_PKG,
        ) &&
        prepSteps.some((entry) => entry.step === "gate-bins" && entry.outcome === "all-worktree"),
      `steps: ${JSON.stringify(prepSteps)}\nbuilt: ${JSON.stringify(builtWorkspaces)}`,
    );
    check(
      report,
      "the workspace package was built in the worktree and the farm entry flipped to it (the incident ordering, end to end)",
      builtWorkspaces.includes(WORKSPACE_PKG) &&
        existsSync(join(worktree, WORKSPACE_DIR, "index.js")) &&
        lstatSync(join(worktree, "node_modules", "@cold", "libx")).isSymbolicLink() === true &&
        realpathSync(join(worktree, "node_modules", "@cold", "libx")).startsWith(worktree),
      `built: ${JSON.stringify(builtWorkspaces)}\nfarm entry: ${realpathSync(join(worktree, "node_modules", "@cold", "libx"))}`,
    );
    check(
      report,
      "the readiness/claim-commit receipt stays bounded",
      receiptOverBudget(preparation).length === 0 && receiptOverBudget(first.commit).length === 0,
      `preparation: ${receiptOverBudget(preparation).join("; ")}\ncommit: ${receiptOverBudget(first.commit).join("; ")}`,
    );
    check(
      report,
      "the claim commit landed and the gate ran in the worktree it prepared",
      first.claimCommitted === true &&
        claimCommit.status === "committed" &&
        typeof claimCommit.hash === "string" &&
        existsSync(join(worktree, GATE_MARKER)) &&
        readFileSync(join(worktree, GATE_MARKER), "utf8").trim() === `gate ran in ${worktree}`,
      `claimCommit: ${JSON.stringify(claimCommit)}\nmarker: ${readFileSync(join(worktree, GATE_MARKER), "utf8").trim()}`,
    );
    const committed = gitOrThrow(worktree, ["show", "--name-only", "--pretty=format:", "HEAD"])
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    check(
      report,
      "the claim commit contains only the item file",
      claimCommitFaults(committed, itemPath).length === 0,
      `commit paths: ${committed.join(", ")}\nexpected only: ${itemPath}\nworktree status: ${gitOrThrow(worktree, ["status", "--porcelain"]).trim()}`,
    );
    check(
      report,
      "the worktree's prepared install is untracked and never committed",
      !committed.some((path) => path === "node_modules" || path.startsWith("node_modules/")) &&
        existsSync(join(worktree, "node_modules", GATE_DEP, "index.js")),
      `node_modules -> ${realpathSync(join(worktree, "node_modules"))}`,
    );
    check(
      report,
      "the fixture primary install is untouched by the claim commit",
      installDrift(fixtureBefore, installFingerprint(repo)).length === 0,
      installDrift(fixtureBefore, installFingerprint(repo)).join("; "),
    );
    check(
      report,
      "the canonical checkout's install is untouched (never emptied or reified)",
      installDrift(canonicalBefore, installFingerprint(canonical)).length === 0,
      `${canonicalBefore.path}: ${canonicalBefore.entries} entries before\ndrift: ${installDrift(canonicalBefore, installFingerprint(canonical)).join("; ") || "none"}`,
    );

    // --- 3b. the worktree env contract (spec worktree-env-contract-016) ---
    const envReceipt = (preparation.env ?? {}) as Record<string, unknown>;
    const envPath = join(worktree, ".arggon.env");
    const envRaw = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
    const envLines = envRaw.split("\n");
    const envKeys = envLines
      .filter((line) => line.includes("="))
      .map((line) => line.slice(0, line.indexOf("=")));
    const envValue = (key: string): string =>
      envLines.find((line) => line.startsWith(`${key}=`))?.slice(key.length + 1) ?? "";
    const stateDir = envValue("ARGGON_STATE_DIR");
    const cacheDir = envValue("ARGGON_CACHE_DIR");
    check(
      report,
      "the env contract: .arggon.env written with exactly the six documented keys",
      envReceipt.written === true &&
        JSON.stringify(envReceipt.keys) ===
          JSON.stringify([
            "ARGON_ITEM",
            "ARGGON_WORKTREE_ID",
            "ARGGON_WORKTREE_PATH",
            "ARGGON_WORKTREE_BRANCH",
            "ARGGON_STATE_DIR",
            "ARGGON_CACHE_DIR",
          ]) &&
        envLines[envLines.length - 1] === "" &&
        envKeys.join(",") === envReceipt.keys?.join(","),
      `receipt: ${JSON.stringify(envReceipt)}\nfile: ${JSON.stringify(envRaw)}`,
    );
    check(
      report,
      "the env contract: identity values match the worktree (id, dir, path, branch)",
      envValue("ARGON_ITEM") === ITEM_ID &&
        envValue("ARGGON_WORKTREE_ID") === `repo-${ITEM_ID}` &&
        envValue("ARGGON_WORKTREE_PATH") === worktree &&
        envValue("ARGGON_WORKTREE_BRANCH") === `feat/${ITEM_ID}`,
      `ARGON_ITEM=${envValue("ARGON_ITEM")}\nARGGON_WORKTREE_ID=${envValue("ARGGON_WORKTREE_ID")}\nARGGON_WORKTREE_BRANCH=${envValue("ARGGON_WORKTREE_BRANCH")}`,
    );
    check(
      report,
      "the env contract: per-OS state/cache dirs exist and carry the worktree suffix",
      stateDir.endsWith(`repo-${ITEM_ID}`) &&
        cacheDir.endsWith(`repo-${ITEM_ID}`) &&
        stateDir !== "" &&
        cacheDir !== "" &&
        existsSync(stateDir) &&
        existsSync(cacheDir),
      `ARGGON_STATE_DIR=${stateDir} (exists: ${existsSync(stateDir)})\nARGGON_CACHE_DIR=${cacheDir} (exists: ${existsSync(cacheDir)})`,
    );
    check(
      report,
      "the env contract: the gitignore probe reports the fixture rule, and the claim commit stays env-free",
      envReceipt.gitignored === true && !committed.some((path) => path === ".arggon.env"),
      `gitignored: ${String(envReceipt.gitignored)}\ncommit paths: ${committed.join(", ")}`,
    );

    // --- 4. re-running start attaches, without a duplicate claim commit ----
    const headAfterFirst = gitOrThrow(worktree, ["rev-parse", "HEAD"]).trim();
    const markerAfterFirst = readFileSync(join(worktree, GATE_MARKER), "utf8").trim().split("\n");
    const envBeforeAttach = readFileSync(envPath, "utf8");
    const second = (await start()).output;
    const headAfterSecond = gitOrThrow(worktree, ["rev-parse", "HEAD"]).trim();
    const claimCommits = gitOrThrow(worktree, ["log", "--format=%s", `refs/heads/feat/${ITEM_ID}`])
      .split("\n")
      .filter((subject) => subject === `chore(tasks): claimed ${ITEM_ID}`).length;
    check(
      report,
      "a second start attaches to the same worktree (one domain create, no re-creation)",
      second.ok === true &&
        second.worktreeCreated === false &&
        second.worktreePath === worktree &&
        calls.create.length === 1,
      `worktree: ${String(second.worktreePath)}\ndomain create calls: ${calls.create.length}`,
    );
    const markerLines = readFileSync(join(worktree, GATE_MARKER), "utf8").trim().split("\n").length;
    check(
      report,
      "the re-run adds no duplicate claim commit",
      second.claimCommitted === true &&
        (second.claimCommit as Record<string, unknown> | undefined)?.status === "not-needed" &&
        headAfterSecond === headAfterFirst &&
        claimCommits === 1,
      `HEAD ${headAfterFirst.slice(0, 8)} -> ${headAfterSecond.slice(0, 8)}\nclaim commits on branch: ${claimCommits}\nclaimCommitted: ${String(second.claimCommitted)}\ngate marker lines: ${markerAfterFirst.length} -> ${markerLines} (git runs the pre-commit hook on the empty attempt too, so a second line proves the gate was never bypassed, not a second commit)\nreceipt: ${JSON.stringify(second.claimCommit)}`,
    );
    {
      // The attach's preparation log names the reuse decisions
      // (bug-start-install-ordering): the install already exists (never
      // re-laid), the workspace entry is already importable (never rebuilt).
      const secondSteps = (((second.preparation ?? {}) as Record<string, unknown>).steps ??
        []) as Array<Record<string, unknown>>;
      check(
        report,
        "the attach re-run's preparation log names the reuse (install present, workspace entry exists)",
        secondSteps.some(
          (entry) => entry.step === "link" && entry.outcome === "worktree-install-present",
        ) &&
          secondSteps.some(
            (entry) =>
              entry.step === "build" &&
              entry.outcome === "entry-exists" &&
              entry.pkg === WORKSPACE_PKG,
          ),
        `steps: ${JSON.stringify(secondSteps)}`,
      );
    }
    {
      // Attach env contract (spec worktree-env-contract-016): the existing
      // .arggon.env is left byte-identical and the receipt says so.
      const secondEnv = (((second.preparation ?? {}) as Record<string, unknown>).env ??
        {}) as Record<string, unknown>;
      check(
        report,
        "the attach re-run leaves .arggon.env byte-identical (never overwritten) and reports it",
        secondEnv.written === false &&
          typeof secondEnv.warning === "string" &&
          secondEnv.warning.includes("byte-identical") &&
          readFileSync(envPath, "utf8") === envBeforeAttach,
        `receipt: ${JSON.stringify(secondEnv)}\nfile unchanged: ${readFileSync(envPath, "utf8") === envBeforeAttach}`,
      );
    }
    const claimed = readItemData(parseFrontmatter, findItemFile(worktree, ITEM_ID) ?? "");
    check(
      report,
      "the claim records live in the worktree copy, not in the canonical checkout",
      claimed.status === "in_progress" &&
        claimed.assignee === "cold-smoke" &&
        claimed.branch === `feat/${ITEM_ID}` &&
        claimed.worktree_path === worktree &&
        readItemData(parseFrontmatter, itemFile).status === "todo",
      `worktree copy: ${JSON.stringify(claimed)}\ncanonical copy: ${JSON.stringify(readItemData(parseFrontmatter, itemFile))}`,
    );
    check(
      report,
      "the canonical checkout's install is still untouched after the re-run",
      installDrift(canonicalBefore, installFingerprint(canonical)).length === 0,
      installDrift(canonicalBefore, installFingerprint(canonical)).join("; "),
    );

    // --- 4a. strict mode SATISFIED (task-start-gate-strict-mode) ----------
    // Arm `x-tracker.strict-gate-bins` in the fixture's tracker config and
    // claim a second item: a healthy worktree (the farm resolves the gate bin
    // worktree-locally) must start exactly as before — same receipt, same
    // claim commit. The flag changes the CONSEQUENCE of a foreign resolution,
    // never the observation, and never a satisfied worktree.
    const strictHappyId = "task-cold-strict-happy";
    const strictHappyConfig = join(repo, "ArggonManager", ".convention.yml");
    writeFileSync(
      strictHappyConfig,
      `${readFileSync(strictHappyConfig, "utf8")}x-tracker:\n  strict-gate-bins: true\n`,
      "utf8",
    );
    gitOrThrow(repo, ["add", "ArggonManager/.convention.yml"]);
    gitOrThrow(repo, ["commit", "-qm", "chore: arm the strict gate-bin gate"]);
    const strictHappy = (await start(strictHappyId)).output;
    const strictHappyWorktree = String(strictHappy.worktreePath);
    repoOwnedWorktrees.push(strictHappyWorktree);
    const strictHappyPreparation = (strictHappy.preparation ?? {}) as Record<string, unknown>;
    const strictHappyBins = (strictHappyPreparation.gateBins ?? []) as Array<
      Record<string, unknown>
    >;
    check(
      report,
      "strict mode satisfied: with the flag armed a worktree-owned gate bin still commits the claim",
      strictHappy.ok === true &&
        strictHappy.claimCommitted === true &&
        strictHappy.worktreeCreated === true &&
        strictHappyPreparation.ready === true &&
        strictHappyBins.length === 1 &&
        strictHappyBins[0].name === GATE_DEP &&
        strictHappyBins[0].source === "worktree" &&
        String(strictHappyBins[0].path).startsWith(strictHappyWorktree),
      `gateBins: ${JSON.stringify(strictHappyBins)}\nworktree: ${strictHappyWorktree}`,
    );
    check(
      report,
      "strict mode satisfied: the claim commit is the only one on the strict-happy branch",
      gitOrThrow(strictHappyWorktree, ["log", "--format=%s", `refs/heads/feat/${strictHappyId}`])
        .split("\n")
        .filter((subject) => subject === `chore(tasks): claimed ${strictHappyId}`).length === 1,
      gitOrThrow(strictHappyWorktree, ["log", "--format=%s", `refs/heads/feat/${strictHappyId}`]),
    );

    // --- 4a-2. N sequential cold starts, all first-try (bug-start-install-ordering)
    // The acceptance this item adds: five fresh worktrees IN A ROW on the
    // strict-armed fixture, each one leaving a gate-usable install (farm laid,
    // workspace pre-built and flipped), gateBins resolving inside the
    // worktree, and the claim commit landing FIRST TRY — with the
    // instrumented preparation log naming the path that ran every time.
    for (let index = 1; index <= SEQUENTIAL_COLD_STARTS; index++) {
      const seqId = `task-cold-seq-${index}`;
      const seq = (await start(seqId)).output;
      const seqWorktree = String(seq.worktreePath);
      repoOwnedWorktrees.push(seqWorktree);
      const seqPreparation = (seq.preparation ?? {}) as Record<string, unknown>;
      const seqBins = (seqPreparation.gateBins ?? []) as Array<Record<string, unknown>>;
      const seqSteps = (seqPreparation.steps ?? []) as Array<Record<string, unknown>>;
      const seqClaim = (seq.claimCommit ?? {}) as Record<string, unknown>;
      const seqCommitted = gitOrThrow(seqWorktree, [
        "show",
        "--name-only",
        "--pretty=format:",
        "HEAD",
      ])
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "");
      const seqItemFile = findItemFile(repo, seqId);
      if (seqItemFile === null) throw new Error(`seeded item ${seqId}.md not found in the fixture`);
      check(
        report,
        `sequential cold start ${index}/${SEQUENTIAL_COLD_STARTS}: fresh worktree, farm laid, workspace built, gate ran, claim first try (strict armed)`,
        seq.ok === true &&
          seq.worktreeCreated === true &&
          seqPreparation.ready === true &&
          seqPreparation.install === "linked" &&
          (seqPreparation.builtWorkspaces as string[]).includes(WORKSPACE_PKG) &&
          seqSteps.some((entry) => entry.step === "link" && entry.outcome === "farm-created") &&
          seqSteps.some(
            (entry) =>
              entry.step === "build" && entry.outcome === "built" && entry.pkg === WORKSPACE_PKG,
          ) &&
          seqSteps.some(
            (entry) => entry.step === "gate-bins" && entry.outcome === "all-worktree",
          ) &&
          seqBins.length === 1 &&
          seqBins[0].name === GATE_DEP &&
          seqBins[0].source === "worktree" &&
          String(seqBins[0].path).startsWith(seqWorktree) &&
          seq.claimCommitted === true &&
          seqClaim.status === "committed" &&
          readFileSync(join(seqWorktree, GATE_MARKER), "utf8").trim() ===
            `gate ran in ${seqWorktree}` &&
          claimCommitFaults(seqCommitted, relative(repo, seqItemFile).split(sep).join("/"))
            .length === 0 &&
          receiptOverBudget(seqPreparation).length === 0,
        `gateBins: ${JSON.stringify(seqBins)}\nsteps: ${JSON.stringify(seqSteps)}\nclaim: ${JSON.stringify(seqClaim)}\ncommit paths: ${seqCommitted.join(", ")}`,
      );
    }

    // --- 4b. BOTH failure flavors are named by the readiness report --------
    // bug-start-worktree-npm-ci-claim: two independent incidents. Flavor 1
    // (wrong resolution source): a sibling checkout's `.bin` on PATH ran the
    // gate while the worktree resolved nothing — the claim landed and the
    // broken install stayed invisible. Flavor 2 (missing install): no
    // install anywhere, and the claim commit died with a bare
    // `tsx: command not found`. Both fixtures below have NO install at all;
    // only PATH differs.
    const pathItemId = "task-cold-bin-path";
    const missingItemId = "task-cold-bin-missing";
    const pathWorktree = join(parent, `repo-no-install-${pathItemId}`);
    const missingWorktree = join(parent, `repo-no-install-${missingItemId}`);
    extraWorktrees.push(pathWorktree, missingWorktree);
    {
      runInit({ dir: repoNoInstall, force: false });
      const chain2: Array<[string, string, string | undefined, string]> = [
        ["initiative", "Bin resolution", undefined, "bin-resolution"],
        ["epic", "Cold flavors", "bin-resolution", "cold-flavors"],
        ["story", "Named failures", "cold-flavors", "named-failures"],
        ["task", "Sibling path masking", "named-failures", "cold-bin-path"],
        ["task", "Missing install", "named-failures", "cold-bin-missing"],
      ];
      for (const [type, title, parentId, id] of chain2) {
        runCreate({
          cwd: repoNoInstall,
          type: type as "initiative" | "epic" | "story" | "task",
          title,
          ...(parentId !== undefined ? { parent: parentId } : {}),
          ...(id !== "" ? { id } : {}),
        });
      }
      // No workspace package here: the manifest declares only the gate dep.
      writeManifest(repoNoInstall, {
        name: "cold-start-smoke-fixture-no-install",
        private: true,
        devDependencies: { [GATE_DEP]: "1.0.0" },
      });
      gitOrThrow(repoNoInstall, ["init", "-q"]);
      gitOrThrow(repoNoInstall, ["config", "user.email", "cold-smoke@example.test"]);
      gitOrThrow(repoNoInstall, ["config", "user.name", "Cold Start Smoke"]);
      gitOrThrow(repoNoInstall, ["config", "maintenance.auto", "false"]);
      gitOrThrow(repoNoInstall, ["add", "-A"]);
      gitOrThrow(repoNoInstall, ["commit", "-qm", "chore: fixture (no install)"]);
      // The gate looks the binary up through the shell (PATH), like `npm run`
      // resolves `tsx` — never bypassed, no --no-verify anywhere.
      writePreCommitGate(repoNoInstall, BIN_GATE_SCRIPT);

      const { domain: domain2 } = worktreeDomain(repoNoInstall);
      const defs2: ArgonToolDefinition[] = argonToolDefinitions(kernel, {
        cwd: repoNoInstall,
        templatesDir: pluginTemplatesDir(),
        worktree: { projectID: PROJECT_ID, canonical: repoNoInstall, domain: domain2 },
      });
      const start2 = (id: string): Promise<{ output: Record<string, unknown> }> => {
        const definition = defs2.find((candidate) => candidate.name === "start");
        if (definition === undefined) throw new Error("the native namespace has no start tool");
        return definition.execute(
          { id, assignee: "cold-smoke" },
          { sessionID: "cold-smoke" },
        ) as Promise<{ output: Record<string, unknown> }>;
      };
      const preparationOf = (envelope: Record<string, unknown>): Record<string, unknown> =>
        (envelope.preparation ?? {}) as Record<string, unknown>;
      const gateBinsOf = (envelope: Record<string, unknown>): Array<Record<string, unknown>> =>
        (preparationOf(envelope).gateBins ?? []) as Array<Record<string, unknown>>;

      // Flavor 1: the sibling's bin masks the absent worktree install — the
      // gate USED to pass through the PATH lookup and the claim landed on the
      // broken environment (incident 1). A start that created the worktree now
      // REFUSES the claim before the claim update, naming the sibling
      // (bug-start-install-ordering).
      const savedPath = process.env.PATH ?? "";
      const siblingBin = writeSiblingInstall(parent);
      process.env.PATH = `${dirname(siblingBin)}:${savedPath}`;
      let maskedEnvelope: Record<string, unknown> = {};
      let maskedError = "";
      try {
        await start2(pathItemId);
        maskedError = "start unexpectedly succeeded";
      } catch (error) {
        maskedEnvelope = ((error as { envelope?: unknown }).envelope ?? {}) as Record<
          string,
          unknown
        >;
        const failure = (maskedEnvelope.error ?? {}) as Record<string, unknown>;
        maskedError = String(failure.message ?? error);
      } finally {
        process.env.PATH = savedPath;
      }
      const maskedBins = gateBinsOf(maskedEnvelope);
      const maskedClaim = (maskedEnvelope.claimCommit ?? {}) as Record<string, unknown>;
      check(
        report,
        "flavor 1 (wrong resolution source): the sibling .bin on PATH no longer ships a broken worktree — the fresh start refuses, naming the source",
        maskedEnvelope.ok === false &&
          maskedEnvelope.claimCommitted === false &&
          maskedClaim.status === "not-attempted" &&
          maskedClaim.reason === "fresh-worktree install gate refused" &&
          preparationOf(maskedEnvelope).ready === false &&
          preparationOf(maskedEnvelope).install === "missing" &&
          maskedBins.length === 1 &&
          maskedBins[0].name === GATE_DEP &&
          maskedBins[0].source === "path" &&
          maskedBins[0].path === siblingBin &&
          maskedError.includes(`resolves only via PATH from ${siblingBin}`) &&
          maskedError.includes("fresh worktree must leave a gate-usable install") &&
          maskedError.includes("npm ci") &&
          existsSync(pathWorktree) &&
          readItemData(parseFrontmatter, findItemFile(repoNoInstall, pathItemId) ?? "").status ===
            "todo",
        `gateBins: ${JSON.stringify(maskedBins)}\nclaim: ${JSON.stringify(maskedClaim)}\nerror: ${maskedError.split("\n").slice(0, 6).join("\n")}`,
      );

      // Flavor 2: no install anywhere, nothing on PATH — the claim commit used
      // to die with a bare `tsx: command not found` AFTER the claim write; the
      // fresh-worktree install gate now refuses BEFORE any claim, with the
      // named bin and the exact fix.
      let missingEnvelope: Record<string, unknown> = {};
      let missingError = "";
      try {
        await start2(missingItemId);
        missingError = "start unexpectedly succeeded";
      } catch (error) {
        missingEnvelope = ((error as { envelope?: unknown }).envelope ?? {}) as Record<
          string,
          unknown
        >;
        const failure = (missingEnvelope.error ?? {}) as Record<string, unknown>;
        missingError = String(failure.message ?? error);
      }
      const missingBins = gateBinsOf(missingEnvelope);
      const missingClaim = (missingEnvelope.claimCommit ?? {}) as Record<string, unknown>;
      const missingSteps = (preparationOf(missingEnvelope).steps ?? []) as Array<
        Record<string, unknown>
      >;
      check(
        report,
        "flavor 2 (missing install): the fresh start refuses BEFORE the claim, naming the missing bin + the npm ci fix + the preparation log",
        missingEnvelope.ok === false &&
          missingEnvelope.claimCommitted === false &&
          missingClaim.status === "not-attempted" &&
          missingClaim.reason === "fresh-worktree install gate refused" &&
          missingWorktree !== undefined &&
          existsSync(missingWorktree) &&
          preparationOf(missingEnvelope).install === "missing" &&
          missingSteps.some(
            (entry) => entry.step === "link" && entry.outcome === "primary-install-missing",
          ) &&
          missingSteps.some(
            (entry) => entry.step === "gate-bins" && entry.outcome === "foreign-resolution",
          ) &&
          missingBins.length === 1 &&
          missingBins[0].name === GATE_DEP &&
          missingBins[0].source === "missing" &&
          missingBins[0].path === undefined &&
          missingError.includes("not resolvable from the worktree") &&
          missingError.includes("Preparation ran: link:primary-install-missing") &&
          missingError.includes("npm ci") &&
          readItemData(parseFrontmatter, findItemFile(repoNoInstall, missingItemId) ?? "")
            .status === "todo",
        `gateBins: ${JSON.stringify(missingBins)}\nsteps: ${JSON.stringify(missingSteps)}\nerror: ${missingError.split("\n").slice(0, 6).join("\n")}`,
      );
    }

    // --- 5a. strict mode REFUSING (task-start-gate-strict-mode) -----------
    // The same no-install shape as 4b, but with `x-tracker.strict-gate-bins:
    // true` in the tracker config: BOTH flavors must now refuse the claim
    // BEFORE the claim update — the not-attempted receipt names the offending
    // bin, its observed source and the `npm ci` fix, the worktree is kept for
    // the remediation, and the item copy stays unclaimed.
    {
      runInit({ dir: repoStrict, force: false });
      const chain3: Array<[string, string, string | undefined, string]> = [
        ["initiative", "Strict gate", undefined, "strict-gate"],
        ["epic", "Refusals", "strict-gate", "refusals"],
        ["story", "Armed flavors", "refusals", "armed-flavors"],
        ["task", "Strict sibling path", "armed-flavors", "cold-strict-path"],
        ["task", "Strict missing install", "armed-flavors", "cold-strict-missing"],
      ];
      for (const [type, title, parentId, id] of chain3) {
        runCreate({
          cwd: repoStrict,
          type: type as "initiative" | "epic" | "story" | "task",
          title,
          ...(parentId !== undefined ? { parent: parentId } : {}),
          ...(id !== "" ? { id } : {}),
        });
      }
      // No workspace package here either: only the gate dep is declared.
      writeManifest(repoStrict, {
        name: "cold-start-smoke-fixture-strict",
        private: true,
        devDependencies: { [GATE_DEP]: "1.0.0" },
      });
      const strictConfig = join(repoStrict, "ArggonManager", ".convention.yml");
      writeFileSync(
        strictConfig,
        `${readFileSync(strictConfig, "utf8")}x-tracker:\n  strict-gate-bins: true\n`,
        "utf8",
      );
      gitOrThrow(repoStrict, ["init", "-q"]);
      gitOrThrow(repoStrict, ["config", "user.email", "cold-smoke@example.test"]);
      gitOrThrow(repoStrict, ["config", "user.name", "Cold Start Smoke"]);
      gitOrThrow(repoStrict, ["config", "maintenance.auto", "false"]);
      gitOrThrow(repoStrict, ["add", "-A"]);
      gitOrThrow(repoStrict, ["commit", "-qm", "chore: fixture (strict gate armed)"]);
      // The same PATH-lookup gate as 4b: with the flag armed it never even
      // runs — the refusal happens before the claim update.
      writePreCommitGate(repoStrict, BIN_GATE_SCRIPT);

      const { domain: domain3 } = worktreeDomain(repoStrict);
      const defs3: ArgonToolDefinition[] = argonToolDefinitions(kernel, {
        cwd: repoStrict,
        templatesDir: pluginTemplatesDir(),
        worktree: { projectID: PROJECT_ID, canonical: repoStrict, domain: domain3 },
      });
      const start3 = (id: string): Promise<{ output: Record<string, unknown> }> => {
        const definition = defs3.find((candidate) => candidate.name === "start");
        if (definition === undefined) throw new Error("the native namespace has no start tool");
        return definition.execute(
          { id, assignee: "cold-smoke" },
          { sessionID: "cold-smoke" },
        ) as Promise<{ output: Record<string, unknown> }>;
      };
      const refusalOf = (error: unknown): Record<string, unknown> =>
        ((error as { envelope?: unknown }).envelope ?? {}) as Record<string, unknown>;

      const strictPathId = "task-cold-strict-path";
      const strictPathWorktree = join(parent, `repo-strict-${strictPathId}`);
      strictWorktrees.push(strictPathWorktree);
      const savedPath3 = process.env.PATH ?? "";
      const siblingBin3 = join(parent, "sibling-checkout", "node_modules", ".bin", GATE_DEP);
      let strictPathEnvelope: Record<string, unknown> = {};
      let strictPathError = "";
      try {
        process.env.PATH = `${dirname(siblingBin3)}:${savedPath3}`;
        await start3(strictPathId);
        strictPathError = "start unexpectedly succeeded";
      } catch (error) {
        strictPathEnvelope = refusalOf(error);
        const failure = (strictPathEnvelope.error ?? {}) as Record<string, unknown>;
        strictPathError = String(failure.message ?? error);
      } finally {
        process.env.PATH = savedPath3;
      }
      const strictPathBins = (((strictPathEnvelope.preparation ?? {}) as Record<string, unknown>)
        .gateBins ?? []) as Array<Record<string, unknown>>;
      const strictPathClaim = (strictPathEnvelope.claimCommit ?? {}) as Record<string, unknown>;
      check(
        report,
        "strict refused (path flavor): the claim is not attempted and the failure names the bin, the sibling source, and the npm ci fix",
        strictPathEnvelope.ok === false &&
          strictPathEnvelope.claimCommitted === false &&
          strictPathClaim.status === "not-attempted" &&
          strictPathClaim.reason === "strict gate-bin gate refused" &&
          existsSync(strictPathWorktree) &&
          strictPathBins.length === 1 &&
          strictPathBins[0].name === GATE_DEP &&
          strictPathBins[0].source === "path" &&
          strictPathBins[0].path === siblingBin3 &&
          strictPathError.includes("x-tracker.strict-gate-bins is set") &&
          strictPathError.includes("refusing the claim commit") &&
          strictPathError.includes(`resolves only via PATH from ${siblingBin3}`) &&
          strictPathError.includes("npm ci") &&
          strictPathError.includes(strictPathWorktree) &&
          readItemData(parseFrontmatter, findItemFile(strictPathWorktree, strictPathId) ?? "")
            .status === "todo",
        `gateBins: ${JSON.stringify(strictPathBins)}\nclaim: ${JSON.stringify(strictPathClaim)}\nerror: ${strictPathError.split("\n").slice(0, 6).join("\n")}`,
      );

      const strictMissingId = "task-cold-strict-missing";
      const strictMissingWorktree = join(parent, `repo-strict-${strictMissingId}`);
      strictWorktrees.push(strictMissingWorktree);
      let strictMissingEnvelope: Record<string, unknown> = {};
      let strictMissingError = "";
      try {
        await start3(strictMissingId);
        strictMissingError = "start unexpectedly succeeded";
      } catch (error) {
        strictMissingEnvelope = refusalOf(error);
        const failure = (strictMissingEnvelope.error ?? {}) as Record<string, unknown>;
        strictMissingError = String(failure.message ?? error);
      }
      const strictMissingBins = ((
        (strictMissingEnvelope.preparation ?? {}) as Record<string, unknown>
      ).gateBins ?? []) as Array<Record<string, unknown>>;
      const strictMissingClaim = (strictMissingEnvelope.claimCommit ?? {}) as Record<
        string,
        unknown
      >;
      check(
        report,
        "strict refused (missing flavor): the bin-resolves-nowhere case refuses with the same receipt",
        strictMissingEnvelope.ok === false &&
          strictMissingEnvelope.claimCommitted === false &&
          strictMissingClaim.status === "not-attempted" &&
          strictMissingClaim.reason === "strict gate-bin gate refused" &&
          existsSync(strictMissingWorktree) &&
          strictMissingBins.length === 1 &&
          strictMissingBins[0].name === GATE_DEP &&
          strictMissingBins[0].source === "missing" &&
          strictMissingError.includes("native-gate-dep: not resolvable from the worktree") &&
          strictMissingError.includes("npm ci") &&
          readItemData(parseFrontmatter, findItemFile(strictMissingWorktree, strictMissingId) ?? "")
            .status === "todo",
        `gateBins: ${JSON.stringify(strictMissingBins)}\nclaim: ${JSON.stringify(strictMissingClaim)}\nerror: ${strictMissingError.split("\n").slice(0, 6).join("\n")}`,
      );
    }

    // --- 6. the move leg: a real session, really moved, really committing --
    // task-native-session-move-smoke-leg. Deterministic and model-free: the
    // scripted provider (in-process, localhost-only) drives the host's agent
    // loop through one Code Mode `execute` round; the session, the move, the
    // tool execution and the commit are the real host's. Skipped when the
    // `opencode` binary is absent (CI), like smoke:opencode.
    {
      const bin = opencodeBinary();
      if (bin === undefined) {
        check(
          report,
          "move leg skipped: the opencode binary is not installed (CI) — run where OpenCode V2 is available",
          true,
          "the leg is part of npm run smoke:native-start-cold and guards bug-native-tools-commit-to-primary-checkout",
        );
      } else {
        await runMoveLeg(report, { bin, parent, kernel, plugin, runInit });
      }
    }
  } catch (error) {
    report.passed = false;
    console.error(`      harness error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // --- 7. teardown: no worktree, no registration, no leftover process ---
    // Every spawn above is synchronous or awaited by the plugin, so nothing of
    // this run is still running here; what teardown owns is the filesystem and
    // git state. Best-effort by design: a harness error must not mask the
    // checks that already failed.
    const teardownErrors: string[] = [];
    const isRepo = existsSync(join(repo, ".git"));
    const isRepoNoInstall = existsSync(join(repoNoInstall, ".git"));
    const isRepoStrict = existsSync(join(repoStrict, ".git"));
    /** Owning fixture repo of each tracked worktree (`worktree remove` needs it). */
    const ownerOf = (dir: string): string => {
      if (extraWorktrees.includes(dir)) return repoNoInstall;
      if (strictWorktrees.includes(dir)) return repoStrict;
      return repo;
    };
    const allWorktrees = [
      worktree,
      join(parent, "cold-probe"),
      ...repoOwnedWorktrees,
      ...extraWorktrees,
      ...strictWorktrees,
    ];
    for (const dir of allWorktrees) {
      if (!existsSync(dir)) continue;
      const owner = ownerOf(dir);
      // The harness may have died before a fixture repo existed: fall back to
      // a plain recursive remove so teardown still leaves nothing behind.
      if (!existsSync(join(owner, ".git"))) {
        rmSync(dir, { recursive: true, force: true });
        continue;
      }
      const removed = git(owner, ["worktree", "remove", "--force", dir]);
      if (removed.code !== 0)
        teardownErrors.push(`worktree remove ${dir}: ${removed.stderr.trim()}`);
    }
    if (isRepo) {
      const pruned = git(repo, ["worktree", "prune"]);
      if (pruned.code !== 0) teardownErrors.push(`worktree prune: ${pruned.stderr.trim()}`);
    }
    if (isRepoNoInstall) {
      const pruned = git(repoNoInstall, ["worktree", "prune"]);
      if (pruned.code !== 0)
        teardownErrors.push(`worktree prune (no-install): ${pruned.stderr.trim()}`);
    }
    if (isRepoStrict) {
      const pruned = git(repoStrict, ["worktree", "prune"]);
      if (pruned.code !== 0)
        teardownErrors.push(`worktree prune (strict): ${pruned.stderr.trim()}`);
    }
    const registered = isRepo
      ? git(repo, ["worktree", "list", "--porcelain"])
          .stdout.split("\n")
          .filter((line) => line.startsWith("worktree "))
          .map((line) => line.slice("worktree ".length).trim())
          .filter((dir) => resolve(dir) !== resolve(repo))
      : [];
    const registeredNoInstall = isRepoNoInstall
      ? git(repoNoInstall, ["worktree", "list", "--porcelain"])
          .stdout.split("\n")
          .filter((line) => line.startsWith("worktree "))
          .map((line) => line.slice("worktree ".length).trim())
          .filter((dir) => resolve(dir) !== resolve(repoNoInstall))
      : [];
    const registeredStrict = isRepoStrict
      ? git(repoStrict, ["worktree", "list", "--porcelain"])
          .stdout.split("\n")
          .filter((line) => line.startsWith("worktree "))
          .map((line) => line.slice("worktree ".length).trim())
          .filter((dir) => resolve(dir) !== resolve(repoStrict))
      : [];
    const leftover = [
      worktree,
      join(parent, "cold-probe"),
      ...repoOwnedWorktrees,
      ...extraWorktrees,
      ...strictWorktrees,
    ].filter((dir) => existsSync(dir));
    // A failed run keeps its fixture for inspection (the age-gated `arggon-*`
    // tmpdir purge in test/teardown-tmp.ts reclaims it later); a passing run
    // leaves nothing behind at all.
    const keep = !report.passed;
    if (!keep) rmSync(parent, { recursive: true, force: true });
    check(
      report,
      "the worktree and its git registration are gone",
      registered.length === 0 &&
        registeredNoInstall.length === 0 &&
        registeredStrict.length === 0 &&
        leftover.length === 0 &&
        teardownErrors.length === 0,
      [
        ...teardownErrors,
        ...leftover.map((dir) => `left behind: ${dir}`),
        ...registered.map((dir) => `still registered: ${dir}`),
        ...registeredNoInstall.map((dir) => `still registered (no-install fixture): ${dir}`),
        ...registeredStrict.map((dir) => `still registered (strict fixture): ${dir}`),
      ].join("; "),
    );
    if (keep) {
      console.log(`      fixture kept for inspection: ${parent}`);
    } else {
      check(report, "the disposable root is removed", !existsSync(parent), parent);
    }
  }

  // --- 8. the harness wrote nothing outside its disposable root ----------
  const checkoutAfter = gitOrThrow(repoRoot, ["status", "--porcelain", "--untracked-files=all"]);
  check(
    report,
    "this checkout is unchanged (the smoke wrote only inside its disposable root)",
    checkoutAfter === checkoutBefore,
    checkoutAfter === checkoutBefore
      ? "working tree identical before/after"
      : `before:\n${checkoutBefore}\nafter:\n${checkoutAfter}`,
  );
  check(
    report,
    "the canonical checkout's install is untouched after teardown",
    installDrift(canonicalBefore, installFingerprint(canonical)).length === 0,
    installDrift(canonicalBefore, installFingerprint(canonical)).join("; "),
  );

  if (report.passed) {
    console.log(
      "\nsmoke:native-start-cold passed — a cold native start prepared its worktree, " +
        "the dependency-requiring gate ran and the claim commit landed with only the item file",
    );
    if (KEEP) console.log(`fixture kept: ${parent}`);
    return;
  }
  console.error(
    `\nsmoke:native-start-cold FAILED — see the failing checks above` +
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
      `smoke:native-start-cold FAILED — ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
