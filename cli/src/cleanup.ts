import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { runUpdate } from "./update.js";

const TERMINAL: ReadonlySet<string> = new Set(["done", "cancelled"]);

export type CleanupOptions = {
  cwd: string;
  /**
   * Default (false) only lists removable worktrees. With true, removable
   * worktrees are removed (git worktree remove), their merged branches are
   * deleted (git branch -d), and the item's worktree_path record is cleared.
   * Never touches items that are not terminal or branches that are unmerged.
   */
  prune?: boolean;
};

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
};

/** One completed prune action. */
export type CleanupAction = {
  id: string;
  action: string;
};

export type CleanupResult = {
  /** Repo root (parent of tasks/; the git cwd). */
  root: string;
  /** Branch merge safety is checked against this ref (e.g. origin/main). */
  base: string;
  /** Every tracked worktree with its classification. */
  entries: CleanupEntry[];
  /** Actions performed (only with prune: true). */
  pruned: CleanupAction[];
  /** Per-item failures during prune (removal/branch-delete errors). */
  failures: string[];
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
  /** `git worktree remove <path>` (refuses dirty worktrees). */
  removeWorktree(cwd: string, path: string): void;
  /** Safe `git branch -d <branch>` (only succeeds for merged branches). */
  deleteBranch(cwd: string, branch: string): void;
  branchExists(cwd: string, name: string): boolean;
};

export type CleanupDeps = {
  git?: CleanupGit;
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
    removeWorktree(cwd: string, path: string): void {
      git(["worktree", "remove", path], cwd);
    },
    deleteBranch(cwd: string, branch: string): void {
      git(["branch", "-d", branch], cwd);
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

function classify(item: WorkItem, root: string, base: string, gitRunner: CleanupGit): CleanupEntry {
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
  if (!TERMINAL.has(item.status)) {
    entry.reason = `item is ${item.status} (only done/cancelled items are pruned)`;
    return entry;
  }
  if (!item.branch) {
    entry.reason = "no branch recorded (cannot verify it is merged)";
    return entry;
  }
  if (!gitRunner.isAncestor(root, item.branch, base)) {
    entry.reason = `branch '${item.branch}' is not fully merged into '${base}'`;
    return entry;
  }
  if (!existsSync(path)) {
    entry.action = "clear stale worktree_path record (path missing on disk)";
  } else if (!gitRunner.worktreeList(root).map((p) => resolve(p)).includes(path)) {
    entry.reason = "path exists but is not a git worktree of this repo (remove it manually)";
    return entry;
  } else {
    entry.action = "remove worktree and delete the merged branch";
  }
  entry.removable = true;
  return entry;
}

/**
 * Reap worktrees of closed work (story-start-worktree): every item with a
 * `worktree_path` record is classified against the default branch. Default
 * mode only lists; `prune: true` removes removable worktrees (git worktree
 * remove), deletes their merged branches (git branch -d), and clears the
 * record. Items that are not done/cancelled and branches that are not fully
 * merged are reported as skipped and never touched. Throws on non-git trees
 * or undetectable default branch (CLI maps to CLEANUP_FAILED).
 */
export function runCleanup(opts: CleanupOptions, deps: CleanupDeps = {}): CleanupResult {
  const gitRunner = deps.git ?? defaultCleanupGit();
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  if (!gitRunner.isRepo(root)) {
    throw new Error(`not a git repository (${root}); arggon cleanup needs git`);
  }
  const base = gitRunner.defaultBranch(root);

  const byId = itemsById(loadItems(tasksDir));
  const tracked = [...byId.values()]
    .filter((item) => (item.worktreePath ?? null) !== null)
    .sort((a, b) => a.id.localeCompare(b.id));

  const entries = tracked.map((item) => classify(item, root, base, gitRunner));

  const pruned: CleanupAction[] = [];
  const failures: string[] = [];
  if (opts.prune) {
    for (const entry of entries.filter((e) => e.removable)) {
      try {
        if (entry.action?.startsWith("remove worktree")) {
          gitRunner.removeWorktree(root, entry.path);
          pruned.push({ id: entry.id, action: `removed worktree ${entry.path}` });
        }
        if (entry.branch && gitRunner.branchExists(root, entry.branch)) {
          gitRunner.deleteBranch(root, entry.branch);
          pruned.push({ id: entry.id, action: `deleted branch ${entry.branch}` });
        }
        runUpdate({ cwd: root, id: entry.id, worktreePath: "" });
        pruned.push({ id: entry.id, action: "cleared worktree_path" });
      } catch (err) {
        failures.push(
          `${entry.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return { root, base, entries, pruned, failures };
}
