/**
 * Regression tests for the shared fixture teardown (test-tmp.ts) and the
 * writer it exists for (bug-ci-enotempty-rmretry, CI run 35401030576):
 * `git commit`/`git merge` spawn a detached `git maintenance run --auto
 * --detach` child, the daemon later materializes
 * `.git/objects/maintenance.lock`, and Node's recursive rmSync retry loop only
 * re-tries the bare rmdir — so one late entry defeats the ~2.75s window and
 * teardown dies with `ENOTEMPTY ... rmdir '<fixture>/.git'`.
 *
 * Pinned here:
 *   1. the writer identity: a plain commit's trace2 stream has the
 *      `child_start` for `maintenance run --auto`; a fixture that opted out
 *      via disableAutoMaintenance() spawns no child at all; initFixtureRepo()
 *      leaves `maintenance.auto=false` on worktree and bare fixtures, so
 *      deleting that opt-out fails a test instead of leaning on the backstop;
 *   2. the failure shape: while a writer recreates the maintenance lock,
 *      removeFixtureTree() settles the tree instead of exhausting rmdir
 *      retries;
 *   3. the stress guarantee: parallel worktree-style workloads under CPU load
 *      tear down cleanly and every trace is free of maintenance children.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { disableAutoMaintenance, initFixtureRepo, removeFixtureTree } from "./test-tmp.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");
const testTmpModule = resolve(here, "./test-tmp.js");

// bug-tmp-fixture-leak: every temp dir this file creates goes through the
// shared settling helper.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});
function tmp(prefix: string): string {
  const dir = _mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
  return r.stdout;
}

/** Temp repo with user config and one pending file — no commits yet. */
function initFixture(prefix: string): string {
  const dir = tmp(prefix);
  git(dir, ["-c", "init.defaultBranch=main", "init", "--quiet"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  writeFileSync(join(dir, "a.txt"), "one\n");
  return dir;
}

function runChild(cmd: string, args: string[]): Promise<string> {
  return new Promise((done, fail) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d: Buffer) => (out += d));
    child.stderr.on("data", (d: Buffer) => (out += d));
    child.on("close", (code) =>
      code === 0 ? done(out) : fail(new Error(`child exited ${code}: ${out}`)),
    );
  });
}

/** Resolve when `child` exits; SIGKILL it after a bounded grace period. */
function settleChild(child: ChildProcess, graceMs = 10_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((done) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), graceMs);
    timer.unref();
    child.once("exit", () => {
      clearTimeout(timer);
      done();
    });
  });
}

async function waitFor(predicate: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("fixture teardown vs git's detached auto-maintenance child", () => {
  it("a plain commit spawns the writer; an opted-out fixture spawns no child", () => {
    const plain = initFixture("arggon-maint-plain-");
    const quiet = initFixture("arggon-maint-quiet-");
    disableAutoMaintenance(quiet);

    const traceDir = tmp("arggon-maint-traces-");

    // Control: the trace2 stream of a plain `git commit` names the writer.
    const plainTrace = join(traceDir, "plain.jsonl");
    git(plain, ["add", "-A"]);
    git(plain, ["commit", "--quiet", "-m", "plain"], { GIT_TRACE2_EVENT: plainTrace });
    const plainEvents = readFileSync(plainTrace, "utf8");
    expect(plainEvents).toContain('"child_start"');
    expect(plainEvents).toMatch(/"argv":\[[^\]]*"maintenance","run","--auto"/);

    // Mitigation: with maintenance.auto=false the commit is self-contained.
    const quietTrace = join(traceDir, "quiet.jsonl");
    git(quiet, ["add", "-A"]);
    git(quiet, ["commit", "--quiet", "-m", "quiet"], { GIT_TRACE2_EVENT: quietTrace });
    const quietEvents = readFileSync(quietTrace, "utf8");
    expect(quietEvents).toContain('"event":"start"'); // trace2 really captured this run
    expect(quietEvents).not.toContain("maintenance");
    expect(quietEvents).not.toContain('"child_start"');
  });

  it("initFixtureRepo pins maintenance.auto=false on regular and bare fixtures", () => {
    const repo = tmp("arggon-init-fixture-");
    initFixtureRepo(repo);
    expect(git(repo, ["config", "--get", "maintenance.auto"]).trim()).toBe("false");
    expect(git(repo, ["rev-parse", "--is-bare-repository"]).trim()).toBe("false");

    const remote = tmp("arggon-init-fixture-bare-");
    initFixtureRepo(remote, { bare: true });
    expect(git(remote, ["config", "--get", "maintenance.auto"]).trim()).toBe("false");
    expect(git(remote, ["rev-parse", "--is-bare-repository"]).trim()).toBe("true");
  });

  /**
   * Stand-in for the daemon under CI load: it materializes the maintenance
   * lock in a tight loop for a bounded time, then stops and leaves the lock
   * behind (exactly the state a bare-rmdir retry loop can never clear).
   */
  const LATE_WRITER = `
const { mkdirSync, writeFileSync } = require("node:fs");
const [root, ready] = process.argv.slice(1);
const lock = root + "/.git/objects/maintenance.lock";
writeFileSync(ready, "1");
const until = Date.now() + 800;
while (Date.now() < until) {
  try {
    mkdirSync(root + "/.git/objects", { recursive: true });
    writeFileSync(lock, "");
  } catch {}
}
`;

  it("settles a live writer that keeps recreating .git/objects/maintenance.lock", async () => {
    const dir = tmp("arggon-late-writer-");
    // Seed the shape the CI failure died on: an otherwise-empty fixture whose
    // .git carries the daemon's lock.
    mkdirSync(join(dir, ".git", "objects"), { recursive: true });
    writeFileSync(join(dir, ".git", "objects", "maintenance.lock"), "");
    writeFileSync(join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");

    const ready = join(tmp("arggon-late-writer-flags-"), "ready");
    const writer = spawn(process.execPath, ["-e", LATE_WRITER, dir, ready], { stdio: "ignore" });
    await waitFor(() => existsSync(ready), 5_000, "the late writer to start");

    // The writer is live while teardown runs: the daemon kept materializing
    // its lock, which is what turned every bare-rmdir retry into ENOTEMPTY.
    // The settling helper must re-read the tree instead of retrying rmdir.
    expect(() => removeFixtureTree(dir)).not.toThrow();

    await settleChild(writer);
    // If the writer slipped a re-creation in after an early removal, one more
    // settle clears it — the point is that teardown never throws.
    if (existsSync(dir)) removeFixtureTree(dir);
    expect(existsSync(dir)).toBe(false);
  }, 30_000);

  /**
   * Real worktree-style workload, run in a child process: init fixture, opt
   * out of maintenance, commit / branch / merge / worktree add+remove, then
   * teardown. Each loop's git commands are traced, so a regression that
   * reintroduces the detached child fails even if this particular teardown
   * happens to win the race.
   */
  const STRESS_RUNNER = `
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { disableAutoMaintenance, removeFixtureTree } from ${JSON.stringify(testTmpModule)};

const [work, iterationsRaw] = process.argv.slice(2);
const iterations = Number(iterationsRaw);
const git = (args, cwd) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error("git " + args.join(" ") + ": " + r.stderr);
  return r.stdout.trim();
};

for (let i = 0; i < iterations; i++) {
  const dir = mkdtempSync(join(tmpdir(), "arggon-stress-"));
  const trace = join(work, "trace-" + process.pid + "-" + i + ".jsonl");
  process.env.GIT_TRACE2_EVENT = trace;
  try {
    git(["-c", "init.defaultBranch=main", "init", "--quiet"], dir);
    git(["config", "user.email", "test@example.com"], dir);
    git(["config", "user.name", "Test"], dir);
    disableAutoMaintenance(dir);
    writeFileSync(join(dir, "a.txt"), "one\\n");
    git(["add", "-A"], dir);
    git(["commit", "--quiet", "-m", "one"], dir);
    git(["checkout", "--quiet", "-b", "feat"], dir);
    writeFileSync(join(dir, "b.txt"), "two\\n");
    git(["add", "-A"], dir);
    git(["commit", "--quiet", "-m", "two"], dir);
    git(["checkout", "--quiet", "main"], dir);
    git(["merge", "--quiet", "--no-ff", "-m", "merge", "feat"], dir);
    const wt = resolve(dirname(dir), basename(dir) + "-task-stress");
    git(["worktree", "add", "--quiet", "-b", "wt", wt], dir);
    git(["worktree", "remove", "--force", wt], dir);
    removeFixtureTree(dir);
  } finally {
    delete process.env.GIT_TRACE2_EVENT;
  }
  if (existsSync(dir)) removeFixtureTree(dir);
  const traceText = readFileSync(trace, "utf8");
  if (!traceText.includes('"event":"start"')) throw new Error("trace2 captured nothing: " + trace);
  if (/"argv":\[[^\]]*"maintenance","run","--auto"/.test(traceText)) {
    throw new Error("detached maintenance child spawned despite the opt-out: " + trace);
  }
  if (existsSync(dir)) throw new Error("fixture survived teardown: " + dir);
}
console.log(JSON.stringify({ pid: process.pid, loops: iterations }));
`;

  it("parallel worktree-style loops under CPU load tear down cleanly", async () => {
    const work = tmp("arggon-stress-work-");
    const runner = join(work, "stress-runner.mjs");
    writeFileSync(runner, STRESS_RUNNER);

    const workers = Math.min(4, availableParallelism());
    const iterations = 2;
    const load = Array.from({ length: workers }, () =>
      spawn(process.execPath, ["-e", "while (true) {}"], { stdio: "ignore" }),
    );
    try {
      const runs = await Promise.all(
        Array.from({ length: workers }, () =>
          runChild(process.execPath, [tsx, runner, work, String(iterations)]),
        ),
      );
      for (const out of runs) {
        expect(JSON.parse(out.trim().split("\n").at(-1)!), out).toMatchObject({
          loops: iterations,
        });
      }
    } finally {
      for (const child of load) child.kill("SIGKILL");
    }
  }, 120_000);
});
