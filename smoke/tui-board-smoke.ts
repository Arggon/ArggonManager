#!/usr/bin/env node
/**
 * task-ui-browser-smoke-ci: model-free TUI board frame check.
 *
 * `arggon board --tui` is interactive and no browser automation applies
 * (ADR 0008: the TUI smoke is a scripted pty render check). This harness runs
 * the built CLI in a real PTY (util-linux `script`, the same bridge as
 * `smoke/tui-smoke.ts`), sends `q` to quit, and asserts the captured frame
 * carries the five status headers plus a seeded item id — a regression net for
 * the raw-ANSI renderer without a model in the loop.
 *
 * Bounded by design. Exit codes: 0 — passed or `skipped:` (util-linux `script`
 * unavailable); 1 — a check failed (the fixture is kept).
 * `ARGON_TUI_BOARD_KEEP=1` keeps the fixture on success,
 * `ARGON_TUI_BOARD_TIMEOUT_MS` changes the pty budget (default 30000 ms).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "dist", "cli.js");
const TIMEOUT_MS = Number(process.env.ARGON_TUI_BOARD_TIMEOUT_MS ?? 30_000);
const KEEP = process.env.ARGON_TUI_BOARD_KEEP === "1";
/** Item created in the fixture; its id must appear in the rendered frame. */
const SEEDED_ITEM_ID = "task-board-task";

/** The v0 statuses whose column headers the TUI must render. */
export const TUI_STATUS_HEADERS = ["todo", "in_progress", "blocked", "done", "cancelled"];

/**
 * Frame markers missing from a capture: one per status header and the seeded
 * item id. Empty array = the frame carries every marker.
 */
export function missingFrameMarkers(frame: string, itemId: string): string[] {
  const missing = TUI_STATUS_HEADERS.filter((status) => !frame.includes(`${status} (`));
  if (!frame.includes(itemId)) missing.push(itemId);
  return missing;
}

/** True when `bin` is util-linux `script` (BSD/macOS flags differ). */
export function hasUtilLinuxScript(): boolean {
  const probe = spawnSync("script", ["--version"], { encoding: "utf8", timeout: 15_000 });
  if (probe.status !== 0) return false;
  return `${probe.stdout ?? ""}${probe.stderr ?? ""}`.includes("util-linux");
}

function check(name: string, ok: boolean, detail?: string): boolean {
  const suffix =
    ok || detail === undefined ? "" : `\n      ${detail.split("\n").slice(0, 6).join("\n      ")}`;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${suffix}`);
  return ok;
}

/** Fresh git repo + `arggon init` + a 4-item tree, all through the built CLI. */
function createFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), "arggon-tui-board-smoke-"));
  const run = (args: string[]): ReturnType<typeof spawnSync> =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd: fixture,
      encoding: "utf8",
      timeout: 60_000,
    });
  const git = (args: string[]): void => {
    const result = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stdout ?? ""}${result.stderr ?? ""}`);
    }
  };
  git(["init", "-q"]);
  git(["config", "user.email", "smoke@example.test"]);
  git(["config", "user.name", "TUI Smoke"]);
  writeFileSync(join(fixture, "README.md"), "# tui board smoke fixture\n", "utf8");
  git(["add", "README.md"]);
  git(["commit", "-qm", "chore: fixture"]);

  const init = run(["init", fixture, "--json"]);
  if (init.status !== 0) {
    throw new Error(`arggon init failed: ${init.stdout ?? ""}${init.stderr ?? ""}`);
  }
  const chain: Array<[string, string, string | undefined]> = [
    ["initiative", "TUI smoke", undefined],
    ["epic", "Core", "tui-smoke"],
    ["story", "Entries", "core"],
    ["task", "Board task", "entries"],
  ];
  for (const [type, title, parent] of chain) {
    const result = run([
      "create",
      type,
      title,
      ...(parent !== undefined ? ["--parent", parent] : []),
      "--json",
    ]);
    if (result.status !== 0) {
      throw new Error(`arggon create ${type} failed: ${result.stdout ?? ""}${result.stderr ?? ""}`);
    }
  }
  return fixture;
}

/** Run `board --tui` in a PTY; quit once the frame rendered and return the capture. */
function runTui(fixture: string): Promise<string> {
  return new Promise((resolveCapture) => {
    const quote = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;
    const child = spawn(
      "script",
      [
        "-qec",
        // Wide enough that every column and the seeded id render unwrapped.
        `stty cols 200 rows 40; ${quote(process.execPath)} ${quote(cli)} board --tui`,
        "/dev/null",
      ],
      {
        cwd: fixture,
        env: { ...process.env, TERM: "xterm-256color" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const chunks: Buffer[] = [];
    let capture = "";
    let quitSent = false;
    // Quit as soon as the frame carries every marker (no render-time guess);
    // the fallback quits anyway so a broken render still fails loudly.
    const quit = (): void => {
      if (quitSent) return;
      quitSent = true;
      child.stdin.write("q");
    };
    const quitWhenRendered = (): void => {
      if (missingFrameMarkers(capture, SEEDED_ITEM_ID).length === 0) quit();
    };
    const onData = (chunk: Buffer): void => {
      chunks.push(chunk);
      capture += chunk.toString("utf8");
      quitWhenRendered();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const timers = [
      setTimeout(quit, 15_000),
      setTimeout(() => {
        child.stdin.end();
        child.kill("SIGTERM");
      }, TIMEOUT_MS),
    ];
    const done = (): void => {
      for (const timer of timers) clearTimeout(timer);
      resolveCapture(Buffer.concat(chunks).toString("utf8"));
    };
    child.on("close", done);
    child.on("error", done);
  });
}

async function main(): Promise<void> {
  console.log("smoke:tui-board — arggon board --tui frame check");
  if (!hasUtilLinuxScript()) {
    console.log("skipped: util-linux `script` (PTY bridge) not available");
    return;
  }
  if (!existsSync(cli)) {
    console.error(`smoke:tui-board FAILED — built bin missing: ${cli} (run: npm run build)`);
    process.exitCode = 1;
    return;
  }

  const fixture = createFixture();
  console.log(`fixture: ${fixture}`);
  const frame = await runTui(fixture);
  const missing = missingFrameMarkers(frame, SEEDED_ITEM_ID);
  const passed = check(
    "the TUI frame carries the five status headers and the seeded item id",
    missing.length === 0,
    `missing: ${missing.join(", ")}\n${frame}`,
  );
  if (passed) {
    console.log("\nsmoke:tui-board passed — the TUI renders the board frame");
    if (!KEEP) rmSync(fixture, { recursive: true, force: true });
    return;
  }
  console.error(`\nsmoke:tui-board FAILED — fixture kept for inspection: ${fixture}`);
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
  main().catch((err: unknown) => {
    console.error(`smoke:tui-board FAILED — ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
