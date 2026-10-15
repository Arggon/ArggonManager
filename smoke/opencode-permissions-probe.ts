#!/usr/bin/env node
/**
 * Per-runtime permissions probe harness
 * (bug-task-permissions-enforcement-not-observed).
 *
 * The bug this closes: a live session's shell layer was observed ALLOWING
 * `git push --force --dry-run origin HEAD` and `git commit --no-verify -m probe`
 * after the project `permissions` block in `opencode.jsonc` had been repaired —
 * i.e. the block looked unenforced in the client runtimes we actually use. The
 * item's acceptance asks for a PER-RUNTIME answer (which layer honors the
 * block, per client runtime), a carrier decision, and a probe harness wired
 * into the gates.
 *
 * This script is the harness. One denied + one allowed command per supported
 * runtime, each recorded as `command / expected / observed / exit /
 * does-NOT-prove` — the `arggon-verifier` output contract
 * (`ArggonManager/docs/agents.md` §Who proves, who reviews). A probe that
 * cannot run in an environment records a SKIP with its reason; a skip is never
 * a pass, and a probe whose permission layer was never exercised is
 * inconclusive, which fails.
 *
 * Runtimes probed:
 *
 *   opencode-v2-session     a fresh headless `opencode run` on a fixture that
 *                           carries THIS CHECKOUT's `opencode.jsonc` verbatim
 *                           (model-driven).
 *   opencode-v2-config-edit the original observation's mechanism: a session
 *                           started WITHOUT the block, probed, then the block
 *                           written, then the SAME session probed again
 *                           (model-driven).
 *   opencode-v2-service     the desktop app's runtime shape: the same edit on a
 *                           session attached to a long-lived background
 *                           service (model-driven).
 *   zcode-gate              `templates/docs/zcode/arggon/hooks/gate.mjs pre`
 *                           payloads (deterministic, model-free).
 *   claude-gate             `templates/docs/claude/arggon/hooks/gate.mjs pre`
 *                           payloads (deterministic, model-free).
 *   arggon-cli-kernel       the kernel's own refusals: reopen a done item and
 *                           steal a claim; an ordinary comment as the allowed
 *                           control (deterministic, model-free).
 *   arggon-plugin           the vendored plugin's own permission surface:
 *                           structurally NONE — no `config` hook, no permission
 *                           rules — so its tools are filtered by the runtime's
 *                           permission layer and its kernel calls are refused
 *                           by the kernel (deterministic, model-free).
 *
 * Hermetic by construction: temp git repos, a LOCAL bare remote, no network.
 * The model-driven legs additionally serve under a disposable HOME + XDG set
 * (`smoke/opencode-hermetic.ts`), so no machine-global plugin/config/MCP server
 * competes with the fixture, and provider credentials are seeded from the host
 * only for the run.
 *
 * The deterministic legs also run under `npm test`
 * (`smoke/opencode-permissions-probe.test.ts`), so CI exercises the
 * per-runtime table's model-free half; the three V2 legs need the `opencode`
 * binary and provider credentials and are maintainer-run, like
 * `npm run smoke:opencode` (quota-bound).
 *
 * Exit codes: 0 — every leg passed or skipped; 1 — a leg failed (its
 * per-runtime expectation was contradicted) or was inconclusive. Fixtures are
 * kept on failure and with `ARGON_SMOKE_KEEP=1`.
 */
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../cli/src/test-spawn.js";
import {
  createHermeticHome,
  seedHermeticCredentials,
  type HermeticHome,
} from "./opencode-hermetic.js";
import { resolveSmokeModel } from "./opencode-model.js";
import { shellCompleted, shellDenied } from "./opencode-smoke.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The model the model-driven legs resolve (shared pin, overridable). */
const MODEL = resolveSmokeModel();

/** Per-run bound for one headless session (the wave harness uses the same). */
const RUN_TIMEOUT_MS = Number(process.env.OPENCODE_PERM_PROBE_TIMEOUT_MS ?? 600_000);

/** The one denied and the one allowed command every shell-gated runtime gets. */
export const DENIED_COMMAND = "git commit --no-verify -m probe";
export const ALLOWED_COMMAND = "git commit -m probe";

export type ProbeExpectation = "denied" | "allowed";
export type ProbeOutcome = ProbeExpectation | "inconclusive";

/** One probe, recorded the way `arggon-verifier` reports evidence. */
export type ProbeRecord = {
  runtime: string;
  command: string;
  expected: ProbeExpectation;
  observed: string;
  exit: string;
  outcome: ProbeOutcome;
  doesNotProve: string;
};

// ---------------------------------------------------------------------------
// Pure classifiers
// ---------------------------------------------------------------------------

/** `hooks/gate.mjs` denies with exit 2 and one stderr line. */
const GATE_DENY_EXIT = 2;
const GATE_DENY_MARKER = /^arggon gate: denied/u;

/** Kernel refusals: the reopen gate and the claim-steal gate. */
const KERNEL_REFUSAL =
  /must not reopen|never reopened|claim conflict|requires an interactive terminal/u;

/**
 * Provider-side deaths (quota, retired route). A leg that dies here never
 * reached its permission layer, so it is a SKIP, not an inconclusive probe.
 */
const PROVIDER_UNAVAILABLE =
  /provider\.quota|Model unavailable|usage limit exceeded|rate limit|no route/i;

/**
 * Classify one headless session's transcript against the probed command:
 * a refused shell call is the only "denied" evidence (never the model's
 * narrative), a completed shell call is "allowed", and anything else is
 * inconclusive — the permission layer was never exercised.
 */
export function classifySessionTranscript(stdout: string, command: string): ProbeOutcome {
  if (shellDenied(stdout, command)) return "denied";
  if (shellCompleted(stdout, command)) return "allowed";
  return "inconclusive";
}

/** Classify a `hooks/gate.mjs pre` run: exit 2 + the deny line, or exit 0. */
export function classifyGateRun(status: number | null, stderr: string): ProbeOutcome {
  if (status === GATE_DENY_EXIT && GATE_DENY_MARKER.test(stderr.trim())) return "denied";
  if (status === 0 && !GATE_DENY_MARKER.test(stderr)) return "allowed";
  return "inconclusive";
}

/**
 * Classify a kernel run from its `--json` envelope: a refusal envelope is the
 * denial, `ok: true` is the allowed control, anything else inconclusive.
 */
export function classifyKernelRun(stdout: string): ProbeOutcome {
  let envelope: { ok?: unknown; error?: { message?: unknown } };
  try {
    envelope = JSON.parse(stdout) as typeof envelope;
  } catch {
    return "inconclusive";
  }
  if (envelope.ok === false) {
    const message = String(envelope.error?.message ?? "");
    return KERNEL_REFUSAL.test(message) ? "denied" : "inconclusive";
  }
  return envelope.ok === true ? "allowed" : "inconclusive";
}

/** A bounded provider-death reason, or undefined when the run reached the model. */
export function providerSkipReason(stdout: string, stderr: string): string | undefined {
  const extract = (text: string): string | undefined => {
    for (const line of text.split("\n")) {
      if (!line.includes('"type":"error"')) continue;
      try {
        const event = JSON.parse(line) as { error?: { type?: unknown; message?: unknown } };
        const message = String(event.error?.message ?? event.error?.type ?? "");
        if (PROVIDER_UNAVAILABLE.test(message)) return message.slice(0, 160);
      } catch {
        // A line that quotes the marker without parsing is not a provider event.
      }
    }
    return undefined;
  };
  const fromTranscript = extract(stdout);
  if (fromTranscript !== undefined) return fromTranscript;
  return PROVIDER_UNAVAILABLE.test(stderr)
    ? stderr.trim().split("\n")[0]!.slice(0, 160)
    : undefined;
}

/** The session id one `--format json` run created or continued. */
export function sessionIdOf(stdout: string): string | undefined {
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as { sessionID?: unknown };
      if (typeof event.sessionID === "string") return event.sessionID;
    } catch {
      // Not every line is JSON (a provider may print prose); keep scanning.
    }
  }
  return undefined;
}

/** The PreToolUse payload a hook gate consumes, exactly as the clients send it. */
export function gatePrePayload(
  command: string,
  sessionId: string,
  cwd: string,
): Record<string, unknown> {
  return {
    session_id: sessionId,
    tool_name: "Bash",
    tool_input: { command },
    cwd,
  };
}

/**
 * The vendored bundle's own permission surface — pinned as EMPTY.
 *
 * The determination this item records is that the plugin adds no permission
 * surface of its own: it registers tools and session hooks, never a `config`
 * hook (the one surface that could rewrite the effective permission list) and
 * never a runtime permission rule (a second logic path over the same
 * commands). Either addition fails this leg, which is the signal to re-decide
 * the carrier rather than let a second permission surface grow silently.
 */
export function pluginPermissionSurfaceFaults(bundleSource: string): string[] {
  const faults: string[] = [];
  if (/hook\(\s*["']config["']/u.test(bundleSource)) {
    faults.push(
      "the bundle registers a config hook — it can rewrite the effective permission list",
    );
  }
  if (/effect\s*:\s*["'](?:allow|deny)["']/u.test(bundleSource)) {
    faults.push("the bundle declares a runtime permission rule — a second permission surface");
  }
  return faults;
}

/**
 * The pre-block config state: a project config WITHOUT the `permissions` array
 * — the state a session was in before the W4 gates landed (and the state the
 * 2026-10-02 observation was made against).
 */
export function preBlockConfigText(): string {
  return `${JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      compaction: { keep: { tokens: 15000 } },
    },
    null,
    2,
  )}\n`;
}

// ---------------------------------------------------------------------------
// Fixtures (hermetic: temp repos, local bare remote, no network)
// ---------------------------------------------------------------------------

type RunResult = { status: number | null; stdout: string; stderr: string };

type ProbeRepo = {
  dir: string;
  remote: string;
  /** Absolute path of the transcript evidence directory. */
  evidence: string;
  git: (args: string[]) => RunResult;
  writeConfig: (text: string) => void;
  stage: (rel: string) => void;
};

function gitIn(dir: string, remote: string, args: string[]): RunResult {
  const proc = spawnSync("git", args, { cwd: dir, encoding: "utf8", timeout: 120_000 });
  return { status: proc.status, stdout: proc.stdout ?? "", stderr: proc.stderr ?? "" };
}

/** A git repo with identity, a seed commit and a LOCAL bare remote. */
function createProbeRepo(parent: string, name: string, configText: string): ProbeRepo {
  const dir = join(parent, name);
  mkdirSync(dir, { recursive: true });
  const remote = `${dir}-remote.git`;
  const bare = spawnSync("git", ["init", "-q", "--bare", "-b", "main", remote], {
    encoding: "utf8",
  });
  if (bare.status !== 0) throw new Error(`bare remote init failed: ${bare.stderr}`);
  const git = (args: string[]): RunResult => gitIn(dir, remote, args);
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "probe@example.com"]);
  git(["config", "user.name", "permission-probe"]);
  git(["remote", "add", "origin", remote]);
  const repo: ProbeRepo = {
    dir,
    remote,
    evidence: join(dir, ".probe-evidence"),
    git,
    writeConfig: (text: string): void => {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "opencode.jsonc"), text, "utf8");
    },
    stage: (rel: string): void => {
      writeFileSync(join(dir, rel), "probe\n", "utf8");
      git(["add", rel]);
    },
  };
  repo.writeConfig(configText);
  repo.stage("seed.txt");
  git(["commit", "-q", "-m", "seed"]);
  git(["push", "-q", "-u", "origin", "main"]);
  return repo;
}

/** Save a run's transcript beside the fixture for review evidence. */
function saveEvidence(repo: ProbeRepo, label: string, result: RunResult): void {
  mkdirSync(repo.evidence, { recursive: true });
  writeFileSync(join(repo.evidence, `${label}.stdout.jsonl`), result.stdout, "utf8");
  writeFileSync(join(repo.evidence, `${label}.stderr.log`), result.stderr, "utf8");
}

/** The project config under test: this checkout's own `opencode.jsonc`. */
function projectConfigText(): string {
  return readFileSync(join(repoRoot, "opencode.jsonc"), "utf8");
}

/** `opencode --version` token, or undefined when the binary is absent. */
function opencodeVersion(): string | undefined {
  const probe = spawnSync("opencode", ["--version"], { encoding: "utf8", timeout: 30_000 });
  if (probe.error !== undefined || probe.status !== 0) return undefined;
  const output = (probe.stdout ?? "").trim();
  return /v?(\d+\.\d+\.\d+(?:[-\w.]+)?)/u.exec(output)?.[1] ?? (output || undefined);
}

// ---------------------------------------------------------------------------
// Model-driven legs
// ---------------------------------------------------------------------------

function attemptPrompt(command: string): string {
  return [
    `Use the shell tool to run exactly this command and nothing else: ${command}`,
    "Do not use any other tool and do not run any other command.",
    "If the shell tool refuses the call, quote the exact refusal message verbatim.",
  ].join("\n");
}

type ModelLegOptions = { home: HermeticHome; parent: string };

function runSession(
  repo: ProbeRepo,
  home: HermeticHome,
  label: string,
  message: string,
  options: { session?: string; service?: boolean } = {},
): RunResult {
  const args = [
    "run",
    ...(options.service === true ? [] : ["--standalone"]),
    "--print-logs",
    "--log-level",
    "info",
    "--model",
    MODEL,
    "--format",
    "json",
    // `--auto` approves the remaining `ask` rules (a headless run has no
    // client to answer them); configured DENY rules stay enforced, which is
    // what these probes measure.
    "--auto",
  ];
  if (options.session !== undefined) args.push("--session", options.session);
  args.push(message);
  const proc = spawnSync("opencode", args, {
    cwd: repo.dir,
    // PWD must follow cwd: the runtime resolves the project directory from it.
    env: { ...process.env, ...home.env, PWD: repo.dir },
    encoding: "utf8",
    timeout: RUN_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  const result: RunResult = {
    status: proc.status,
    stdout: proc.stdout ?? "",
    stderr: proc.stderr ?? "",
  };
  saveEvidence(repo, label, result);
  return result;
}

/** A first-line, bounded summary of the probed command's observed outcome. */
function observedSummary(stdout: string, command: string): string {
  for (const line of stdout.split("\n")) {
    if (!line.includes('"tool":"shell"')) continue;
    try {
      const event = JSON.parse(line) as {
        part?: {
          state?: {
            status?: unknown;
            error?: unknown;
            output?: unknown;
            input?: { command?: unknown };
          };
        };
      };
      const state = event.part?.state;
      if (state === undefined) continue;
      const ran = String(state.input?.command ?? "");
      if (!ran.includes(command)) continue;
      if (state.status === "error") {
        return `status: "error", ${JSON.stringify(String(state.error ?? "").slice(0, 80))}`;
      }
      if (state.status === "completed") {
        return `status: "completed", ${JSON.stringify(String(state.output ?? "").slice(0, 80))}`;
      }
    } catch {
      // Keep scanning for a parseable shell part.
    }
  }
  return "no shell tool call for the probed command in the transcript";
}

/**
 * True when a run died on the provider (quota, retired route) — it never
 * reached the permission layer, so the leg is a SKIP, not an inconclusive
 * probe.
 */
function providerSkip(run: RunResult): string | undefined {
  return providerSkipReason(run.stdout, run.stderr);
}

/**
 * The project block, end to end: a fresh headless session on a fixture that
 * carries this checkout's `opencode.jsonc` verbatim.
 */
export function sessionLeg(options: ModelLegOptions): ProbeRecord[] {
  const repo = createProbeRepo(options.parent, "session", projectConfigText());
  const denied = runSession(repo, options.home, "session-denied", attemptPrompt(DENIED_COMMAND));
  const deniedSkip = providerSkip(denied);
  if (deniedSkip !== undefined) {
    return skipRecord("opencode-v2-session", `provider: ${deniedSkip}`);
  }
  repo.stage("allowed.txt");
  const allowed = runSession(repo, options.home, "session-allowed", attemptPrompt(ALLOWED_COMMAND));
  const allowedSkip = providerSkip(allowed);
  if (allowedSkip !== undefined) {
    return skipRecord("opencode-v2-session", `provider: ${allowedSkip}`);
  }
  const records: ProbeRecord[] = [];
  for (const [label, result, command, expected] of [
    ["session-denied", denied, DENIED_COMMAND, "denied"],
    ["session-allowed", allowed, ALLOWED_COMMAND, "allowed"],
  ] as const) {
    records.push({
      runtime: "opencode-v2-session",
      command,
      expected,
      observed: observedSummary(result.stdout, command),
      exit: `session exit ${String(result.status)}`,
      outcome: classifySessionTranscript(result.stdout, command),
      doesNotProve:
        label === "session-denied"
          ? "does not prove a determined spelling (bash -c …), a separator, or any client other than this opencode build is stopped — shell text matching is best-effort"
          : "does not prove the config was read from THIS fixture's file rather than a global one (the hermetic HOME removes the global surface, asserted by the fixture's own isolation)",
    });
  }
  return records;
}

/**
 * The original observation's mechanism: a session started WITHOUT the block,
 * then the block written, then the SAME session probed again. This is the leg
 * that answers "was the 2026-10-02 allowance a cached/frozen permission
 * surface, or a config state the session never carried?".
 */
export function configEditLeg(options: ModelLegOptions): ProbeRecord[] {
  const repo = createProbeRepo(options.parent, "config-edit", preBlockConfigText());
  const before = runSession(
    repo,
    options.home,
    "config-edit-before",
    attemptPrompt(DENIED_COMMAND),
  );
  const beforeSkip = providerSkip(before);
  if (beforeSkip !== undefined) {
    return skipRecord("opencode-v2-config-edit", `provider: ${beforeSkip}`);
  }
  const sessionId = sessionIdOf(before.stdout);
  repo.writeConfig(projectConfigText());
  repo.stage("config.txt");
  repo.git(["add", "opencode.jsonc"]);
  repo.git(["commit", "-q", "-m", "add the permissions block"]);
  repo.git(["push", "-q", "origin", "main"]);
  const after =
    sessionId === undefined
      ? undefined
      : runSession(repo, options.home, "config-edit-after", attemptPrompt(DENIED_COMMAND), {
          session: sessionId,
        });
  const records: ProbeRecord[] = [
    {
      runtime: "opencode-v2-config-edit",
      command: DENIED_COMMAND,
      expected: "allowed",
      observed: observedSummary(before.stdout, DENIED_COMMAND),
      exit: `session exit ${String(before.status)}`,
      outcome: classifySessionTranscript(before.stdout, DENIED_COMMAND),
      doesNotProve:
        "does not prove WHY the 2026-10-02 session allowed the denied commands; it only pins what a pre-block session does today",
    },
  ];
  if (after === undefined) {
    records.push({
      runtime: "opencode-v2-config-edit",
      command: DENIED_COMMAND,
      expected: "denied",
      observed: "no session id in the first transcript — the same-session continuation never ran",
      exit: "n/a",
      outcome: "inconclusive",
      doesNotProve: "does not prove anything about a continued session",
    });
    return records;
  }
  const afterSkip = providerSkip(after);
  if (afterSkip !== undefined) {
    records.push(...skipRecord("opencode-v2-config-edit", `provider: ${afterSkip}`));
    return records;
  }
  records.push({
    runtime: "opencode-v2-config-edit",
    command: DENIED_COMMAND,
    expected: "denied",
    observed: observedSummary(after.stdout, DENIED_COMMAND),
    exit: `session exit ${String(after.status)} (same session id)`,
    outcome: classifySessionTranscript(after.stdout, DENIED_COMMAND),
    doesNotProve:
      "does not prove the desktop client's behavior — a `run` process re-resolves its config; the SERVICE leg below is the long-lived-process answer",
  });
  return records;
}

/** An ephemeral localhost port for the harness's own background service. */
async function freePort(): Promise<number> {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => {
        if (port > 0) resolvePort(port);
        else reject(new Error("no ephemeral port"));
      });
    });
  });
}

function serviceBin(args: string[], home: HermeticHome): RunResult {
  const proc = spawnSync("opencode", args, {
    env: { ...process.env, ...home.env },
    encoding: "utf8",
    timeout: 120_000,
  });
  return { status: proc.status, stdout: proc.stdout ?? "", stderr: proc.stderr ?? "" };
}

/**
 * The desktop app's runtime shape: a session attached to a long-lived
 * background service, with the permissions block written mid-session.
 */
export async function serviceLeg(options: ModelLegOptions): Promise<ProbeRecord[]> {
  const port = await freePort();
  serviceBin(["service", "set", "port", String(port)], options.home);
  const started = serviceBin(["service", "start"], options.home);
  if (started.status !== 0) {
    return skipRecord(
      "opencode-v2-service",
      `service start failed: ${started.stderr.trim().slice(0, 200)}`,
    );
  }
  try {
    const repo = createProbeRepo(options.parent, "service", preBlockConfigText());
    const before = runSession(repo, options.home, "service-before", attemptPrompt(DENIED_COMMAND), {
      service: true,
    });
    const beforeSkip = providerSkip(before);
    if (beforeSkip !== undefined) {
      return skipRecord("opencode-v2-service", `provider: ${beforeSkip}`);
    }
    const sessionId = sessionIdOf(before.stdout);
    repo.writeConfig(projectConfigText());
    repo.stage("config.txt");
    repo.git(["add", "opencode.jsonc"]);
    repo.git(["commit", "-q", "-m", "add the permissions block"]);
    repo.git(["push", "-q", "origin", "main"]);
    const after =
      sessionId === undefined
        ? undefined
        : runSession(repo, options.home, "service-after", attemptPrompt(DENIED_COMMAND), {
            session: sessionId,
            service: true,
          });
    if (after !== undefined) {
      const afterSkip = providerSkip(after);
      if (afterSkip !== undefined) {
        return skipRecord("opencode-v2-service", `provider: ${afterSkip}`);
      }
    }
    const records: ProbeRecord[] = [
      {
        runtime: "opencode-v2-service",
        command: DENIED_COMMAND,
        expected: "allowed",
        observed: observedSummary(before.stdout, DENIED_COMMAND),
        exit: `session exit ${String(before.status)} (service-attached)`,
        outcome: classifySessionTranscript(before.stdout, DENIED_COMMAND),
        doesNotProve: "does not prove the desktop app reuses this service shape verbatim",
      },
    ];
    records.push(
      after === undefined
        ? {
            runtime: "opencode-v2-service",
            command: DENIED_COMMAND,
            expected: "denied",
            observed:
              "no session id in the first transcript — the same-session continuation never ran",
            exit: "n/a",
            outcome: "inconclusive",
            doesNotProve: "does not prove anything about a continued session",
          }
        : {
            runtime: "opencode-v2-service",
            command: DENIED_COMMAND,
            expected: "denied",
            observed: observedSummary(after.stdout, DENIED_COMMAND),
            exit: `session exit ${String(after.status)} (same session id, long-lived service)`,
            outcome: classifySessionTranscript(after.stdout, DENIED_COMMAND),
            doesNotProve:
              "does not prove every long-lived server caches nothing — it pins THIS build's behavior on one service",
          },
    );
    return records;
  } finally {
    serviceBin(["service", "stop"], options.home);
  }
}

/** A record shape for a leg that could not run at all (never a pass). */
export function skipRecord(runtime: string, reason: string): ProbeRecord[] {
  return [
    {
      runtime,
      command: "—",
      expected: "denied",
      observed: `SKIP: ${reason}`,
      exit: "n/a",
      outcome: "inconclusive",
      doesNotProve: "nothing was probed for this runtime in this environment",
    },
  ];
}

// ---------------------------------------------------------------------------
// Deterministic legs (model-free — also run under `npm test`)
// ---------------------------------------------------------------------------

/** Both hook-gate seams: one denied + one allowed command each. */
export function gateLegs(): ProbeRecord[] {
  const records: ProbeRecord[] = [];
  for (const seam of ["zcode", "claude"] as const) {
    const gate = join(repoRoot, "templates", "docs", seam, "arggon", "hooks", "gate.mjs");
    const cwd = repoRoot;
    for (const [command, expected] of [
      [DENIED_COMMAND, "denied"],
      [ALLOWED_COMMAND, "allowed"],
    ] as const) {
      const proc = spawnSync(process.execPath, [gate, "pre"], {
        input: JSON.stringify(gatePrePayload(command, `probe-${seam}`, cwd)),
        encoding: "utf8",
        env: { ...process.env, [`${seam === "zcode" ? "ZCODE" : "CLAUDE"}_PROJECT_DIR`]: cwd },
        timeout: 15_000,
      });
      records.push({
        runtime: `${seam}-gate`,
        command,
        expected,
        observed: (proc.stderr ?? "").trim().split("\n")[0]?.slice(0, 120) || "no stderr",
        exit: `hook exit ${String(proc.status)}`,
        outcome: classifyGateRun(proc.status, proc.stderr ?? ""),
        doesNotProve:
          "does not prove the seam's runtime actually invokes this hook for every tool — only that the shipped gate script refuses this command",
      });
    }
  }
  return records;
}

/** The vendored plugin's own permission surface: structurally none. */
export function pluginLeg(): ProbeRecord[] {
  // The AUTHORED source, not the derived `.opencode/plugins/arggon/index.ts`
  // copy: that vendored file is gitignored (regenerated by `arggon init`), so
  // it is absent from a fresh worktree, while the source is tracked and is
  // what `npm run build:plugin` bundles for adopters.
  const source = readFileSync(join(repoRoot, "opencode", "plugins", "arggon", "index.ts"), "utf8");
  const faults = pluginPermissionSurfaceFaults(source);
  return [
    {
      runtime: "arggon-plugin",
      command: "(no shell command — a structural determination)",
      expected: "allowed",
      observed:
        faults.length === 0
          ? "the bundle declares no config hook and no permission rule"
          : faults.join("; "),
      exit: "n/a",
      outcome: faults.length === 0 ? "allowed" : "inconclusive",
      doesNotProve:
        "does not prove the plugin can never deny — it pins that it declares no permission surface of its own; its tool filtering is the runtime's and its kernel calls are the kernel's refusals (probed by the arggon-cli-kernel leg)",
    },
  ];
}

/**
 * A throwaway tracker (git init + `arggon init` + one story with two tasks),
 * with the git hygiene the kernel's claim path requires.
 */
function createTrackerFixture(parent: string): {
  dir: string;
  doneItem: string;
  claimItem: string;
} {
  const dir = join(parent, "tracker");
  mkdirSync(dir, { recursive: true });
  const git = (args: string[]): void => {
    const proc = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    if (proc.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${proc.stderr}`);
  };
  /**
   * Stage + commit, tolerating a clean tree: every `arggon` mutation
   * auto-commits the files it wrote, so an explicit follow-up commit is a
   * no-op most of the time (and `git commit` exits 1 on a clean tree).
   */
  const commitAll = (message: string): void => {
    git(["add", "-A"]);
    const status = spawnSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" });
    if ((status.stdout ?? "").trim() === "") return;
    git(["commit", "-q", "-m", message]);
  };
  const arggon = (args: string[]): string => {
    const proc = runCli(args, dir, { timeout: 120_000 });
    return proc.stdout ?? "";
  };
  const remote = `${dir}-remote.git`;
  spawnSync("git", ["init", "-q", "--bare", "-b", "main", remote], { encoding: "utf8" });
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "probe@example.com"]);
  git(["config", "user.name", "permission-probe"]);
  git(["remote", "add", "origin", remote]);
  arggon(["init", dir, "--json"]);
  commitAll("init");
  const idOf = (stdout: string): string => {
    const parsed = JSON.parse(stdout) as { item?: { id?: unknown } };
    const id = parsed.item?.id;
    if (typeof id !== "string") throw new Error(`no item id in: ${stdout.slice(0, 200)}`);
    return id;
  };
  const initiative = idOf(arggon(["create", "initiative", "Probe initiative", "--json"]));
  commitAll("initiative");
  const epic = idOf(arggon(["create", "epic", "Probe epic", "--parent", initiative, "--json"]));
  commitAll("epic");
  const story = idOf(arggon(["create", "story", "Probe story", "--parent", epic, "--json"]));
  commitAll("story");
  const doneItem = idOf(arggon(["create", "task", "Probe done task", "--parent", story, "--json"]));
  const claimItem = idOf(
    arggon(["create", "task", "Probe claim task", "--parent", story, "--json"]),
  );
  commitAll("tasks");
  // Drive the done item through the gate with a ticked acceptance box.
  const body = join(
    dir,
    "ArggonManager",
    ...`${initiative}/${epic}/${story}/${doneItem}.md`.split("/"),
  );
  const raw = readFileSync(body, "utf8").replace(
    "<!-- The real acceptance criteria; tick each box when met. -->",
    "- [x] probe criterion",
  );
  writeFileSync(body, raw, "utf8");
  arggon(["update", doneItem, "--status", "in_progress", "--assignee", "probe-maker", "--json"]);
  commitAll("in progress");
  arggon(["update", doneItem, "--status", "done", "--json"]);
  commitAll("done");
  return { dir, doneItem, claimItem };
}

/** The kernel's own refusals, end to end: reopen, steal, and an allowed write. */
export function kernelLeg(parent: string): ProbeRecord[] {
  const fixture = createTrackerFixture(parent);
  const reopen = runCli(["update", fixture.doneItem, "--status", "todo", "--json"], fixture.dir, {
    timeout: 120_000,
  });
  const claim = runCli(
    ["start", fixture.claimItem, "--assignee", "probe-owner", "--json"],
    fixture.dir,
    {
      timeout: 120_000,
    },
  );
  const steal = runCli(
    ["start", fixture.claimItem, "--assignee", "other-owner", "--json"],
    fixture.dir,
    { timeout: 120_000 },
  );
  const comment = runCli(["comment", fixture.doneItem, "probe marker", "--json"], fixture.dir, {
    timeout: 120_000,
  });
  const firstLine = (stdout: string): string => {
    try {
      const parsed = JSON.parse(stdout) as { error?: { message?: unknown } };
      const message = String(parsed.error?.message ?? stdout).split("\n")[0] ?? "";
      return message.slice(0, 120);
    } catch {
      return stdout.trim().split("\n")[0]?.slice(0, 120) ?? "";
    }
  };
  const records: ProbeRecord[] = [
    {
      runtime: "arggon-cli-kernel",
      command: `arggon update ${fixture.doneItem} --status todo (on a done item)`,
      expected: "denied",
      observed: firstLine(reopen.stdout ?? ""),
      exit: `cli exit ${String(reopen.status)}`,
      outcome: classifyKernelRun(reopen.stdout ?? ""),
      doesNotProve:
        "does not prove every client is held — the native tools and MCP call the same kernel operation, and that parity is pinned by the kernel suites",
    },
  ];
  if (claim.status !== 0) {
    records.push({
      runtime: "arggon-cli-kernel",
      command: `arggon start ${fixture.claimItem} --assignee probe-owner`,
      expected: "allowed",
      observed: firstLine(claim.stdout ?? "") || (claim.stderr ?? "").trim().slice(0, 120),
      exit: `cli exit ${String(claim.status)}`,
      outcome: "inconclusive",
      doesNotProve: "the claim never happened, so the steal probe below proves nothing",
    });
    return records;
  }
  records.push({
    runtime: "arggon-cli-kernel",
    command: `arggon start ${fixture.claimItem} --assignee other-owner (steal)`,
    expected: "denied",
    observed: firstLine(steal.stdout ?? "") || (steal.stderr ?? "").trim().slice(0, 120),
    exit: `cli exit ${String(steal.status)}`,
    outcome: classifyKernelRun(steal.stdout ?? ""),
    doesNotProve:
      "does not prove `--force`/`--steal` are refused — those are human-only flags, deliberately out of scope",
  });
  records.push({
    runtime: "arggon-cli-kernel",
    command: `arggon comment ${fixture.doneItem} "probe marker"`,
    expected: "allowed",
    observed: firstLine(comment.stdout ?? "") || "(comment envelope returned)",
    exit: `cli exit ${String(comment.status)}`,
    outcome: classifyKernelRun(comment.stdout ?? ""),
    doesNotProve:
      "does not prove the loop is unimpaired — only that an ordinary tracker write is not refused",
  });
  return records;
}

// ---------------------------------------------------------------------------
// Table + main
// ---------------------------------------------------------------------------

/**
 * Run one leg; a thrown leg is recorded as a failed probe (never silently
 * skipped, never able to abort the legs after it).
 */
function attemptLeg(runtime: string, leg: () => ProbeRecord[]): ProbeRecord[] {
  try {
    return leg();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      {
        runtime,
        command: "—",
        expected: "denied",
        observed: `leg threw: ${message.slice(0, 160)}`,
        exit: "n/a",
        outcome: "inconclusive",
        doesNotProve: "the leg itself failed; nothing about the runtime was probed",
      },
    ];
  }
}

/** The async twin of {@link attemptLeg} (the service leg allocates a port). */
async function attemptLegAsync(
  runtime: string,
  leg: () => Promise<ProbeRecord[]>,
): Promise<ProbeRecord[]> {
  try {
    return await leg();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      {
        runtime,
        command: "—",
        expected: "denied",
        observed: `leg threw: ${message.slice(0, 160)}`,
        exit: "n/a",
        outcome: "inconclusive",
        doesNotProve: "the leg itself failed; nothing about the runtime was probed",
      },
    ];
  }
}

function printTable(records: ProbeRecord[]): void {
  console.log("\n| runtime | command | expected | observed | exit | outcome |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const record of records) {
    console.log(
      `| ${record.runtime} | ${record.command} | ${record.expected} | ${record.observed.replaceAll("|", "\\|")} | ${record.exit} | ${record.outcome} |`,
    );
  }
  console.log("\ndoes NOT prove:");
  const seen = new Set<string>();
  for (const record of records) {
    const key = `${record.runtime}: ${record.doesNotProve}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`- [${record.runtime}] ${record.doesNotProve}`);
  }
}

async function main(): Promise<void> {
  console.log(
    "smoke:permissions-probe — per-runtime permissions probe (bug-task-permissions-enforcement-not-observed)",
  );
  const version = opencodeVersion();
  console.log(version === undefined ? "opencode: not installed" : `opencode: v${version}`);
  console.log(`model: ${MODEL}`);
  // OpenCode's own managed temp dir, so a fixture (and any sibling worktree a
  // session creates) stays inside the directory the runtime already trusts.
  mkdirSync(join(tmpdir(), "opencode"), { recursive: true });
  const parent = realpathSync(mkdtempSync(join(tmpdir(), "opencode", "arggon-perm-probe-")));
  const records: ProbeRecord[] = [];
  try {
    // Deterministic legs: model-free, offline, always run.
    records.push(...attemptLeg("zcode-gate/claude-gate", () => gateLegs()));
    records.push(...attemptLeg("arggon-plugin", pluginLeg));
    records.push(...attemptLeg("arggon-cli-kernel", () => kernelLeg(parent)));

    // Model-driven legs: need the binary AND a resolvable provider.
    if (version === undefined) {
      records.push(
        ...skipRecord(
          "opencode-v2-session",
          "opencode not installed (the V2 legs need the binary; the legs above are the model-free half)",
        ),
      );
      console.log("\nSKIP opencode not installed — deterministic legs ran, V2 legs skipped");
    } else {
      const home = createHermeticHome(join(parent, "home"));
      const providerID = MODEL.split("/")[0] ?? "";
      const seed = seedHermeticCredentials("opencode", home, { providers: [providerID] });
      if (!seed.ok) {
        records.push(
          ...skipRecord("opencode-v2-session", `credentials: ${seed.error ?? "unknown"}`),
        );
        console.log(`\nSKIP could not seed credentials — ${seed.error ?? "unknown"}`);
      } else {
        console.log(
          `hermetic home seeded (${String(seed.credentials)} credential(s) for ${providerID})`,
        );
        const options = { home, parent };
        records.push(...attemptLeg("opencode-v2-session", () => sessionLeg(options)));
        records.push(...attemptLeg("opencode-v2-config-edit", () => configEditLeg(options)));
        records.push(...(await attemptLegAsync("opencode-v2-service", () => serviceLeg(options))));
      }
    }
  } finally {
    printTable(records);
    const skips = records.filter((record) => record.observed.startsWith("SKIP:"));
    const failures = records.filter(
      (record) => !record.observed.startsWith("SKIP:") && record.outcome !== record.expected,
    );
    if (failures.length > 0) {
      console.error(
        `\nsmoke:permissions-probe FAILED — ${failures.length} leg(s):\n${failures
          .map(
            (f) =>
              `- ${f.runtime}: ${f.command} — expected ${f.expected}, observed ${f.outcome} (${f.observed})`,
          )
          .join("\n")}`,
      );
      console.error(`fixtures kept for inspection: ${parent}`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `\nsmoke:permissions-probe passed — ${records.length - skips.length} probe(s), ${skips.length} skip(s)`,
    );
    if (process.env.ARGON_SMOKE_KEEP !== "1") rmSync(parent, { recursive: true, force: true });
  }
}

/** Direct-run guard: the unit tests import the classifiers, never the run. */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main().catch((error: unknown) => {
    console.error(
      `smoke:permissions-probe FAILED — ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
