/**
 * File lock for claim check-and-set atomicity (bug-claim-race-no-lock).
 *
 * The claim is a read-modify-write of the item file. Without a lock, two
 * concurrent `arggon start` (or `update --status`) processes can both read the
 * unclaimed state and both write — last-write-wins silently replaces a claim,
 * and same-assignee re-runs interleave writes into one shared worktree.
 *
 * Semantics (story-start-worktree / bug-claim-race-no-lock):
 * - Concurrent same-assignee starts: serialized by the lock; the first wins
 *   (created:true), the second sees the claimed state and attaches
 *   (created:false) — deterministic, never interleaved simultaneous writes
 *   into one worktree.
 * - Concurrent different-assignee starts: the first wins, the second reads
 *   the claimed state and fails with the claim-conflict START_FAILED — never
 *   last-write-wins.
 *
 * Implementation: exclusive-create lock files (`fs.openSync(path, "wx")`) in
 * `os.tmpdir()`, named `arggon-lock-<sha1(abs item path)>.lock`. Exclusive
 * create is atomic on POSIX and Windows, so no flock syscalls are needed —
 * this is cross-platform by construction. Locks live in tmpdir, NOT in
 * tasks/: untracked lock files would trip `start`'s clean-tree gate and
 * pollute the tree. A crashed holder must not wedge the tracker forever, so
 * a lock older than LOCK_STALE_MS is broken (deleted and retried).
 */
import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

/** How long a contender waits before giving up (actionable error). */
export const LOCK_TIMEOUT_MS = 10_000;
/** Locks older than this are stale (crashed holder) and get broken. */
export const LOCK_STALE_MS = 60_000;
/** Sleep between acquire attempts. */
const RETRY_MS = 75;

export type LockInfo = {
  pid: number;
  acquiredAt: string;
};

/** Stable lock-file path for one item file (tmpdir, content-addressed by abs path). */
export function lockFilePathFor(itemFilePath: string): string {
  const abs = resolve(itemFilePath);
  const hash = createHash("sha1").update(abs).digest("hex");
  return join(tmpdir(), `arggon-lock-${hash}.lock`);
}

function readLockInfo(lockPath: string): LockInfo | null {
  try {
    const parsed = JSON.parse(readFileSync(lockPath, "utf8")) as Partial<LockInfo>;
    if (typeof parsed.pid === "number" && typeof parsed.acquiredAt === "string") {
      return { pid: parsed.pid, acquiredAt: parsed.acquiredAt };
    }
  } catch {
    // Corrupt or vanished lock: fall back to the file mtime for staleness.
  }
  return null;
}

/** Synchronous sleep (the CLI is single-threaded around the lock). */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export type LockOptions = {
  /** Give up (throw) after this long contending. Default 10s. */
  timeoutMs?: number;
  /** Injectable clock (ms epoch) for stale-break tests. */
  now?: () => number;
};

/**
 * Run `fn()` while holding the exclusive lock for `itemFilePath`. Deletes the
 * lock in a finally block, so `fn` throwing releases it. Re-entrant within a
 * process (start holds the item lock across the whole flow; nested update
 * calls must not deadlock): a lock file whose pid matches this process is
 * treated as already held.
 */
export function withItemLock<T>(itemFilePath: string, fn: () => T, opts: LockOptions = {}): T {
  const timeoutMs = opts.timeoutMs ?? LOCK_TIMEOUT_MS;
  const now = opts.now ?? (() => Date.now());
  const lockPath = lockFilePathFor(itemFilePath);

  // Re-entrant fast path: we already hold this lock in this process.
  const held = readLockInfo(lockPath);
  if (held && held.pid === process.pid) return fn();

  const deadline = now() + timeoutMs;
  for (;;) {
    let fd: number | undefined;
    try {
      fd = openSync(lockPath, "wx");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
    if (fd !== undefined) {
      try {
        writeFileSync(
          fd,
          JSON.stringify({ pid: process.pid, acquiredAt: new Date(now()).toISOString() } satisfies LockInfo),
        );
        return fn();
      } finally {
        try {
          unlinkSync(lockPath);
        } catch {
          // Already gone (stale-broken by another waiter): nothing to do.
        }
        try {
          closeSync(fd);
        } catch {
          // fd already closed is fine on the release path.
        }
      }
    }
    // Contended. Break a stale lock so a crashed process cannot wedge the
    // tracker; for a corrupt/unreadable lock file fall back to its mtime.
    // The lock can also vanish entirely between our failed create and this
    // check (the holder released it) — retry the create instead of letting
    // statSync's ENOENT escape (bug-spawn-sync-test-timeout-flake: transient
    // ENOENT in concurrent sibling done-flips).
    let acquiredMs: number;
    try {
      const info = readLockInfo(lockPath);
      acquiredMs = info ? Date.parse(info.acquiredAt) : statSync(lockPath).mtimeMs;
    } catch {
      // Lock gone (released or stale-broken by another waiter): loop and
      // retry the create.
      continue;
    }
    const age = now() - acquiredMs;
    if (Number.isNaN(age) || age > LOCK_STALE_MS) {
      try {
        unlinkSync(lockPath);
      } catch {
        // Another waiter broke it first: loop and retry the create.
      }
      continue;
    }
    if (now() >= deadline) {
      throw new Error(
        `failed to acquire lock for ${basename(itemFilePath)} after ${Math.round(timeoutMs / 1000)}s ` +
          `(another arggon process may hold it)`,
      );
    }
    sleepSync(RETRY_MS);
  }
}
