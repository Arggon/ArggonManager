#!/usr/bin/env node
/**
 * W5 task-native-tui: TUI evidence harness (model-free).
 *
 * The TUI is interactive — CI has no driver — so the full open/close/fullscreen/
 * narrow-terminal sweep stays a documented manual checklist
 * (`ArggonManager/docs/opencode2.md` § TUI) and the wiring is covered by unit
 * tests (`opencode/plugins/arggon/tui.test.ts`). This harness provides the
 * reproducible, model-free evidence that the vendored TUI entry really loads,
 * registers its command and renders the tree in a REAL OpenCode TUI:
 *
 *   1. discipline — a fresh `arggon init` fixture gets a small tree
 *      (initiative → epic → story → task) created with the CLI; the vendored
 *      `.opencode/plugins/arggon/tui.tsx` imports the bundle relatively (no
 *      `node_modules` anywhere in the fixture).
 *   2. discovery — `opencode plugin list` reports the argon plugin directory.
 *   3. render    — a session is created through the local API (no model call),
 *      the TUI runs in a PTY (`script`), the harness types the slash command
 *      `/arggon-board` and submits it, and the captured terminal contains the
 *      panel: `arggon board · 4 item(s) · next: …` plus a tree line with the
 *      created item. That exercises discovery → transpile → setup → command →
 *      `panel.open` → `boardSnapshot` (vendored, kernel inlined) → render.
 *   4. clean     — the capture carries no plugin load failure for argon.
 *
 * Bounded by design. Exit codes: 0 — checks passed or `skipped:` (opencode or
 * util-linux `script` absent); 1 — a check failed (the fixture is kept).
 * `ARGON_TUI_SMOKE_KEEP=1` keeps the fixture on success,
 * `ARGON_TUI_SMOKE_TIMEOUT_MS` changes the TUI run budget (default 30000 ms).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "cli/src/cli.ts");
const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");
const TUI_MARKER = ".opencode/plugins/arggon/tui.tsx";
const SERVER_MARKER = ".opencode/plugins/arggon/index.ts";
const SLASH_COMMAND = "/arggon-board";
const TUI_TIMEOUT_MS = Number(process.env.ARGON_TUI_SMOKE_TIMEOUT_MS ?? 30_000);

const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string): void {
  const suffix =
    ok || detail === undefined ? "" : `\n      ${detail.split("\n").slice(0, 6).join("\n      ")}`;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${suffix}`);
  if (!ok) failures.push(name);
}

/** True when `bin` resolves on PATH. */
function available(bin: string): boolean {
  const probe = spawnSync("sh", ["-c", `command -v ${bin}`], { encoding: "utf8", timeout: 15_000 });
  return probe.status === 0 && probe.stdout.trim() !== "";
}

/**
 * Run the TUI inside a PTY for `TUI_TIMEOUT_MS`, typing the slash command after
 * the UI has started (the runtime needs a moment to boot the session view).
 * Returns the captured terminal bytes (stdout+stderr share the pty).
 */
function runTui(cwd: string, env: NodeJS.ProcessEnv, sessionID: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const child = spawn(
      "script",
      ["-qec", `stty cols 120 rows 40; opencode -s ${sessionID}`, "/dev/null"],
      { cwd, env: { ...env, TERM: "xterm-256color" }, stdio: ["pipe", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    const timers: NodeJS.Timeout[] = [
      // Type the command, then submit it separately: a single paste is bracketed
      // and the trailing newline stays literal.
      setTimeout(() => child.stdin.write(SLASH_COMMAND), 6000),
      setTimeout(() => child.stdin.write("\r"), 8000),
      setTimeout(() => {
        child.stdin.end();
        child.kill("SIGTERM");
      }, TUI_TIMEOUT_MS),
    ];
    const done = (): void => {
      for (const timer of timers) clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf8"));
    };
    child.on("close", done);
    child.on("error", done);
  });
}

function main(): void {
  console.log("smoke:tui — OpenCode V2 TUI entry (W5)");
  if (!available("opencode")) {
    console.log("skipped: opencode not installed");
    return;
  }
  // The PTY bridge is util-linux `script`; BSD/macOS `script` has different
  // flags, so the check skips instead of guessing (the manual checklist covers
  // the interactive surface everywhere).
  const scriptVersion = spawnSync("script", ["--version"], { encoding: "utf8", timeout: 15_000 });
  if (
    scriptVersion.status !== 0 ||
    !`${scriptVersion.stdout}${scriptVersion.stderr}`.includes("util-linux")
  ) {
    console.log("skipped: util-linux `script` (PTY bridge) not available");
    return;
  }

  const fixture = mkdtempSync(join(tmpdir(), "arggon-tui-smoke-"));
  const env: NodeJS.ProcessEnv = { ...process.env, PWD: fixture, ARGON_ITEM: undefined };
  console.log(`fixture: ${fixture}`);
  const run = (args: string[], timeout = 120_000) =>
    spawnSync(process.execPath, [tsx, cli, ...args], {
      cwd: fixture,
      env,
      encoding: "utf8",
      timeout,
      maxBuffer: 16 * 1024 * 1024,
    });

  // 1. Fresh init vendors both plugin entrypoints (server bundle + TUI entry).
  const init = run(["init", fixture, "--json"]);
  check(
    "arggon init succeeds on the fixture",
    init.status === 0,
    `${init.stdout ?? ""}${init.stderr ?? ""}`,
  );
  check(
    `init vendors the server entry (${SERVER_MARKER})`,
    existsSync(join(fixture, SERVER_MARKER)),
  );
  check(`init vendors the TUI entry (${TUI_MARKER})`, existsSync(join(fixture, TUI_MARKER)));
  const vendoredTui = existsSync(join(fixture, TUI_MARKER))
    ? readFileSync(join(fixture, TUI_MARKER), "utf8")
    : "";
  check(
    "the vendored TUI entry imports the bundle relatively (dependency-less)",
    vendoredTui.includes('from "./index.ts"') && !vendoredTui.includes('from "@opencode/plugin'),
  );
  check(
    "the fixture has no node_modules (dependency-less adopter shape)",
    !existsSync(join(fixture, "node_modules")),
  );

  // A small tree the panel can render.
  const chain: Array<[string, string, string | undefined]> = [
    ["initiative", "TUI smoke", undefined],
    ["epic", "Core", "tui-smoke"],
    ["story", "Story", "core"],
    ["task", "Board task", "story"],
  ];
  let created = true;
  for (const [type, title, parent] of chain) {
    const result = run([
      "create",
      type,
      title,
      ...(parent !== undefined ? ["--parent", parent] : []),
      "--json",
    ]);
    if (result.status !== 0) {
      created = false;
      console.log(`      create ${type} failed: ${result.stdout ?? ""}${result.stderr ?? ""}`);
    }
  }
  check("a 4-item tree is created for the panel", created);

  // 2. The plugin is discovered from the project's `.opencode/plugins`.
  const listed = spawnSync("opencode", ["plugin", "list"], {
    cwd: fixture,
    env,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  check(
    "`opencode plugin list` discovers the argon plugin directory",
    /\.opencode[/\\]plugins[/\\]arggon/.test(`${listed.stdout ?? ""}${listed.stderr ?? ""}`),
    `${listed.stdout ?? ""}${listed.stderr ?? ""}`,
  );

  // 3. Create an empty session through the local API (no model call) so the TUI
  //    opens a session view where `session.panel` can be opened.
  const api = spawnSync(
    "opencode",
    ["api", "session.create", "-d", JSON.stringify({ location: { directory: fixture } })],
    { cwd: fixture, env, encoding: "utf8", timeout: 120_000 },
  );
  let sessionID = "";
  try {
    sessionID = (JSON.parse(api.stdout ?? "{}") as { data?: { id?: string } }).data?.id ?? "";
  } catch {
    sessionID = "";
  }
  check(
    "an empty session is created for the panel host",
    sessionID.startsWith("ses_"),
    `${api.stdout ?? ""}${api.stderr ?? ""}`,
  );

  if (sessionID.startsWith("ses_")) {
    // 4. PTY run: the panel opens from the slash command and renders the tree.
    return runTui(fixture, env, sessionID).then((capture) => {
      check(
        "the panel opens from the command and renders the current tree",
        capture.includes("arggon board · 4 item(s)") &&
          capture.includes("· T task-board-task — Board task"),
        capture,
      );
      check(
        "the command palette lists the Arggon board command",
        capture.includes("Open Arggon board"),
        capture,
      );
      check(
        "the TUI capture has no arggon plugin load failure",
        !/failed to load plugin[^\n]*arggon/i.test(capture),
        capture,
      );
      finish(fixture);
    });
  }
  finish(fixture);
  return undefined;
}

function finish(fixture: string): void {
  if (failures.length > 0) {
    console.error(
      `\nsmoke:tui FAILED — ${failures.length} check(s):\n${failures.map((f) => `- ${f}`).join("\n")}`,
    );
    console.error(`fixture kept for inspection: ${fixture}`);
    process.exit(1);
  }
  console.log("\nsmoke:tui passed — TUI entry loads and renders the board panel");
  if (process.env.ARGON_TUI_SMOKE_KEEP !== "1") rmSync(fixture, { recursive: true, force: true });
}

void main();
