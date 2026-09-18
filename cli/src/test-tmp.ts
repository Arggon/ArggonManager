/**
 * Shared temp-fixture teardown for tests that spawn real child processes
 * (bug-tracker-commit-enotempty-flake, task-concurrency-test-teardown-sweep).
 *
 * Recursive `rmSync` does readdir -> unlink -> rmdir; when a still-settling
 * writer (a spawned CLI/git child, a detached `git maintenance run --auto
 * --detach`, or just fs timing on a loaded runner) adds or leaves an entry in
 * that window, the `rmdir` fails ENOTEMPTY and `force` does NOT suppress it
 * (force only swallows ENOENT). Node only retries ENOTEMPTY while
 * `maxRetries > 0`, so the default 0 makes teardown a one-shot race. The
 * bounded retry window below re-reads and re-tries the tree across that
 * window, keeping fixture removal deterministic without weakening anything a
 * test asserts. One constant, one helper: the whole concurrency family tears
 * down the same way.
 */
import { readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/** Recursive `rmSync` options with a bounded ENOTEMPTY retry window. */
export const RM_RETRY = { recursive: true, force: true, maxRetries: 10, retryDelay: 50 } as const;

/**
 * Remove a fixture directory with {@link RM_RETRY}, plus any `arggon start
 * --worktree` sibling worktrees named `<basename>-task*` created beside it
 * (they are separate directories and would otherwise survive the fixture
 * root). Safe to call on an already-removed path.
 */
export function removeFixtureTree(dir: string): void {
  rmSync(dir, RM_RETRY);
  try {
    const base = basename(dir);
    for (const entry of readdirSync(dirname(dir))) {
      if (entry.startsWith(`${base}-task`)) rmSync(join(dirname(dir), entry), RM_RETRY);
    }
  } catch {
    // parent already gone
  }
}
