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
 *   4. interact — only AFTER the panel header is captured (a regression cannot
 *      leak keys into the prompt/model call), the harness types `j` (cursor
 *      down), `n` (kernel `next` jump), `a` (active-item jump, pinned with
 *      `ARGON_ITEM=story`) and Enter (inline detail block), and asserts each
 *      frame: the `❯` cursor line, the jump targets and
 *      `┌ argon detail · story — Story`.
 *   5. corrupt   — a duplicate-id tracker renders the unreadable header, never
 *      a slot crash (W5 review P1).
 *   6. clean     — the capture carries no plugin load failure for argon.
 *
 * Bounded by design. Exit codes: 0 — checks passed or `skipped:` (opencode or
 * util-linux `script` absent); 1 — a check failed (the fixture is kept).
 * `ARGON_TUI_SMOKE_KEEP=1` keeps the fixture on success,
 * `ARGON_TUI_SMOKE_TIMEOUT_MS` changes the TUI run budget (default 30000 ms),
 * `ARGON_TUI_SMOKE_SCREEN=1` dumps the replayed screen frames that show the
 * cursor/detail rows (review evidence without ANSI noise).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
/** Panel header: the key sequence is only sent once this has been captured. */
const PANEL_OPEN_MARKER = "arggon board ·";
/** Gap between interaction keys (the panel re-renders on every key). */
const KEY_GAP_MS = 1200;

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

/** One PTY run: the decoded capture plus the chunk boundaries (frame marks). */
type TuiCapture = { capture: string; marks: number[] };

/**
 * Run the TUI inside a PTY for `TUI_TIMEOUT_MS`, typing the slash command after
 * the UI has started (the runtime needs a moment to boot the session view).
 * `keys` are sent only once the captured output shows the panel header, one per
 * `KEY_GAP_MS`: a regression that never opens the panel must not leak the keys
 * into the prompt (Enter there would submit a real model call). Returns the
 * captured terminal bytes (stdout+stderr share the pty) and the byte offset of
 * every output chunk, so `screenFrames` can replay the drawn states.
 */
function runTui(
  cwd: string,
  env: NodeJS.ProcessEnv,
  sessionID: string,
  keys: readonly string[] = [],
): Promise<TuiCapture> {
  return new Promise<TuiCapture>((resolve) => {
    const child = spawn(
      "script",
      ["-qec", `stty cols 120 rows 40; opencode -s ${sessionID}`, "/dev/null"],
      { cwd, env: { ...env, TERM: "xterm-256color" }, stdio: ["pipe", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    const marks: number[] = [];
    let stream = "";
    let keysSent = false;
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
    const onData = (chunk: Buffer): void => {
      chunks.push(chunk);
      stream += chunk.toString("utf8");
      marks.push(stream.length);
      if (keysSent || keys.length === 0) return;
      if (!stream.includes(PANEL_OPEN_MARKER)) return;
      keysSent = true;
      keys.forEach((key, index) => {
        timers.push(setTimeout(() => child.stdin.write(key), KEY_GAP_MS + index * KEY_GAP_MS));
      });
    };
    child.stdin.on("error", () => {});
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const done = (): void => {
      for (const timer of timers) clearTimeout(timer);
      resolve({ capture: Buffer.concat(chunks).toString("utf8"), marks });
    };
    child.on("close", done);
    child.on("error", done);
  });
}

const SCREEN_ROWS = 40;
const SCREEN_COLS = 120;

/**
 * Minimal ANSI screen replay for the PTY capture. OpenTUI redraws only the
 * cells that changed (a `j` rewrites one cursor cell, not the whole row), so
 * raw substring assertions cannot see a moved cursor; replaying CUP/SGR/erase
 * into a bounded grid reconstructs what the user actually saw. Frames are
 * snapshotted at every output chunk boundary so intermediate states stay
 * observable. Unknown escapes are skipped (never drawn as text).
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

/** True when any replayed frame drew a row matching `pattern`. */
function sawFrame(frames: readonly string[][], pattern: RegExp): boolean {
  return frames.some((frame) => frame.some((line) => pattern.test(line)));
}

/** The last replayed screen, for failure details (no ANSI noise). */
function screenText(frames: readonly string[][]): string {
  return frames[frames.length - 1]?.join("\n") ?? "";
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
    // 4. PTY run: the panel opens from the slash command, renders the tree and
    //    then takes the interaction keys. `ARGON_ITEM` pins the session's
    //    active item so the `a` jump is deterministic.
    const activeEnv: NodeJS.ProcessEnv = { ...env, ARGON_ITEM: "story" };
    return runTui(fixture, activeEnv, sessionID, ["j", "n", "a", "\r"]).then(
      ({ capture, marks }) => {
        // OpenTUI redraws only changed cells, so assertions run on the replayed
        // screen frames, not on raw capture substrings.
        const frames = screenFrames(capture, marks);
        const screen = screenText(frames);
        check(
          "the panel opens from the command and renders the current tree",
          sawFrame(frames, /arggon board · 4 item\(s\)/) &&
            sawFrame(frames, /· T task-board-task — Board task/),
          screen,
        );
        check(
          "the command palette lists the Arggon board command",
          sawFrame(frames, /Open Arggon board/),
          screen,
        );
        check(
          "the TUI capture has no arggon plugin load failure",
          !/failed to load plugin[^\n]*arggon/i.test(capture),
          screen,
        );

        // Interaction capture (task-native-panel-interaction): the cursor seeds
        // on the first line, `j` moves it one down, `n` jumps to the kernel
        // next suggestion, `a` to the active item and Enter opens its detail.
        check(
          "the panel marks the selected line with the cursor",
          sawFrame(frames, /❯ · I tui-smoke — TUI smoke/),
          screen,
        );
        check(
          "j moves the cursor to the next tree line",
          sawFrame(frames, /❯ +· E core — Core/),
          screen,
        );
        check(
          "n jumps to the kernel next suggestion",
          sawFrame(frames, /❯ +· T task-board-task — Board task/),
          screen,
        );
        check(
          "a jumps to the session's active item",
          sawFrame(frames, /❯ +▶· S story — Story/),
          screen,
        );
        check(
          "enter opens the bounded inline detail block",
          sawFrame(frames, /┌ argon detail · story — Story/),
          screen,
        );

        // Review evidence (`ARGON_TUI_SMOKE_SCREEN=1`): the distinct replayed
        // rows that carry the cursor or the detail block, deduped.
        if (process.env.ARGON_TUI_SMOKE_SCREEN === "1") {
          const marker = /❯ +[·▶]|┌ argon detail/;
          const printed = new Set<string>();
          for (const frame of frames) {
            const hits = frame.filter((line) => marker.test(line)).join("\n");
            if (hits === "" || printed.has(hits)) continue;
            printed.add(hits);
            console.log(`\n--- screen frame ---\n${hits}`);
          }
        }

        // 5. Corrupt tracker (W5 review P1): a duplicate id used to crash the
        //    slot with "Plugin arggon.tui crashed in slot session.panel:
        //    Duplicate id '…'". The board must degrade to the unreadable header.
        const listed = JSON.parse(run(["list", "--full", "--json"]).stdout ?? "{}") as {
          items?: Array<{ id?: string; path?: string }>;
        };
        const taskPath = listed.items?.find((item) => item.id === "task-board-task")?.path;
        check(
          "the created task resolves to a tracker path",
          typeof taskPath === "string",
          JSON.stringify(listed).slice(0, 200),
        );
        if (typeof taskPath !== "string") {
          finish(fixture);
          return;
        }
        writeFileSync(
          join(fixture, ...dirname(taskPath).split("/"), "dupe.md"),
          "---\ntype: task\nstatus: todo\nid: task-board-task\ntitle: Duplicate\n---\n\n# Duplicate\n",
          "utf8",
        );
        return runTui(fixture, env, sessionID).then(({ capture: dupe, marks: dupeMarks }) => {
          const dupeFrames = screenFrames(dupe, dupeMarks);
          check(
            "a corrupt tracker degrades the panel to the unreadable header (P1)",
            sawFrame(dupeFrames, /arggon board · tracker unreadable/) &&
              !dupe.includes("crashed in slot"),
            screenText(dupeFrames),
          );
          finish(fixture);
        });
      },
    );
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
