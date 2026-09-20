/**
 * Unit tests for the item file lock (bug-claim-race-no-lock): exclusive
 * acquire, release on exception, re-entrancy within a process, and stale-lock
 * breaking (a crashed holder must not wedge the tracker) with an injected
 * clock.
 */
import { existsSync, mkdirSync, mkdtempSync as _mkdtempSync, rmSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LOCK_STALE_MS, LOCK_TIMEOUT_MS, lockFilePathFor, withItemLock } from "./lock.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const dirs: string[] = [];

afterEach(() => {
  // Only assert the lock file is gone; the tmpdir itself is fine to leak.
  for (const dir of dirs.splice(0)) {
    expect(existsSync(dir)).toBe(true);
  }
});

function tempItemPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-lock-test-"));
  dirs.push(dir);
  return join(dir, "task-alpha.md");
}

describe("withItemLock", () => {
  it("creates and releases a lock file named after the item path", () => {
    const item = tempItemPath();
    const lockPath = lockFilePathFor(item);
    expect(lockPath).toContain("arggon-lock-");
    expect(lockPath.endsWith(".lock")).toBe(true);

    let ran = false;
    withItemLock(item, () => {
      ran = true;
      expect(existsSync(lockPath)).toBe(true);
    });
    expect(ran).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("excludes a second acquirer while held (exclusive create)", () => {
    const item = tempItemPath();
    const lockPath = lockFilePathFor(item);
    const seen: string[] = [];
    // Foreign holder (another pid): contended → timeout error. (Same-process
    // nesting is re-entrant by design and covered below.)
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid + 1, acquiredAt: new Date().toISOString() }),
      "utf8",
    );
    expect(() =>
      withItemLock(item, () => seen.push("inside"), { timeoutMs: 150 }),
    ).toThrowError(/failed to acquire lock for .+\(another arggon process may hold it\)/);
    expect(seen).toEqual([]);
    // The stale timeout is far away, so the fresh foreign lock was respected,
    // and the contender did not delete it while waiting.
    expect(existsSync(lockPath)).toBe(true);
    // Once the lock is gone (holder released), acquiring works.
    unlinkSync(lockPath);
    withItemLock(item, () => seen.push("after"));
    expect(seen).toEqual(["after"]);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("releases the lock when fn throws", () => {
    const item = tempItemPath();
    expect(() =>
      withItemLock(item, () => {
        throw new Error("boom");
      }),
    ).toThrowError("boom");
    expect(existsSync(lockFilePathFor(item))).toBe(false);
    withItemLock(item, () => true); // re-acquirable
  });

  it("is re-entrant within the same process (nested withItemLock)", () => {
    const item = tempItemPath();
    const order: string[] = [];
    withItemLock(item, () => {
      withItemLock(item, () => order.push("inner"), { timeoutMs: 500 });
      order.push("outer");
    }, { timeoutMs: 500 });
    expect(order).toEqual(["inner", "outer"]);
  });

  it("breaks a stale lock (crashed holder) using the recorded acquiredAt", () => {
    const item = tempItemPath();
    const lockPath = lockFilePathFor(item);
    let clock = 1_000_000;
    // Advances 100ms per read: a frozen now() would spin the retry loop
    // forever, while a real clock always moves forward.
    const now = (): number => (clock += 100);

    // A holder crashed: the lock file exists with an old acquiredAt.
    // The clock advances 100ms per read (a frozen now() would spin the retry
    // loop forever — a real clock always advances).
    mkdirSync(join(lockPath, ".."), { recursive: true });
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: 999999, acquiredAt: new Date(clock).toISOString() }),
      "utf8",
    );

    // Before LOCK_STALE_MS: contended → timeout error.
    clock += (LOCK_STALE_MS - 5_000) / 100;
    expect(() => withItemLock(item, () => true, { timeoutMs: 100, now })).toThrowError(
      /failed to acquire lock/,
    );

    // Past LOCK_STALE_MS: the lock is broken and acquisition succeeds.
    clock += LOCK_STALE_MS;
    let ran = false;
    withItemLock(
      item,
      () => {
        ran = true;
      },
      { timeoutMs: LOCK_TIMEOUT_MS, now },
    );
    expect(ran).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("breaks a stale corrupt lock file via mtime fallback", () => {
    const item = tempItemPath();
    const lockPath = lockFilePathFor(item);
    writeFileSync(lockPath, "not json at all", "utf8");
    // Corrupt payload → acquiredAt unreadable → staleness falls back to the
    // file mtime; age it past LOCK_STALE_MS with the real clock.
    const past = new Date(Date.now() - 2 * LOCK_STALE_MS);
    utimesSync(lockPath, past, past);
    let ran = false;
    withItemLock(item, () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});
