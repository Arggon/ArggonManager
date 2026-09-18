/**
 * Shared temp-fixture teardown for tests that spawn real child processes
 * (bug-tracker-commit-enotempty-flake, task-concurrency-test-teardown-sweep,
 * bug-ci-enotempty-rmretry).
 *
 * Root cause of the recurring `ENOTEMPTY ... rmdir '<fixture>/.git'` teardown
 * failure (CI run 35401030576, worktree.test.ts):
 *
 *   `git commit` and `git merge` spawn a detached `git maintenance run --auto
 *   --detach` child. Before daemonizing, that process takes the repo lock
 *   `.git/objects/maintenance.lock` and it only rolls it back after the
 *   background tasks finish (builtin/gc.c: maintenance_run_tasks()), so the
 *   lock is held for the daemon's entire lifetime — on a loaded CI runner the
 *   daemon can be starved for seconds, far longer than the retry window below.
 *
 *   Node's recursive `rmSync` removes a directory's children ONCE and then
 *   retries only the bare `rmdir` for maxRetries x retryDelay (~2.75s with
 *   RM_RETRY): it never re-reads the children. An entry that shows up after
 *   that one children pass — the daemon's held/recreated lock — is therefore
 *   invisible to every remaining attempt, and the error surfaces as
 *   ENOTEMPTY on `.git` (or `.git/objects`).
 *
 * Two layers keep teardown deterministic without weakening any assertion:
 *   1. Fixture repos opt out of auto-maintenance ({@link disableAutoMaintenance},
 *      routed through {@link initFixtureRepo}, which reads the config back).
 *      With `maintenance.auto=false`, commit/merge and receive-pack spawn no
 *      detached child at all, so the writer is never created (pinned by trace2
 *      in test-tmp.test.ts).
 *   2. {@link removeFixtureTree} re-runs the recursive removal (fresh readdir)
 *      on retriable errors until a deadline, so a late writer from any other
 *      source is settled instead of being retried with bare rmdirs.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/** Recursive `rmSync` options with a bounded ENOTEMPTY retry window. */
export const RM_RETRY = { recursive: true, force: true, maxRetries: 10, retryDelay: 50 } as const;

/**
 * Per-attempt options for {@link removeFixtureTree}: a deliberately short
 * inner window, because the outer loop re-reads the whole tree instead of
 * retrying the bare rmdir that lost the race.
 */
const RM_ATTEMPT = { recursive: true, force: true, maxRetries: 3, retryDelay: 25 } as const;

/** How long {@link removeFixtureTree} keeps re-traversing on retriable errors. */
const REMOVE_DEADLINE_MS = 15_000;

/** `rmSync` error codes worth a fresh traversal (Node's retriable set). */
const RETRIABLE_RM_CODES = new Set(["EBUSY", "EMFILE", "ENFILE", "ENOTEMPTY", "EPERM"]);
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));

/** Synchronous sleep: `afterEach` teardown is sync, so no await point exists. */
function sleepSync(ms: number): void {
  Atomics.wait(sleepBuffer, 0, 0, ms);
}

/**
 * Opt a fixture repo out of git's automatic background maintenance. Call right
 * after `git init`, before the first commit: the fixture's local config gets
 * `maintenance.auto=false`, so `git commit`, `git merge` and friends never
 * spawn the detached daemon described above. Tests never assert maintenance
 * behavior, so this only removes teardown noise — and it is the deterministic
 * half of the fix (test-tmp.test.ts pins the trace2 child_start with and
 * without it).
 */
export function disableAutoMaintenance(dir: string): void {
  execFileSync("git", ["config", "maintenance.auto", "false"], { cwd: dir, stdio: "ignore" });
}

/**
 * Create a git fixture repository the way every git-backed suite expects:
 * `init.defaultBranch=main` (bare with `{ bare: true }`), fixture user config,
 * and the {@link disableAutoMaintenance} opt-out. The opt-out is read back, so
 * deleting it fails fixture setup here instead of silently leaning on
 * {@link removeFixtureTree}'s settling backstop. Route fixture repos through
 * this helper instead of raw `git init` + config.
 */
export function initFixtureRepo(dir: string, opts: { bare?: boolean } = {}): void {
  const initArgs = ["-c", "init.defaultBranch=main", "init", "--quiet"];
  if (opts.bare) initArgs.push("--bare");
  execFileSync("git", initArgs, { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir, stdio: "ignore" });
  disableAutoMaintenance(dir);
  const auto = execFileSync("git", ["config", "--get", "--default", "unset", "maintenance.auto"], {
    cwd: dir,
    encoding: "utf8",
  }).trim();
  if (auto !== "false") {
    throw new Error(
      `${dir}: maintenance.auto=${auto}, expected false (see disableAutoMaintenance)`,
    );
  }
}

/** Recursive removal that re-reads the tree after a retriable failure. */
function removeWithSettle(dir: string): void {
  const deadline = Date.now() + REMOVE_DEADLINE_MS;
  for (;;) {
    try {
      rmSync(dir, RM_ATTEMPT);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === undefined || !RETRIABLE_RM_CODES.has(code) || Date.now() >= deadline) throw err;
      sleepSync(25);
    }
  }
}

/**
 * Remove a fixture directory with {@link RM_ATTEMPT} plus the outer settling
 * loop above, plus any `arggon start --worktree` sibling worktrees named
 * `<basename>-task*` created beside it (they are separate directories and
 * would otherwise survive the fixture root). Safe to call on an
 * already-removed path.
 */
export function removeFixtureTree(dir: string): void {
  removeWithSettle(dir);
  try {
    const base = basename(dir);
    for (const entry of readdirSync(dirname(dir))) {
      if (entry.startsWith(`${base}-task`)) removeWithSettle(join(dirname(dir), entry));
    }
  } catch {
    // parent already gone
  }
}
