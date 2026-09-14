/**
 * task-vitest-global-teardown: safety-net purge of stale `arggon-*` fixture
 * dirs in os.tmpdir(), registered via vitest `globalSetup` returning a
 * teardown function (vitest has no separate globalTeardown hook).
 *
 * Why a globalTeardown in addition to the per-file cleanup shims (PR #198)?
 * The shims do precise, per-file cleanup while tests run; this teardown is a
 * coarse safety net that reclaims anything left behind by branches that miss
 * the per-file pattern (or crashed runs). They are complementary:
 * shims = precise cleanup, teardown = eventual consistency for /tmp.
 *
 * Concurrency guard (concurrent-run safety):
 *   - SUITE_START_MS is captured at module load, i.e. when this vitest worker
 *     process starts the suite. Teardowns run in-process after the suite, so
 *     any fixture dir created by a concurrently running suite has an mtime
 *     after SUITE_START_MS and is never touched.
 *   - AGE_GATE_MS (env `ARGGON_TEARDOWN_MAX_AGE_MS`, default 2h) requires a
 *     dir to be older than the threshold on top of the suite-start gate, so a
 *     long-lived parallel run (started before ours) still has its fixtures
 *     protected by the age margin. 2h comfortably exceeds any suite duration;
 *     lower it via env for local experimentation.
 *
 * Scope: /tmp only (os.tmpdir()). The `ArggonManager-*-task-*` worktree
 * siblings created by worktree.test.ts live next to real checkouts under the
 * projects parent (not /tmp) — deleting on mtime there risks touching live
 * worktrees, so they are intentionally out of scope here.
 */
import { readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SUITE_START_MS = Date.now();

export function purgeStaleArggonTmpDirs(nowMs: number = Date.now()): string[] {
  const ageGateMs = Number(process.env.ARGGON_TEARDOWN_MAX_AGE_MS) || 2 * 60 * 60 * 1000;
  const cutoffMs = Math.min(SUITE_START_MS, nowMs - ageGateMs);
  const removed: string[] = [];
  let dir: string;
  try {
    dir = tmpdir();
  } catch {
    return removed;
  }
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return removed;
  }
  for (const entry of entries) {
    if (!entry.startsWith("arggon-")) continue;
    const full = join(dir, entry);
    try {
      // Do not follow symlinks: a symlink named arggon-* pointing elsewhere
      // must never cause us to delete its target.
      const st = statSync(full, { throwIfNoEntry: false });
      if (!st || !st.isDirectory()) continue;
      if (st.mtimeMs >= cutoffMs) continue;
    } catch {
      continue;
    }
    try {
      rmSync(full, { recursive: true, force: true });
      removed.push(full);
    } catch {
      // best effort: another process may have removed it first
    }
  }
  return removed;
}

export default function globalSetup(): () => void {
  return function teardown(): void {
    const removed = purgeStaleArggonTmpDirs();
    if (removed.length > 0) {
      console.log(`[teardown-tmp] purged ${removed.length} stale arggon-* dir(s) from ${tmpdir()}`);
    }
  };
}
