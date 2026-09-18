/**
 * Torn-read probe for `tasks/.convention.yml` (F3, bug-atomic-write-followups).
 *
 * Before the fix the three config writers (init scaffold, `applyDocsPlan`'s
 * state rewrite, `adopt --ack`) rewrote the file in place — open+truncate,
 * then write — so a concurrent reader could observe an empty or partial file.
 * `readConventionConfig` throws on it (branch/list/view paths) and
 * `readConventionVersion` silently degrades to version 0.
 *
 * The probe widens the truncate window the way the comment race does: a ~1MB
 * comment block is inserted before `x-generated`, which the re-run writers
 * preserve and then re-append the state section after — so a partial write is
 * always a prefix that is missing the final `x-generated:` section. Tight-loop
 * reader children hammer the file while real writer children race through the
 * actual code paths; every observation must be a complete file.
 *
 * Pre-fix evidence (same probe, writers reverted to writeFileSync): torn
 * observations > 0 with these reader/writer counts; with the atomic writes the
 * committed assertion below observes 0.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CONVENTION_VERSION, readConventionConfig } from "./convention.js";
import { runInit } from "./init.js";

const TIMEOUT_MS = 120_000;
const READERS = 3;
const WRITERS = 2;
const ITERATIONS = 8;
/** ~1.2MB of ignored comment lines, inserted before the x-generated section. */
const PAD_LINES = 20_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tsxLoader = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");

type ReaderStats = { reads: number; torn: number; samples: string[] };
type ChildResult = { code: number | null; stderr: string };

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});

function seed(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `arggon-config-race-${prefix}-`));
  dirs.push(dir);
  runInit({ dir, force: false, full: true });
  const yml = join(dir, "tasks", ".convention.yml");
  const raw = readFileSync(yml, "utf8");
  const start = raw.indexOf("x-generated:");
  expect(start).toBeGreaterThanOrEqual(0);
  const pad = Array.from({ length: PAD_LINES }, (_, i) => `# pad ${i} ${"x".repeat(48)}`).join(
    "\n",
  );
  writeFileSync(yml, `${raw.slice(0, start)}${pad}\n${raw.slice(start)}`, "utf8");
  return dir;
}

/** Driver that loops a real writer in a child process (no vitest mocks). */
function writeDriver(dir: string, name: string, source: string): string {
  const path = join(dir, `driver-${name}.ts`);
  writeFileSync(path, source, "utf8");
  return path;
}

function initDriverSource(force: boolean): string {
  return `
import { runInit } from ${JSON.stringify(resolve(repoRoot, "cli/src/init.ts"))};
const [dir, n] = process.argv.slice(2);
for (let i = 0; i < Number(n); i++) runInit({ dir, force: ${force} });
`;
}

function ackDriverSource(): string {
  return `
import { runAdoptAck } from ${JSON.stringify(resolve(repoRoot, "cli/src/adopt.ts"))};
const [dir, n] = process.argv.slice(2);
for (let i = 0; i < Number(n); i++) runAdoptAck({ cwd: dir });
`;
}

function runChild(args: string[]): Promise<ChildResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    const killTimer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS - 10_000);
    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolvePromise({ code, stderr });
    });
  });
}

/**
 * Reader children tight-loop the config file until `stopFile` exists. A read
 * is TORN when it is not a complete document: an empty/partial prefix misses
 * the final `x-generated:` section (or the leading `version:` line). Each
 * reports `{reads, torn, samples}`.
 */
function startReaders(target: string, stopFile: string, n: number): Array<Promise<ReaderStats>> {
  const script = `
    const fs = require("node:fs");
    const [target, stop] = process.argv.slice(1);
    let reads = 0, torn = 0; const samples = [];
    const deadline = Date.now() + ${TIMEOUT_MS};
    while (Date.now() < deadline && !fs.existsSync(stop)) {
      let s;
      try { s = fs.readFileSync(target, "utf8"); }
      catch (e) { torn++; if (samples.length < 3) samples.push("ERR " + e.code); continue; }
      reads++;
      if (!s.startsWith("version:") || !s.includes("x-generated:")) {
        torn++;
        if (samples.length < 3) samples.push("len=" + s.length + " tail=" + JSON.stringify(s.slice(-24)));
      }
    }
    console.log(JSON.stringify({ reads, torn, samples }));
  `;
  return Array.from(
    { length: n },
    () =>
      new Promise<ReaderStats>((resolvePromise) => {
        const child = spawn(process.execPath, ["-e", script, target, stopFile], {
          stdio: ["ignore", "pipe", "inherit"],
        });
        let out = "";
        child.stdout.on("data", (chunk: string) => (out += chunk));
        child.on("close", () => {
          resolvePromise(
            out.trim()
              ? (JSON.parse(out.trim()) as ReaderStats)
              : { reads: 0, torn: 0, samples: [] },
          );
        });
      }),
  );
}

async function probe(dir: string, driver: string, label: string, keepPad: boolean): Promise<void> {
  const yml = join(dir, "tasks", ".convention.yml");
  const stopFile = join(dir, `STOP-${label}`);
  const readers = startReaders(yml, stopFile, READERS);
  const results = await Promise.all(
    Array.from({ length: WRITERS }, () => runChild([tsxLoader, driver, dir, String(ITERATIONS)])),
  );
  writeFileSync(stopFile, "");
  const stats = await Promise.all(readers);

  for (const result of results) {
    expect(result.code, result.stderr).toBe(0);
  }
  // Every reader actually ran (the assertion below is not vacuous).
  expect(
    stats.every((s) => s.reads > 0),
    JSON.stringify(stats),
  ).toBe(true);
  const torn = stats.reduce((sum, s) => sum + s.torn, 0);
  expect(torn, JSON.stringify(stats)).toBe(0);

  // Final state: complete, parseable, and padding preserved where expected.
  const final = readFileSync(yml, "utf8");
  expect(final).toContain("x-generated:");
  if (keepPad) expect(final).toContain("# pad 0");
  expect(readConventionConfig(dir).version).toBe(CONVENTION_VERSION);
}

describe(".convention.yml torn-read probe (F3)", () => {
  it(
    "init re-runs (applyDocsPlan state rewrite) never expose a partial config",
    async () => {
      const dir = seed("init");
      const driver = writeDriver(dir, "init", initDriverSource(false));
      await probe(dir, driver, "init", true);
    },
    TIMEOUT_MS,
  );

  it(
    "adopt --ack never exposes a partial config",
    async () => {
      const dir = seed("ack");
      const driver = writeDriver(dir, "ack", ackDriverSource());
      await probe(dir, driver, "ack", true);
    },
    TIMEOUT_MS,
  );

  it(
    "init --force re-scaffold (initial convention write) never exposes a partial config",
    async () => {
      const dir = seed("force");
      const driver = writeDriver(dir, "force", initDriverSource(true));
      // The forced re-scaffold rebuilds from the template, so the seed padding
      // is dropped by the first write (keepPad: false) — the probe still
      // covers the initial convention write and the follow-up state rewrite.
      await probe(dir, driver, "force", false);
    },
    TIMEOUT_MS,
  );
});
