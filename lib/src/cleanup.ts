import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { GhExecutor } from "./import-issues.js";
import type { WorkItem } from "./items.js";

/**
 * Worktree-cleanup classification, shared by every surface (W4,
 * task-native-permissions-worktrees).
 *
 * `arggon cleanup` (CLI) and the native `cleanup` tool (plugin, over the
 * worktree domain) must agree on **which** worktrees are removable; that
 * decision is a rule, so it lives here, in the kernel, and never forks. The
 * surfaces keep their own orchestration: the CLI removes with `git worktree
 * remove` and deletes branches with `git branch -d`; the plugin removes through
 * `ctx.worktree.remove` and supplies the domain inventory through
 * {@link CleanupGit.worktreeList}.
 *
 * The classifier is pure over the injected {@link CleanupGit} predicates plus
 * one filesystem check (`existsSync`): a recorded path that is gone clears the
 * record, a path that exists but is not a worktree of this repo is never
 * touched, and a branch that is not provably integrated (ancestry, or a
 * merged PR through the optional gh fallback) is skipped with a reason.
 */

/** Statuses whose worktrees are eligible for pruning (terminal items only). */
export const CLEANUP_TERMINAL_STATUSES: ReadonlySet<string> = new Set(["done", "cancelled"]);

/** One tracked worktree (an item with a worktree_path record) and its classification. */
export type CleanupEntry = {
  id: string;
  status: string;
  branch: string | null;
  /** Absolute worktree path as recorded on the item. */
  path: string;
  /** True when --prune would remove this worktree (terminal item + merged branch). */
  removable: boolean;
  /** Why the entry is skipped (null when removable). */
  reason: string | null;
  /** What --prune does for this entry (null when skipped). */
  action: string | null;
  /**
   * Present when the branch failed the ancestry check but a squash-merged PR
   * proves it was integrated (task-cleanup-squash-merge), e.g.
   * "squash-merged PR #12".
   */
  via?: string;
};

/** Git operations for cleanup, injectable for tests. */
export type CleanupGit = {
  isRepo(cwd: string): boolean;
  /** Absolute paths of every worktree registered with this repo. */
  worktreeList(cwd: string): string[];
  /**
   * The ref worktree removals must be merged into: origin/HEAD when set,
   * else the local main/master branch. Throws when none can be detected.
   */
  defaultBranch(cwd: string): string;
  /** True when `branch` is an ancestor of `base` (fully merged). */
  isAncestor(cwd: string, branch: string, base: string): boolean;
  /** True when a remote-tracking branch `origin/<branch>` exists. */
  remoteBranchExists(cwd: string, branch: string): boolean;
  /** `git worktree remove <path>` (refuses dirty worktrees). */
  removeWorktree(cwd: string, path: string): void;
  /** Safe `git branch -d <branch>` (only succeeds for merged branches). */
  deleteBranch(cwd: string, branch: string): void;
  /**
   * `git branch -D <branch>` — used only when a squash-merged PR (not git
   * ancestry) proved the branch integrated, so `-d` would refuse it.
   */
  deleteBranchForce(cwd: string, branch: string): void;
  branchExists(cwd: string, name: string): boolean;
};

/** Default gh executor bound for use as a default value (get-open-prs pattern). */
const defaultExecGh: GhExecutor = (file, args, options) =>
  execFileSync(file, args, options) as string;

export type ClassifyCleanupDeps = {
  /** Ancestry-only classification (skip the gh squash-merge fallback). */
  noGh?: boolean;
  /** gh executor for the squash-merge fallback; defaults to the real gh CLI. */
  gh?: GhExecutor;
};

function git(args: string[], cwd: string): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const stderr =
      err !== null && typeof err === "object" && "stderr" in err ? String(err.stderr).trim() : "";
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`git ${args.join(" ")} failed${stderr ? `: ${stderr}` : ` (${message})`}`);
  }
}

export function defaultCleanupGit(): CleanupGit {
  return {
    isRepo(cwd: string): boolean {
      try {
        execFileSync("git", ["rev-parse", "--git-dir"], {
          encoding: "utf8",
          cwd,
          stdio: ["ignore", "pipe", "ignore"],
        });
        return true;
      } catch {
        return false;
      }
    },
    worktreeList(cwd: string): string[] {
      const out = git(["worktree", "list", "--porcelain"], cwd);
      return out
        .split("\n")
        .filter((line) => line.startsWith("worktree "))
        .map((line) => line.slice("worktree ".length).trim())
        .filter((path) => path.length > 0);
    },
    defaultBranch(cwd: string): string {
      try {
        const ref = git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], cwd);
        if (ref) return ref;
      } catch {
        // fall through to local main/master
      }
      for (const name of ["main", "master"]) {
        try {
          git(["show-ref", "--verify", "--quiet", `refs/heads/${name}`], cwd);
          return name;
        } catch {
          // try the next candidate
        }
      }
      throw new Error(
        "could not detect the default branch (no origin/HEAD, main, or master); " +
          "run `git remote set-head origin -a` or create the base branch first",
      );
    },
    isAncestor(cwd: string, branch: string, base: string): boolean {
      try {
        git(["merge-base", "--is-ancestor", branch, base], cwd);
        return true;
      } catch {
        return false;
      }
    },
    remoteBranchExists(cwd: string, branch: string): boolean {
      try {
        git(["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`], cwd);
        return true;
      } catch {
        return false;
      }
    },
    removeWorktree(cwd: string, path: string): void {
      git(["worktree", "remove", path], cwd);
    },
    deleteBranch(cwd: string, branch: string): void {
      git(["branch", "-d", branch], cwd);
    },
    deleteBranchForce(cwd: string, branch: string): void {
      git(["branch", "-D", branch], cwd);
    },
    branchExists(cwd: string, name: string): boolean {
      try {
        git(["show-ref", "--verify", "--quiet", `refs/heads/${name}`], cwd);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** One squash-merged PR found for a branch via gh (task-cleanup-squash-merge). */
export type MergedPr = { number: number; url: string; mergedAt: string | null };

/**
 * Look for a MERGED PR whose head branch is `branch` (squash merges never
 * pass git's ancestry check — the squash commit is not on the feature branch).
 * Returns the newest match, or null when none exists. Throws a technical
 * error when gh is unavailable (missing binary, unauthenticated, failed);
 * callers treat that as a skip, never a crash.
 */
export function findMergedPr(
  branch: string,
  cwd: string,
  execGh: GhExecutor = defaultExecGh,
): MergedPr | null {
  let out: string;
  try {
    const runOpts: ExecFileSyncOptions = {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 30_000,
      cwd,
    };
    out = execGh(
      "gh",
      [
        "pr",
        "list",
        "--state",
        "merged",
        "--head",
        branch,
        "--json",
        "number,url,mergedAt",
        "--limit",
        "5",
      ],
      runOpts,
    );
  } catch (err) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err.code === "ENOENT" || err.code === -2)
    ) {
      throw new Error("gh not found (install gh and run `gh auth login`)");
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`gh pr list failed (${message}; check \`gh auth status\`)`);
  }
  try {
    const data: unknown = JSON.parse(out);
    if (!Array.isArray(data)) throw new Error("not an array");
    for (const pr of data as Array<{ number?: unknown; url?: unknown; mergedAt?: unknown }>) {
      if (typeof pr.number === "number") {
        return {
          number: pr.number,
          url: typeof pr.url === "string" ? pr.url : "",
          mergedAt: typeof pr.mergedAt === "string" ? pr.mergedAt : null,
        };
      }
    }
    return null;
  } catch {
    throw new Error("gh pr list returned unparseable JSON (check `gh auth status`)");
  }
}

/**
 * Classify one item with a `worktree_path` record against the base ref. The
 * order is the contract: terminal status → recorded branch → integration
 * (ancestry, or a merged PR unless `noGh`) → remote-tip safety → filesystem
 * state. Every skip carries a `reason`; every removable entry carries the
 * `action` the surface performs.
 */
export function classifyCleanupEntry(
  item: WorkItem,
  root: string,
  base: string,
  gitRunner: CleanupGit,
  deps: ClassifyCleanupDeps = {},
): CleanupEntry {
  const path = item.worktreePath ? resolve(item.worktreePath) : "";
  const entry: CleanupEntry = {
    id: item.id,
    status: item.status,
    branch: item.branch ?? null,
    path,
    removable: false,
    reason: null,
    action: null,
  };
  if (!CLEANUP_TERMINAL_STATUSES.has(item.status)) {
    entry.reason = `item is ${item.status} (only done/cancelled items are pruned)`;
    return entry;
  }
  if (!item.branch) {
    entry.reason = "no branch recorded (cannot verify it is merged)";
    return entry;
  }
  if (!gitRunner.isAncestor(root, item.branch, base)) {
    if (deps.noGh) {
      entry.reason = `branch '${item.branch}' is not fully merged into '${base}'`;
      return entry;
    }
    // Squash-merge fallback (task-cleanup-squash-merge): a squash commit is
    // never an ancestor of the feature branch, so ancestry alone cannot prove
    // integration. A MERGED PR for the branch is that proof.
    try {
      const pr = findMergedPr(item.branch, root, deps.gh);
      if (!pr) {
        entry.reason = "branch not merged and no merged PR found";
        return entry;
      }
      entry.via = `squash-merged PR #${pr.number}`;
    } catch {
      // The gh lookup must never break the run: an unavailable gh (missing
      // binary, unauthenticated, failed) is a skip with a reason.
      entry.reason = "ancestry check failed and gh is unavailable to check for squash-merged PRs";
      return entry;
    }
  }
  // Remote safety (bug-cleanup-partial-failure): a lost final push leaves
  // origin/<branch> behind local. Deleting the local branch would strand the
  // remote tip, so require the remote tip merged too before touching anything.
  // Skipped on the squash-merge path: the merged PR already proves the remote
  // branch tip was integrated.
  if (
    entry.via === undefined &&
    gitRunner.remoteBranchExists(root, item.branch) &&
    !gitRunner.isAncestor(root, `origin/${item.branch}`, base)
  ) {
    entry.reason =
      `remote branch divergent or behind (origin/${item.branch}) — ` +
      `push or delete the remote branch first`;
    return entry;
  }
  if (!existsSync(path)) {
    entry.action = "clear stale worktree_path record (path missing on disk)";
  } else if (
    !gitRunner
      .worktreeList(root)
      .map((p) => resolve(p))
      .includes(path)
  ) {
    entry.reason = "path exists but is not a git worktree of this repo (remove it manually)";
    return entry;
  } else {
    entry.action = "remove worktree and delete the merged branch";
  }
  entry.removable = true;
  return entry;
}
