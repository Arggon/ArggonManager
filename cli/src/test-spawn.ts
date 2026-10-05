import { spawn, spawnSync } from "node:child_process";
import type {
  ChildProcessWithoutNullStreams,
  SpawnOptions,
  SpawnSyncOptionsWithStringEncoding,
  SpawnSyncReturns,
} from "node:child_process";
import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Shared helper for spawning the real CLI (or a TS helper script) from the
 * TypeScript sources in tests, labs and plugin contract tests.
 *
 * bug-row-table-flake: drive node's module-loader registration directly
 * (`--import <tsx loader>`) instead of the tsx wrapper CLI. The wrapper
 * (tsx/dist/cli.mjs) re-executes node as a second child process and hosts a
 * per-spawn IPC server (`/tmp/tsx-<uid>/<pid>.pipe`); its listen/rm/reject
 * path has no error handling, so any transient failure there exits the whole
 * chain 1 under load. One node process, no wrapper, no IPC socket: the
 * transient class is gone. Spawned stdout/stderr bytes are unchanged (same
 * CLI, same loader). Original single-file migration: cli/src/
 * row-table-stdout.test.ts (PR #513); this helper replaces that file's local
 * copy and every remaining per-suite copy (task-runcli-import-tsx-migration).
 *
 * bug-cli-spawn-suites-exit-1-flake: a spawned child that fails BEFORE the CLI
 * runs is a harness failure, not a product result, and `expect(proc.status)
 * .toBe(0)` cannot tell the two apart — the three recorded CI instances all
 * printed a bare `expected 1 to be +0`. So this helper classifies every spawn
 * and raises a typed {@link SpawnHarnessError} for the three classes in which
 * no CLI result exists at all, carrying the child's stderr/signal/spawn error
 * plus whether the repo's built kernel moved during the spawn. A real program
 * exit (a non-zero `arggon` code a test asserts on) is returned untouched.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Absolute path of the CLI's TypeScript entry inside `root`. */
export function cliEntryPath(root: string = repoRoot): string {
  return resolve(root, "cli/src/cli.ts");
}

/** Absolute path of tsx's loader (`--import` target; NOT the wrapper CLI). */
export function tsxLoaderPath(root: string = repoRoot): string {
  return resolve(root, "node_modules/tsx/dist/loader.mjs");
}

/**
 * argv that runs `entry` (the CLI or a spawned TS helper script) through
 * tsx's loader: `node --import <loader> <entry>`. Spread the result before
 * the entry's own arguments.
 */
export function nodeImportArgs(entry: string, root: string = repoRoot): string[] {
  return ["--import", tsxLoaderPath(root), entry];
}

export type RunCliOptions = Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> & {
  /** Defaults to (and stays) "utf8" — every migrated suite asserts strings. */
  encoding?: "utf8";
};

/**
 * Why a spawn produced no CLI result:
 *
 * - `none` — the child exited 0 (or never ran: see `spawn-error`).
 * - `spawn-error` — `spawnSync` itself failed (EAGAIN/EMFILE/ENOMEM/…), so no
 *   process ever ran; `status` and `signal` are both null.
 * - `signalled` — the child was killed by a signal (OOM killer, timeout kill).
 * - `child-boot-failed` — the child started but died inside Node's ESM loader
 *   while building the module graph, before the CLI's own code ran. The repo's
 *   spawned CLI loads the kernel from the BUILT `lib/dist`, so this is the shape
 *   a rebuild of that artifact under a live reader takes.
 * - `program-exit` — the CLI ran and exited non-zero on its own terms (the case
 *   tests assert on); never raised, never retried.
 */
export type SpawnFailureKind =
  "none" | "spawn-error" | "signalled" | "child-boot-failed" | "program-exit";

/** Kinds in which the test observed no CLI result at all. */
const HARNESS_KINDS: ReadonlySet<SpawnFailureKind> = new Set<SpawnFailureKind>([
  "spawn-error",
  "signalled",
  "child-boot-failed",
]);

/** A frame from Node's ESM loader: the child died linking/instantiating. */
const ESM_LOADER_FRAME = /node:internal[\\/]modules[\\/]esm[\\/]/;
/**
 * Loader/linker messages that mean "the module graph never came up". Spelled
 * out rather than matched loosely so a CLI envelope quoting user text can never
 * be mistaken for one of them.
 */
const BOOT_SIGNATURE =
  /does not provide an export named|Cannot find (?:module|package) ['"]|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_UNKNOWN_FILE_EXTENSION|ERR_UNSUPPORTED_DIR_IMPORT|Cannot use import statement outside a module/;

/** The subset of a spawn result the classifier reads. */
export type SpawnOutcome = Pick<
  SpawnSyncReturns<string>,
  "status" | "signal" | "error" | "stderr" | "stdout"
>;

/**
 * Classify one completed spawn. Pure: exported so the harness gate
 * (`test-spawn.test.ts`) pins the classification itself, not just its effects.
 */
export function classifySpawnFailure(proc: SpawnOutcome): SpawnFailureKind {
  if (proc.error) return "spawn-error";
  if (proc.signal !== null && proc.signal !== undefined) return "signalled";
  if (proc.status === 0) return "none";
  if (proc.status === null || proc.status === undefined) return "spawn-error";
  const stderr = proc.stderr ?? "";
  return ESM_LOADER_FRAME.test(stderr) || BOOT_SIGNATURE.test(stderr)
    ? "child-boot-failed"
    : "program-exit";
}

/**
 * Built artifacts a spawned child ESM-loads: the CLI's TypeScript sources are
 * transpiled in-memory, but `@arggondev/lib` and the build identity resolve to
 * `lib/dist` / `dist` on disk. A lane that rebuilds them in place rewrites
 * every file (tsc does not skip byte-identical output), so a child that links
 * the graph mid-rewrite sees a truncated module.
 */
const KERNEL_ARTIFACTS = ["lib/dist/index.js", "lib/dist/create.js", "dist/cli.js"] as const;

/** `size:mtimeMs` per watched artifact, or `absent` — one cheap stat each. */
function artifactFingerprint(root: string): string {
  return KERNEL_ARTIFACTS.map((rel) => {
    try {
      const st = statSync(resolve(root, rel));
      return `${rel}=${st.size}:${st.mtimeMs}`;
    } catch {
      return `${rel}=absent`;
    }
  }).join(" ");
}

/**
 * A spawn that produced no CLI result, with everything needed to tell the
 * harness classes apart in the test output. Thrown (never returned) precisely
 * so the failure is distinguishable from an assertion diff: the name, the
 * `kind`, and the child's own stderr all survive into vitest's report.
 */
export class SpawnHarnessError extends Error {
  readonly kind: SpawnFailureKind;
  readonly argv: string[];
  readonly cwd: string;
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly spawnError: string;
  readonly stderr: string;
  readonly stdout: string;
  /** Non-null when the repo's built kernel moved while this child was alive. */
  readonly artifactDrift: string | null;

  constructor(init: {
    kind: SpawnFailureKind;
    argv: string[];
    cwd: string;
    outcome: SpawnOutcome;
    artifactDrift: string | null;
  }) {
    const { kind, argv, cwd, outcome, artifactDrift } = init;
    const status = outcome.status ?? null;
    const signal = outcome.signal ?? null;
    const spawnError =
      outcome.error === undefined
        ? "none"
        : `${(outcome.error as NodeJS.ErrnoException).code ?? "?"}: ${outcome.error.message}`;
    const detail: string[] = [
      `kind: ${kind} (no CLI result — this is not an assertion failure)`,
      `argv: node ${argv.join(" ")}`,
      `cwd: ${cwd}`,
      `status: ${status === null ? "null (never exited)" : status}`,
      `signal: ${signal ?? "none"}`,
      `spawn error: ${spawnError}`,
    ];
    if (artifactDrift !== null) {
      detail.push(
        `kernel artifact drift: the repo's built artifacts were REWRITTEN while this child ran —`,
        `  ${artifactDrift}`,
        `  another suite lane rebuilt lib/dist or dist in place; that child linked a`,
        `  half-written module. Fix the writer (see cli/src/headless-ci.test.ts), not the reader.`,
      );
    }
    detail.push(
      `--- child stderr ---\n${outcome.stderr ?? ""}`,
      `--- child stdout ---\n${outcome.stdout ?? ""}`,
    );
    super(`[arggon-test-spawn] CLI spawn produced no result\n${detail.join("\n")}`);
    this.name = "SpawnHarnessError";
    this.kind = kind;
    this.argv = argv;
    this.cwd = cwd;
    this.status = status;
    this.signal = signal;
    this.spawnError = spawnError;
    this.stderr = outcome.stderr ?? "";
    this.stdout = outcome.stdout ?? "";
    this.artifactDrift = artifactDrift;
  }
}

/**
 * Which entry point produced a text a test is about to read as a `--json`
 * envelope. Carried into every reader failure so the next occurrence names CLI
 * vs MCP instead of leaving the reader to guess
 * (bug-mcp-parity-branch-test-json-parse-of-human-stdout).
 */
export type EnvelopeSurface = "CLI" | "MCP";

/**
 * A stream a test wanted to read as a `--json` envelope, with enough context to
 * name the failure. `isError` is the MCP tool-error flag: a tool-level error
 * carries a human sentence where an envelope would be, and that flag is the one
 * piece of evidence that says so.
 */
export type EnvelopeReadInit = {
  surface: EnvelopeSurface;
  /** The operation, e.g. `arggon branch` or `arggon_branch`. */
  command: string;
  text: string;
  /** The same run's stderr, when there is one (CLI child). */
  stderr?: string;
  /** MCP tool-result `isError`; omitted for a CLI child. */
  isError?: boolean;
};

/**
 * A surface produced text that is not a `--json` envelope — no JSON object could
 * be located in it. Thrown (never returned) precisely so it is distinguishable
 * from an assertion diff: the surface, the raw text and the run's stderr all
 * survive into the test output, replacing the bare
 * `SyntaxError: Unexpected token 'a', "arggon bra"...` that three guesses and a
 * bisect used to be needed for.
 */
export class EnvelopeReadError extends Error {
  readonly surface: EnvelopeSurface;
  readonly command: string;
  readonly text: string;
  readonly stderr: string;
  readonly isError: boolean | null;

  constructor(init: EnvelopeReadInit) {
    const { surface, command, text } = init;
    const stderr = init.stderr ?? "";
    const isError = init.isError ?? null;
    const detail: string[] = [
      `surface: ${surface} (${command}) produced no JSON envelope`,
      `tool-level error: ${isError === null ? "n/a (not an MCP tool result)" : String(isError)}`,
    ];
    if (isError === true) {
      detail.push(
        `  the MCP server raised a TOOL ERROR, so this text is its diagnostic message,`,
        `  not an envelope — the underlying spawn reported no result.`,
      );
    }
    detail.push(
      `--- ${surface} stdout ---\n${clipForMessage(text)}`,
      `--- ${surface} stderr ---\n${stderr.trim() ? clipForMessage(stderr) : "(empty)"}`,
    );
    super(`[arggon-test-spawn] unreadable envelope\n${detail.join("\n")}`);
    this.name = "EnvelopeReadError";
    this.surface = surface;
    this.command = command;
    this.text = text;
    this.stderr = stderr;
    this.isError = isError;
  }
}

/** Raw-text budget inside a reader failure (head — that is where the noise is). */
const ENVELOPE_ECHO_CHARS = 2000;

/**
 * Clip to {@link ENVELOPE_ECHO_CHARS}, keeping the HEAD: the offending line is
 * the one ahead of the envelope, which is the whole diagnosis.
 */
function clipForMessage(text: string, max = ENVELOPE_ECHO_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed === "" ? "(empty)" : trimmed;
  return `${trimmed.slice(0, max)}\n… (${trimmed.length - max} more characters)`;
}

/** Whole lines and brace candidates tried while locating an envelope. */
const ENVELOPE_SCAN_BUDGET = 2000;

/**
 * The balanced `{…}` slice starting at `start`, or null when it never closes.
 * Only `"` opens a JSON string — a human line's apostrophe must not be able to
 * swallow the rest of the scan.
 */
function balancedObjectSlice(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/** A JSON object parsed out of candidate text, or null. */
function parseEnvelopeObject(candidate: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(candidate);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export type ReadEnvelope = {
  envelope: Record<string, unknown>;
  /**
   * True when the WHOLE trimmed text was the envelope — the documented `--json`
   * contract (one JSON object on stdout). False means the reader had to look
   * past other text to find it, which a test can assert on when it wants the
   * strict JSON-only contract rather than just a parsable envelope.
   */
  exact: boolean;
};

/**
 * Read one `--json` envelope out of a surface's output.
 *
 * Whole-text parse first (that is the contract, and it is what every current
 * caller emits). Failing that, LOCATE the envelope object inside surrounding
 * text — a human success line ahead of the envelope, or a tool-error sentence in
 * place of one, must not turn into a bare `SyntaxError`. When no object is
 * found the caller gets {@link EnvelopeReadError}, naming the surface, the
 * command, the MCP tool-error flag and both raw streams.
 *
 * Two granularities, both tried in order and both cheap: whole lines (`emitJson`
 * writes one object plus a newline, so the envelope IS a line), then brace
 * candidates inside a line for the shape where a human prefix shares the
 * envelope's line.
 *
 * The fallback locates; it never invents. Text with no JSON object in it still
 * raises, so a surface that produced no result cannot be mistaken for a passing
 * parity run.
 */
export function readEnvelope(init: EnvelopeReadInit): ReadEnvelope {
  const trimmed = init.text.trim();
  const whole = parseEnvelopeObject(trimmed);
  if (whole) return { envelope: whole, exact: true };
  const lines = trimmed.split("\n");
  let budget = ENVELOPE_SCAN_BUDGET;
  for (const line of lines) {
    if (budget-- <= 0) break;
    const found = parseEnvelopeObject(line.trim());
    if (found) return { envelope: found, exact: false };
  }
  for (const line of lines) {
    for (let i = line.indexOf("{"); i >= 0; i = line.indexOf("{", i + 1)) {
      if (budget-- <= 0) break;
      const slice = balancedObjectSlice(line, i);
      const found = slice === null ? null : parseEnvelopeObject(slice);
      if (found) return { envelope: found, exact: false };
    }
  }
  throw new EnvelopeReadError(init);
}

/**
 * Sync-spawn the real CLI: `node --import <tsx loader> cli/src/cli.ts <args>`
 * (bug-row-table-flake). `cwd` defaults to the vitest process cwd; `options`
 * are passed straight to `spawnSync` (env, input, timeout, …).
 *
 * Raises {@link SpawnHarnessError} when the spawn produced no CLI result (the
 * child never launched, was killed, or died inside the ESM loader); returns the
 * raw result otherwise, so a non-zero `arggon` exit a test asserts on is
 * untouched (bug-cli-spawn-suites-exit-1-flake).
 */
export function runCli(
  args: string[],
  cwd?: string,
  options: RunCliOptions = {},
): SpawnSyncReturns<string> {
  const argv = [...nodeImportArgs(cliEntryPath()), ...args];
  const before = artifactFingerprint(repoRoot);
  const proc = spawnSync(process.execPath, argv, {
    encoding: "utf8",
    cwd,
    ...options,
  });
  const kind = classifySpawnFailure(proc);
  if (!HARNESS_KINDS.has(kind)) return proc;
  const after = artifactFingerprint(repoRoot);
  throw new SpawnHarnessError({
    kind,
    argv,
    cwd: cwd ?? process.cwd(),
    outcome: proc,
    artifactDrift: before === after ? null : `before[${before}] after[${after}]`,
  });
}

/**
 * Async-spawn the real CLI with the same loader registration as
 * {@link runCli}. Streams are typed non-null: every caller pipes at least
 * stdout/stderr (asserted by the migrated suites' stdio tuples).
 */
export function spawnNodeCli(
  args: string[],
  options: SpawnOptions = {},
): ChildProcessWithoutNullStreams {
  return spawn(
    process.execPath,
    [...nodeImportArgs(cliEntryPath()), ...args],
    options,
  ) as ChildProcessWithoutNullStreams;
}
