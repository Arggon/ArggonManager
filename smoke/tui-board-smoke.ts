#!/usr/bin/env node
/**
 * task-ui-browser-smoke-ci / task-tui-detail-pane: model-free TUI frame check.
 *
 * `arggon board --tui` is interactive and no browser automation applies
 * (ADR 0008: the TUI smoke is a scripted pty render check). This harness runs
 * the built CLI in a real PTY (util-linux `script`, the same bridge as
 * `smoke/tui-smoke.ts`) and drives a bounded scripted session: the board frame
 * (five status headers + the seeded item id) → `/` filter down to the seeded
 * task → Enter opens its read-only detail pane (acceptance rows + body) →
 * PgDn scrolls the pane → Esc returns to the board with the same selection and
 * filter → q. A regression net for the raw-ANSI renderer without a model in
 * the loop.
 *
 * Bounded by design. Exit codes: 0 — passed or `skipped:` (util-linux `script`
 * unavailable); 1 — a check failed (the fixture is kept).
 * `ARGON_TUI_BOARD_KEEP=1` keeps the fixture on success,
 * `ARGON_TUI_BOARD_TIMEOUT_MS` changes the whole-run pty budget (default
 * 30000 ms), `ARGON_TUI_BOARD_STEP_TIMEOUT_MS` the per-step budget (default
 * 10000 ms).
 */
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "dist", "cli.js");
const TIMEOUT_MS = Number(process.env.ARGON_TUI_BOARD_TIMEOUT_MS ?? 30_000);
const STEP_TIMEOUT_MS = Number(process.env.ARGON_TUI_BOARD_STEP_TIMEOUT_MS ?? 10_000);
const KEEP = process.env.ARGON_TUI_BOARD_KEEP === "1";
/** Item created in the fixture; its id must appear in the rendered frame. */
const SEEDED_ITEM_ID = "task-board-task";

/** The v0 statuses whose column headers the TUI must render. */
export const TUI_STATUS_HEADERS = ["todo", "in_progress", "blocked", "done", "cancelled"];

/**
 * Detail-pane markers seeded into the fixture item (seedDetailBody): the
 * acceptance summary with a checked row, an unchecked row and the body
 * section. The pane must render all of them from the real item file.
 */
export const SEEDED_DETAIL_MARKERS = [
  "acceptance 1/2",
  "[x] seeded acceptance row",
  "[ ] pending acceptance row",
  "body:",
];

/**
 * Frame markers missing from a capture: one per status header and the seeded
 * item id. Empty array = the frame carries every marker.
 */
export function missingFrameMarkers(frame: string, itemId: string): string[] {
  const missing = TUI_STATUS_HEADERS.filter((status) => !frame.includes(`${status} (`));
  if (!frame.includes(itemId)) missing.push(itemId);
  return missing;
}

/** The last frame the renderer drew (everything after the final clear). */
export function lastFrame(capture: string): string {
  const frames = capture.split("\x1b[H\x1b[2J");
  return frames[frames.length - 1] ?? "";
}

/** True when the frame is a board frame with the seeded card selected. */
export function isBoardFrame(frame: string, itemId: string): boolean {
  // The header itself is plain, but the selected card is SGR-wrapped, so the
  // match is substring-based like every other marker here.
  return frame.includes("arggon board --tui ·") && frame.includes(`> T ${itemId}`);
}

/**
 * Markers the detail frame must carry: the pane header for the item plus the
 * seeded acceptance/body markers. Empty array = the frame carries every one.
 * The header is bold-wrapped when color is on, so it is matched as a substring.
 */
export function missingDetailMarkers(frame: string, itemId: string): string[] {
  const missing: string[] = [];
  if (!frame.includes(`arggon detail · ${itemId}`)) missing.push(`detail header (${itemId})`);
  for (const marker of SEEDED_DETAIL_MARKERS) {
    if (!frame.includes(marker)) missing.push(marker);
  }
  return missing;
}

/** Footer position (`row 12/57`) of a frame — the last match wins. */
export function panePosition(frame: string): { row: number; total: number } | null {
  let found: { row: number; total: number } | null = null;
  for (const match of frame.matchAll(/row (\d+)\/(\d+)/g)) {
    found = { row: Number(match[1]), total: Number(match[2]) };
  }
  return found;
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

/** Recursively find `<itemId>.md` in the fixture (bounded: a tiny tree). */
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

/**
 * Body seeded into the fixture item (frontmatter untouched) so the pane has
 * deterministic acceptance rows and enough lines to scroll one page.
 */
const DETAIL_BODY = [
  "## Acceptance",
  "",
  "- [x] seeded acceptance row",
  "- [ ] pending acceptance row",
  "",
  "## Detail",
  "",
  ...Array.from({ length: 40 }, (_, i) => `detail body line ${String(i + 1).padStart(2, "0")}`),
].join("\n");

function seedDetailBody(itemFile: string): void {
  const raw = readFileSync(itemFile, "utf8");
  const end = raw.indexOf("\n---", 4); // closing frontmatter fence
  if (end === -1) throw new Error(`no frontmatter fence in ${itemFile}`);
  writeFileSync(itemFile, `${raw.slice(0, end + 4)}\n\n${DETAIL_BODY}\n`, "utf8");
}

/** One scripted step: wait until `until` matches the capture, then send `send`. */
type TuiStep = {
  label: string;
  until: (capture: string) => boolean;
  send: string;
};

type StepResult = {
  label: string;
  ok: boolean;
  /** Last frame at the time the step resolved (or timed out). */
  frame: string;
};

/**
 * Drive `board --tui` in a PTY through the seeded session: board frame →
 * filter down to the seeded task → open the pane → page it → Esc back with the
 * selection and filter intact → quit. Returns the raw capture plus one result
 * per step; a timeout marks that step failed.
 */
function runTui(fixture: string): Promise<{ capture: string; steps: StepResult[] }> {
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
    const steps: StepResult[] = [];
    const stepDefs: TuiStep[] = [
      {
        label: "board frame (five status headers + seeded item)",
        until: (capture) => missingFrameMarkers(lastFrame(capture), SEEDED_ITEM_ID).length === 0,
        send: "/", // open the search prompt
      },
      {
        label: "search prompt open",
        until: (capture) => lastFrame(capture).includes("esc to cancel"),
        send: SEEDED_ITEM_ID, // filter the board down to the seeded task
      },
      {
        label: "board filtered to the seeded task",
        until: (capture) => lastFrame(capture).includes(`filter: ${SEEDED_ITEM_ID}`),
        send: "\r", // apply the filter
      },
      {
        label: "seeded task card selected",
        until: (capture) => lastFrame(capture).includes(`> T ${SEEDED_ITEM_ID}`),
        send: "\r", // open the read-only detail pane
      },
      {
        label: "detail pane (acceptance rows + body)",
        until: (capture) => missingDetailMarkers(lastFrame(capture), SEEDED_ITEM_ID).length === 0,
        send: "\x1b[6~", // PgDn: one pane page
      },
      {
        label: "pane scrolled one page",
        until: (capture) => (panePosition(lastFrame(capture))?.row ?? 0) > 1,
        send: "\x1b", // Esc: back to the board
      },
      {
        label: "board restored, same selection and filter",
        until: (capture) =>
          isBoardFrame(lastFrame(capture), SEEDED_ITEM_ID) &&
          lastFrame(capture).includes(`filter: ${SEEDED_ITEM_ID}`),
        send: "q", // quit
      },
    ];
    let capture = "";
    let stepIndex = 0;
    let stepDeadline = Date.now() + STEP_TIMEOUT_MS;
    let finished = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const finish = (): void => {
      if (finished) return;
      finished = true;
      for (const timer of timers) clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      resolveCapture({ capture, steps });
    };

    // Advance every step whose predicate the capture already satisfies; each
    // advance records the frame and sends its key. A frame event re-runs it.
    const pump = (): void => {
      if (finished) return;
      for (;;) {
        const active = stepDefs[stepIndex];
        if (active === undefined) return; // all keys sent: wait for close
        if (!active.until(capture)) return;
        steps.push({ label: active.label, ok: true, frame: lastFrame(capture) });
        stepIndex += 1;
        stepDeadline = Date.now() + STEP_TIMEOUT_MS;
        child.stdin.write(active.send);
      }
    };

    const onData = (chunk: Buffer): void => {
      capture += chunk.toString("utf8");
      pump();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.stdin.on("error", () => {
      // The pty may be gone already (quit/timeout): the capture is the evidence.
    });
    child.on("close", finish);
    child.on("error", finish);
    timers.push(
      setInterval(() => {
        if (finished) return;
        const active = stepDefs[stepIndex];
        if (active === undefined) return;
        if (Date.now() > stepDeadline) {
          steps.push({ label: active.label, ok: false, frame: lastFrame(capture) });
          finish();
        }
      }, 100),
      setTimeout(finish, TIMEOUT_MS),
    );
  });
}

async function main(): Promise<void> {
  console.log("smoke:tui-board — arggon board --tui frame + detail pane check");
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
  try {
    const itemFile = findItemFile(fixture, SEEDED_ITEM_ID);
    if (itemFile === null) {
      throw new Error(`seeded item ${SEEDED_ITEM_ID}.md not found in the fixture`);
    }
    seedDetailBody(itemFile);
  } catch (err) {
    console.error(`smoke:tui-board FAILED — ${err instanceof Error ? err.message : String(err)}`);
    console.error(`fixture kept for inspection: ${fixture}`);
    process.exitCode = 1;
    return;
  }

  const { capture, steps } = await runTui(fixture);
  let passed = true;
  for (const step of steps) {
    passed = check(`pty step: ${step.label}`, step.ok, step.frame) && passed;
  }
  const missing = missingFrameMarkers(capture, SEEDED_ITEM_ID);
  passed =
    check(
      "the TUI frame carries the five status headers and the seeded item id",
      missing.length === 0,
      `missing: ${missing.join(", ")}\n${lastFrame(capture)}`,
    ) && passed;
  const detailStep = steps.find((step) => step.label.startsWith("detail pane"));
  passed =
    check(
      "the detail pane renders the seeded acceptance rows and the body",
      detailStep?.ok === true,
      detailStep?.frame,
    ) && passed;

  if (passed) {
    console.log("\nsmoke:tui-board passed — the TUI renders the board and its detail pane");
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
