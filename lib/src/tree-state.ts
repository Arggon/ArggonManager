import { execFileSync, type ExecFileSyncOptions } from "node:child_process";

/**
 * The checkout a read ranked from (bug-claim-pool-computed-from-main-misses-
 * branch-claims). A claim made through `start` is committed on the item's
 * BRANCH, so until that branch merges the primary checkout's copy of the item
 * still reads `todo`/unassigned — and a pool computed from the primary cannot
 * see the claim. Every ranking surface therefore declares the tree it read,
 * instead of silently ranking from `main` alone.
 */
export type RankedFrom = {
  /**
   * Checked-out branch name; `"HEAD"` when detached. Null when git or the
   * repository is unavailable (a non-git tracker tree).
   */
  branch: string | null;
  /** Short HEAD sha; null under the same condition as `branch`. */
  head: string | null;
  /**
   * Bounded caveat carried beside the declaration: what this tree cannot see.
   * The claim commit rides the item branch, so a claim on an unmerged branch
   * is invisible here until it merges; `arggon sync` reads the branch copies.
   */
  note: string;
};

/** The constant caveat every `rankedFrom` carries (one string, one meaning). */
export const RANKED_FROM_NOTE =
  "claims made on unmerged branches are not visible from this tree; run `arggon sync` to surface branch-resident claims";

/** Signature for git executors (tests inject a fake; production uses the real binary). */
export type TreeGitExecutor = (
  file: string,
  args: string[],
  options?: ExecFileSyncOptions,
) => string;

const defaultExecGit: TreeGitExecutor = (file, args, options) =>
  execFileSync(file, args, options) as string;

/** One `git` read that degrades to null instead of throwing (no git, no repo). */
function gitText(execGit: TreeGitExecutor, root: string, args: string[]): string | null {
  try {
    const out = execGit("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Read the checkout the tracker tree at `root` belongs to: branch + short HEAD,
 * both null when git/the repository is unavailable — never guessed. Pure read
 * (two `git rev-parse` calls); never throws.
 */
export function readRankedFrom(
  root: string,
  execGit: TreeGitExecutor = defaultExecGit,
): RankedFrom {
  return {
    branch: gitText(execGit, root, ["rev-parse", "--abbrev-ref", "HEAD"]),
    head: gitText(execGit, root, ["rev-parse", "--short", "HEAD"]),
    note: RANKED_FROM_NOTE,
  };
}

/**
 * One-line human rendering of a `rankedFrom` block (CLI stdout; the JSON
 * envelope carries the structured block). Repo-controlled values are the
 * caller's to sanitize.
 */
export function formatRankedFrom(rankedFrom: RankedFrom): string {
  const where = rankedFrom.branch
    ? rankedFrom.head
      ? `${rankedFrom.branch}@${rankedFrom.head}`
      : rankedFrom.branch
    : "this tree (no git checkout detected)";
  return `ranked from ${where} — ${rankedFrom.note}`;
}
