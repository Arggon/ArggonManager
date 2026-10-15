#!/usr/bin/env node
/**
 * task-opencode-event-panel smoke (plan-methodology-adapters-017 §T4, second
 * half): the board panel is refreshed by the OpenCode EVENT STREAM, not by
 * polling.
 *
 * The contract under test
 * -----------------------
 * `opencode/plugins/arggon/tui.tsx` subscribes the open panel to the host's
 * event stream (`context.data.on`, the surface the built-in TUI plugins use on
 * 2.0.26 — `context.event` does not exist there) and re-reads the tracker on
 * the events that mean argon work landed: `session.shell.ended` and
 * `session.step.ended`. A tracker change with NO event must NOT appear: that is
 * what separates event-driven freshness from a polling loop (or a watcher).
 *
 * What it drives
 * --------------
 * A real `opencode` TUI in a real PTY (util-linux `script`, the same bridge as
 * `smoke:tui`) over a hermetic HOME (an empty `$HOME`/`$XDG_*` set: this box
 * has a machine-global `~/.config/opencode/plugins/arggon` that would shadow
 * the fixture's vendored copy), with its own managed service port so the run
 * neither touches nor is touched by the machine's `opencode service`. The
 * fixture is a fresh `arggon init` tree (4 items) carrying the committed bundle
 * and TUI entry byte for byte.
 *
 *   1. panel open — `/arggon-board` opens the panel on the session view and the
 *      replayed screen shows `arggon board · 4 item(s)`: the panel is STALE on
 *      purpose (the tracker will change behind it).
 *   2. event refresh — the harness calls the session's own shell endpoint
 *      (`POST /api/session/<id>/shell`, which emits `session.shell.started`/
 *      `ended` on the host bus) running this checkout's `arggon create` through
 *      a PATH shim. With NO keypress after the panel opened, the panel must
 *      repaint `arggon board · 5 item(s)` and draw the new item: the event
 *      stream is what refreshed it.
 *   3. no polling — a second item is written to the tracker DIRECTLY on disk
 *      (no OpenCode involvement, so no event) and the panel must NOT draw it
 *      inside a 6 s idle window. A polling loop or a filesystem watcher would.
 *   4. no timer in the artifact — the vendored TUI entry declares no
 *      `setInterval`/`setTimeout`/`requestAnimationFrame` and does carry
 *      `BOARD_REFRESH_EVENTS`: the fallback is the manual `r`, never a timer.
 *
 * Bounded by design. Exit codes: 0 — checks passed or `skipped:` (opencode or
 * util-linux `script` absent); 1 — a check failed (the fixture is kept).
 * `ARGON_PANEL_SMOKE_KEEP=1` keeps the fixture on success,
 * `ARGON_PANEL_SMOKE_TIMEOUT_MS` changes the PTY budget (default 90 s).
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCreate } from "@arggondev/lib";
import { runInit } from "../cli/src/init.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = Number(process.env.ARGON_PANEL_SMOKE_TIMEOUT_MS ?? 90_000);
const KEEP = process.env.ARGON_PANEL_SMOKE_KEEP === "1";

/** Fixture tree: four items the panel counts on open. */
const INITIATIVE_ID = "panel-smoke";
const EPIC_ID = "panel-core";
const STORY_ID = "panel-story";
const TASK_ID = "panel-task";
const BEFORE_COUNT = 4;

/** Item the session's shell command creates (the event-driven change). */
const CREATED_ID = "task-live-refresh";
const CREATED_STEM = "live-refresh";
/** Item written straight to disk with no event (the no-polling negative). */
const SILENT_ID = "task-silent-write";

const SLASH_COMMAND = "/arggon-board";
/** The replayed screen geometry the PTY is sized to. */
const SCREEN_ROWS = 40;
const SCREEN_COLS = 120;
/** Boot budget before the slash command is typed, then before Enter. */
const BOOT_MS = 7_000;
const SUBMIT_MS = 2_000;
/** How long the panel-open header and the refresh may take. */
const REFRESH_TIMEOUT_MS = 30_000;
const IDLE_WINDOW_MS = 6_000;

const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string): void {
  const suffix =
    ok || detail === undefined ? "" : `\n      ${detail.split("\n").slice(0, 6).join("\n      ")}`;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${suffix}`);
  if (!ok) failures.push(name);
}

// ---------------------------------------------------------------------------
// Pure predicates (imported by smoke/opencode-panel-refresh-smoke.test.ts)
// ---------------------------------------------------------------------------

/** Distinct panel states drawn while the panel was open. */
export type PanelObservation = {
  /** `arggon board · N item(s)` headers, first-seen order, deduped. */
  headers: string[];
  /** True when some frame drew the item the session's shell created. */
  createdSeen: boolean;
  /** True when some frame drew the item written without any event. */
  silentSeen: boolean;
};

export type PanelExpectation = {
  before: number;
  after: number;
  createdId: string;
  silentId: string;
};

/** The item count of a panel header line, or `undefined` for any other line. */
export function panelHeaderCount(line: string): number | undefined {
  const match = /arggon board · (\d+) item\(s\)/.exec(line);
  if (match === null) return undefined;
  const count = Number(match[1]);
  return Number.isInteger(count) ? count : undefined;
}

/**
 * Faults in the observed timeline (empty = the refresh contract held): the
 * panel opened STALE, the event refreshed it, and the silently written item
 * never appeared.
 */
export function refreshFaults(observation: PanelObservation, expected: PanelExpectation): string[] {
  const faults: string[] = [];
  const counts = observation.headers.map(panelHeaderCount);
  if (counts[0] !== expected.before) {
    faults.push(
      `the panel opened on ${String(counts[0])} item(s), expected the stale ${expected.before}`,
    );
  }
  const refreshed = counts.indexOf(expected.after);
  if (refreshed === -1) {
    faults.push(
      `no header ever named ${expected.after} item(s): ${JSON.stringify(observation.headers)}`,
    );
  } else if (refreshed === 0) {
    faults.push("the panel opened already fresh — the refresh cannot be attributed to an event");
  }
  if (!observation.createdSeen) {
    faults.push(`the refresh never drew ${expected.createdId}`);
  }
  if (observation.silentSeen) {
    faults.push(
      `the panel drew ${expected.silentId}, written with no event — that is a polling fallback`,
    );
  }
  return faults;
}

/** Faults in the vendored TUI entry's refresh path (empty = no timer, event-driven). */
export function artifactFaults(source: string): string[] {
  const faults: string[] = [];
  const timers = /\bsetInterval\b|\bsetTimeout\b|\brequestAnimationFrame\b/.exec(source);
  if (timers !== null) faults.push(`the vendored TUI entry declares a timer: ${timers[0]}`);
  if (!source.includes("BOARD_REFRESH_EVENTS")) {
    faults.push("the vendored TUI entry does not carry the refresh allow-list");
  }
  if (!source.includes("context.data.on") && !source.includes("data.on")) {
    faults.push("the vendored TUI entry does not subscribe to the host event stream");
  }
  return faults;
}

// ---------------------------------------------------------------------------
// PTY harness (the tui-smoke shape, driven by content instead of timers)
// ---------------------------------------------------------------------------

type Sentinel = { at: number; data: string };

type TuiRun = {
  /** Everything written to the TUI's stdin, in order (keypress evidence). */
  sent: Sentinel[];
  capture(): string;
  marks(): number[];
  /** Resolve true when the raw capture matches `pattern` before `timeoutMs`. */
  waitFor(pattern: RegExp, timeoutMs: number): Promise<boolean>;
  /**
   * Resolve true when a REPLAYED screen shows `pattern` before `timeoutMs`.
   * OpenTUI redraws only changed cells, so a header that changed from
   * `4 item(s)` to `5 item(s)` is not a contiguous run in the raw stream — the
   * replayed screen is what the user saw.
   */
  waitForScreen(pattern: RegExp, timeoutMs: number): Promise<boolean>;
  write(data: string): void;
  stop(): Promise<void>;
};

function startTui(cwd: string, env: NodeJS.ProcessEnv, sessionID: string): TuiRun {
  const child: ChildProcess = spawn(
    "script",
    ["-qec", `stty cols ${SCREEN_COLS} rows ${SCREEN_ROWS}; opencode -s ${sessionID}`, "/dev/null"],
    { cwd, env: { ...env, TERM: "xterm-256color" }, stdio: ["pipe", "pipe", "pipe"] },
  );
  const chunks: Buffer[] = [];
  const chunkMarks: number[] = [];
  const sent: Sentinel[] = [];
  let stream = "";
  const append = (chunk: Buffer): void => {
    chunks.push(chunk);
    stream += chunk.toString("utf8");
    chunkMarks.push(stream.length);
  };
  child.stdin.on("error", () => {});
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  const write = (data: string): void => {
    sent.push({ at: Date.now(), data });
    child.stdin.write(data);
  };
  const waitFor = async (pattern: RegExp, timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (pattern.test(stream)) return true;
      if (Date.now() >= deadline) return false;
      await new Promise((done) => setTimeout(done, 200));
    }
  };
  const waitForScreen = async (pattern: RegExp, timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const frames = screenFrames(stream, [...chunkMarks]);
      if (frames.some((frame) => frame.some((line) => pattern.test(line)))) return true;
      if (Date.now() >= deadline) return false;
      await new Promise((done) => setTimeout(done, 500));
    }
  };
  return {
    sent,
    capture: () => stream,
    marks: () => [...chunkMarks],
    waitFor,
    waitForScreen,
    write,
    stop: () =>
      new Promise<void>((done) => {
        const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
        force.unref?.();
        child.once("close", () => {
          clearTimeout(force);
          done();
        });
        child.stdin.end();
        child.kill("SIGTERM");
      }),
  };
}

/**
 * Minimal ANSI screen replay for the PTY capture (same replay as
 * `smoke/tui-smoke.ts`): OpenTUI redraws only changed cells, so a header that
 * changes from `4 item(s)` to `5 item(s)` must be reconstructed from the
 * escape stream, not read as raw substrings. Frames are snapshotted at every
 * output chunk boundary so intermediate states stay observable.
 */
function screenFrames(
  capture: string,
  marks: readonly number[],
  rows = SCREEN_ROWS,
  cols = SCREEN_COLS,
): string[][] {
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => " "));
  const frames: string[][] = [];
  let row = 0;
  let col = 0;
  let mark = 0;
  const snapshot = (): void => {
    frames.push(grid.map((line) => line.join("").replace(/\s+$/, "")));
  };
  const at = (nextRow: number, nextCol: number): void => {
    row = Math.min(Math.max(nextRow, 0), rows - 1);
    col = Math.min(Math.max(nextCol, 0), cols - 1);
  };
  const clear = (): void => {
    for (const line of grid) line.fill(" ");
    row = 0;
    col = 0;
  };
  for (let i = 0; i < capture.length;) {
    while (mark < marks.length && marks[mark]! <= i) {
      snapshot();
      mark += 1;
    }
    const ch = String.fromCodePoint(capture.codePointAt(i)!);
    if (ch === "\x1b") {
      const rest = capture.slice(i);
      const csi = /^\x1b\[([0-9;?<>=]*)([ -/]*)([@-~])/.exec(rest);
      if (csi) {
        const params = csi[1]!.replace(/[?<>=]/g, "");
        const parts = params.split(";").map((value) => (value === "" ? NaN : Number(value)));
        const count = (index: number): number =>
          Number.isFinite(parts[index]) ? (parts[index] as number) : 1;
        const final = csi[3]!;
        if (final === "H" || final === "f") at(count(0) - 1, count(1) - 1);
        else if (final === "A") at(row - count(0), col);
        else if (final === "B") at(row + count(0), col);
        else if (final === "C") at(row, col + count(0));
        else if (final === "D") at(row, col - count(0));
        else if (final === "G") at(row, count(0) - 1);
        else if (final === "d") at(count(0) - 1, col);
        else if (final === "K") {
          const line = grid[row]!;
          const from = parts[0] === 2 ? 0 : col;
          for (let x = from; x < cols; x += 1) line[x] = " ";
        } else if (final === "J") {
          if (parts[0] === 2) clear();
          else for (let x = col; x < cols; x += 1) grid[row]![x] = " ";
        } else if (final === "h" && params.includes("1049")) {
          clear(); // alt screen entered: the pre-TUI screen is gone
        }
        i += csi[0].length;
        continue;
      }
      const control =
        /^\x1b\][\s\S]*?(?:\x07|\x1b\\)/.exec(rest) ?? // OSC
        /^\x1b[P^_][\s\S]*?\x1b\\/.exec(rest); // DCS / APC / PM (kitty graphics)
      i += control === null ? 2 : control[0].length;
      continue;
    }
    if (ch === "\r") {
      col = 0;
    } else if (ch === "\n") {
      at(row + 1, col);
    } else if (ch === "\b") {
      col = Math.max(col - 1, 0);
    } else if (ch >= " ") {
      grid[row]![col] = ch;
      if (col < cols - 1) col += 1;
    }
    i += ch.length;
  }
  snapshot();
  return frames;
}

/** Distinct panel headers plus the ids the frames drew. */
export function observePanel(
  frames: readonly (readonly string[])[],
  ids: { createdId: string; silentId: string },
): PanelObservation {
  const headers: string[] = [];
  let createdSeen = false;
  let silentSeen = false;
  for (const frame of frames) {
    for (const line of frame) {
      const count = panelHeaderCount(line);
      if (count !== undefined) {
        const header = `arggon board · ${count} item(s)`;
        if (!headers.includes(header)) headers.push(header);
      }
      if (line.includes(ids.createdId)) createdSeen = true;
      if (line.includes(ids.silentId)) silentSeen = true;
    }
  }
  return { headers, createdSeen, silentSeen };
}

// ---------------------------------------------------------------------------
// Fixture plumbing
// ---------------------------------------------------------------------------

function git(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
  const proc = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 60_000 });
  return { code: proc.status ?? -1, stdout: proc.stdout ?? "", stderr: proc.stderr ?? "" };
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

/** A four-item tree (`initiative → epic → story → task`) through the kernel. */
function seedTracker(repo: string): void {
  runInit({ dir: repo, force: false });
  const chain: Array<[string, string, string | undefined, string]> = [
    ["initiative", "Panel smoke", undefined, INITIATIVE_ID],
    ["epic", "Core", INITIATIVE_ID, EPIC_ID],
    ["story", "Panel story", EPIC_ID, STORY_ID],
    ["task", "Panel task", STORY_ID, TASK_ID],
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
}

/** The story directory holding the leaves (resolved from the kernel's own list). */
function storyDirectory(repo: string): string {
  const listed = spawnSync(
    process.execPath,
    [
      join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      join(repoRoot, "cli", "src", "cli.ts"),
      "list",
      "--full",
      "--json",
    ],
    { cwd: repo, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
  );
  try {
    const items = (
      JSON.parse(listed.stdout ?? "{}") as { items?: Array<{ id?: string; path?: string }> }
    ).items;
    const story = items?.find((item) => item.id === STORY_ID)?.path;
    if (story !== undefined) return join(repo, ...dirname(story).split("/"));
  } catch {
    // Fall through to the conventional path below.
  }
  return join(repo, "ArggonManager", "panel-smoke", "panel-core", "panel-story");
}

/** The item file a hand-written tracker change lands in (no event fires). */
function silentItemPath(repo: string): string {
  return join(storyDirectory(repo), `${SILENT_ID}.md`);
}

/** The item file the session's shell command creates. */
function createdItemPath(repo: string): string {
  return join(storyDirectory(repo), `${CREATED_ID}.md`);
}

type ApiResponse = { status: number; json: unknown; text: string };

async function serviceApi(
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
  return { status: response.status, json, text };
}

/**
 * The vendored copy of a plugin source: `arggon init` prepends its
 * `// arggon:generated template="…"` provenance line, the bytes after it must
 * equal the source exactly.
 */
export function vendoredSourceMatches(vendored: string, source: string): boolean {
  const body = vendored.startsWith("// arggon:generated")
    ? vendored.slice(vendored.indexOf("\n") + 1)
    : vendored;
  return body === source;
}

async function main(): Promise<void> {
  console.log("smoke:opencode:panel-refresh — T4 event-driven board panel refresh");
  const bin = opencodeBinary();
  if (bin === undefined) {
    console.log("skipped: opencode not installed");
    return;
  }
  const scriptVersion = spawnSync("script", ["--version"], { encoding: "utf8", timeout: 15_000 });
  if (
    scriptVersion.status !== 0 ||
    !`${scriptVersion.stdout}${scriptVersion.stderr}`.includes("util-linux")
  ) {
    console.log("skipped: util-linux `script` (PTY bridge) not available");
    return;
  }

  const parent = realpathSync(mkdtempSync(join(tmpdir(), "arggon-panel-smoke-")));
  const repo = join(parent, "repo-panel");
  const home = join(parent, "home");
  const binDir = join(parent, "panel-bin");
  mkdirSync(home, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  let tui: TuiRun | undefined;
  let serviceBase = "";
  let servicePassword = "";
  let sessionID = "";

  // The hermetic environment: no global plugins, no global service. Every
  // `opencode`/`arggon`/engine call below inherits exactly this.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_DATA_HOME: join(home, ".local", "share"),
    XDG_STATE_HOME: join(home, ".local", "state"),
    XDG_CACHE_HOME: join(home, ".cache"),
    PWD: repo,
    ARGON_ITEM: undefined,
    PATH: `${binDir}:${process.env.PATH ?? ""}`,
  };

  try {
    // 1. Fixture: the tracker, the vendored artifact, a git repo and the CLI
    //    shim the session's shell command resolves `arggon` through.
    seedTracker(repo);
    git(repo, ["init", "-q", "-b", "main"]);
    git(repo, ["config", "user.email", "panel-smoke@example.test"]);
    git(repo, ["config", "user.name", "Panel Smoke"]);
    git(repo, ["config", "maintenance.auto", "false"]);
    git(repo, ["add", "-A"]);
    git(repo, ["commit", "-qm", "chore: panel-smoke fixture"]);
    const shim = join(binDir, "arggon");
    writeFileSync(
      shim,
      `#!/bin/sh\nexec "${process.execPath}" "${join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs")}" "${join(repoRoot, "cli", "src", "cli.ts")}" "$@"\n`,
      "utf8",
    );
    chmodSync(shim, 0o755);
    const committed = readFileSync(
      fileURLToPath(new URL("../opencode/plugins/arggon/index.bundle.ts", import.meta.url)),
      "utf8",
    );
    const vendoredTui = join(repo, ".opencode", "plugins", "arggon", "tui.tsx");
    const pushedTui = readFileSync(
      fileURLToPath(new URL("../opencode/plugins/arggon/tui.tsx", import.meta.url)),
      "utf8",
    );
    const vendoredTuiSource = existsSync(vendoredTui) ? readFileSync(vendoredTui, "utf8") : "";
    const vendoredBundle = readFileSync(
      join(repo, ".opencode", "plugins", "arggon", "index.ts"),
      "utf8",
    );
    check(
      "the fixture carries this checkout's bundle and TUI entry byte for byte",
      vendoredSourceMatches(vendoredBundle, committed) &&
        vendoredSourceMatches(vendoredTuiSource, pushedTui),
      `vendored TUI entry: ${vendoredTui}`,
    );
    check(
      "the vendored TUI entry is event-driven: the refresh allow-list and no timer",
      artifactFaults(vendoredTuiSource).length === 0,
      artifactFaults(vendoredTuiSource).join("; "),
    );

    // 2. A managed service of our own on a free port (the default 49374 belongs
    //    to the machine's service) plus an empty session on it.
    const port = await freePort();
    spawnSync(bin, ["service", "set", "port", String(port)], { env, encoding: "utf8" });
    const created = spawnSync(
      bin,
      ["api", "session.create", "-d", JSON.stringify({ location: { directory: repo } })],
      { cwd: repo, env, encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
    );
    try {
      sessionID = (JSON.parse(created.stdout ?? "{}") as { data?: { id?: string } }).data?.id ?? "";
    } catch {
      sessionID = "";
    }
    const serviceFile = join(home, ".config", "opencode", "service.json");
    if (existsSync(serviceFile)) {
      const parsed = JSON.parse(readFileSync(serviceFile, "utf8")) as { password?: string };
      servicePassword = parsed.password ?? "";
    }
    serviceBase = `http://127.0.0.1:${port}`;
    check(
      "a hermetic managed service hosts an empty session on a free port",
      sessionID.startsWith("ses_") && servicePassword !== "",
      `${created.stdout ?? ""}${created.stderr ?? ""}`,
    );
    if (!sessionID.startsWith("ses_") || servicePassword === "") {
      console.log(`fixture kept: ${parent}`);
      return;
    }

    // 3. The TUI on that session: open the panel and hold it open. The
    //    whole-run budget (`ARGON_PANEL_SMOKE_TIMEOUT_MS`) has teeth: when it
    //    runs out the TUI is stopped, so the step in flight fails instead of
    //    hanging the harness.
    tui = startTui(repo, env, sessionID);
    const watchdog = setTimeout(() => {
      console.error(
        `smoke:opencode:panel-refresh: ${TIMEOUT_MS} ms budget exhausted — stopping the TUI`,
      );
      void tui?.stop();
    }, TIMEOUT_MS);
    watchdog.unref?.();
    try {
      await new Promise((done) => setTimeout(done, BOOT_MS));
      tui.write(SLASH_COMMAND);
      await new Promise((done) => setTimeout(done, SUBMIT_MS));
      tui.write("\r");
      const opened = await tui.waitForScreen(/arggon board · 4 item\(s\)/, REFRESH_TIMEOUT_MS);
      const keysAtOpen = tui.sent.length;
      check(
        `the panel opens on the stale tree (${BEFORE_COUNT} item(s)) before any event`,
        opened,
        `capture: ${tui.capture().slice(-600)}`,
      );

      // 4. The event: the session's own shell endpoint runs the create through
      //    the CLI shim while the panel is open.
      const shell = await serviceApi(
        serviceBase,
        servicePassword,
        "POST",
        `/api/session/${sessionID}/shell`,
        { command: `arggon create task "Live refresh" --parent ${STORY_ID} --id ${CREATED_STEM}` },
      );
      check(
        "the session shell endpoint ran the tracker mutation (session.shell.ended emitted)",
        shell.status >= 200 && shell.status < 300 && existsSync(createdItemPath(repo)),
        `status ${shell.status}: ${shell.text.slice(0, 300)}`,
      );
      const refreshed = await tui.waitForScreen(/arggon board · 5 item\(s\)/, REFRESH_TIMEOUT_MS);
      check(
        "the open panel repaints the new item with no keypress (event-driven refresh)",
        refreshed && tui.sent.length === keysAtOpen,
        `keys sent after open: ${tui.sent.length - keysAtOpen}; capture: ${tui.capture().slice(-400)}`,
      );

      // 5. No polling: a tracker change with NO event must stay invisible.
      const silent = silentItemPath(repo);
      mkdirSync(dirname(silent), { recursive: true });
      writeFileSync(
        silent,
        `---\ntype: task\nstatus: todo\nid: ${SILENT_ID}\ntitle: Silent write\nparent: ${STORY_ID}\n---\n\n# Silent write\n`,
        "utf8",
      );
      await new Promise((done) => setTimeout(done, IDLE_WINDOW_MS));
      const frames = screenFrames(tui.capture(), tui.marks());
      const observation = observePanel(frames, { createdId: CREATED_ID, silentId: SILENT_ID });
      check(
        `no polling fallback: the ${IDLE_WINDOW_MS} ms idle window draws no silently written item`,
        !observation.silentSeen,
        `headers: ${JSON.stringify(observation.headers)}`,
      );
      check(
        "the refresh contract held end to end (stale open → event → fresh, silently written item absent)",
        refreshFaults(observation, {
          before: BEFORE_COUNT,
          after: BEFORE_COUNT + 1,
          createdId: CREATED_ID,
          silentId: SILENT_ID,
        }).length === 0,
        refreshFaults(observation, {
          before: BEFORE_COUNT,
          after: BEFORE_COUNT + 1,
          createdId: CREATED_ID,
          silentId: SILENT_ID,
        }).join("; ") || `headers: ${JSON.stringify(observation.headers)}`,
      );
      check(
        "the TUI capture has no arggon plugin load failure",
        !/failed to load plugin[^\n]*arggon/i.test(tui.capture()),
        "the vendored plugin failed to load in the fixture",
      );
    } finally {
      clearTimeout(watchdog);
    }
  } finally {
    if (tui !== undefined) await tui.stop();
    // The managed service is a background process: stop it before the fixture
    // disappears (best effort — the port is private to this HOME anyway).
    try {
      spawnSync(bin, ["service", "stop"], { env, encoding: "utf8", timeout: 30_000 });
    } catch {
      // Best-effort teardown.
    }
    if (failures.length === 0 && !KEEP) rmSync(parent, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(
      `\nsmoke:opencode:panel-refresh FAILED — ${failures.length} check(s):\n${failures
        .map((failure) => `- ${failure}`)
        .join("\n")}`,
    );
    console.error(`fixture kept for inspection: ${parent}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    "\nsmoke:opencode:panel-refresh passed — the open panel refreshes from the OpenCode " +
      "event stream (no keypress, no timer) and ignores a tracker change no event announced",
  );
  if (KEEP) console.log(`fixture kept: ${parent}`);
}

// Direct-run guard: the pure predicates stay importable by the unit test wrapper.
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
      `smoke:opencode:panel-refresh FAILED — ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
