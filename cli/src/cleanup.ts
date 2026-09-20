import { execFileSync, ExecFileSyncOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  commitTrackerMutation,
  findTasksDir,
  itemsById,
  loadItems,
  readAutoCommitConfig,
  repoRootFromTasks,
  resolveAutoCommit,
  runUpdate,
  trackerCommitMessage,
  type TrackerCommitResult,
  type WorkItem,
} from "@arggon/lib";

import { unlinkNodeModulesLink } from "./start.js";

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
  /**
   * Auto-commit the item files whose worktree_path record `--prune` cleared
   * (tracker hygiene): ONE commit covering all cleared records. `undefined`
   * resolves via `x-tracker.auto-commit` config, default ON.
   */
  commit?: boolean;
  /**
   * Skip the gh squash-merge fallback entirely (task-cleanup-squash-merge):
   * ancestry-only classification, current behavior — for offline/CI use.
   */
  noGh?: boolean;
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
  /**
   * Present when the branch failed the ancestry check but a squash-merged PR
   * proves it was integrated (task-cleanup-squash-merge), e.g.
   * "squash-merged PR #12".
   */
  via?: string;
};

/** One completed prune action. */
export type CleanupAction = {
  id: string;
  action: string;
  /** Present on `failed` actions: why the action failed. */
  error?: string;
  /** Present when the branch could not be deleted (worktree already removed). */
  leftoverBranch?: string;
  /**
   * Present when the prune was enabled by the squash-merge fallback rather
   * than git ancestry (task-cleanup-squash-merge), e.g. "squash-merged PR #12".
   */
  via?: string;
};

export type CleanupResult = {
  /** Repo root (parent of the tracker dir; the git cwd). */
  root: string;
  /** Branch merge safety is checked against this ref (e.g. origin/main). */
  base: string;
  /** Every tracked worktree with its classification. */
  entries: CleanupEntry[];
  /** Actions performed (only with prune: true). */
  pruned: CleanupAction[];
  /** Per-item failures during prune (removal/branch-delete errors). */
  failures: string[];
  /** Tracker auto-commit outcome for the cleared worktree_path records (prune only). */
  commit?: TrackerCommitResult;
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

/** Signature for the gh executor (injectable for tests; get-open-prs pattern). */
export type GhExecutor = (file: string, args: string[], options?: ExecFileSyncOptions) => string;

/** Default gh executor bound for use as a default value (get-open-prs pattern). */
const defaultExecGh: GhExecutor = (file, args, options) =>
  execFileSync(file, args, options) as string;

export type CleanupDeps = {
  git?: CleanupGit;
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

function classify(
  item: WorkItem,
  root: string,
  base: string,
  gitRunner: CleanupGit,
  deps: { noGh?: boolean; gh?: GhExecutor } = {},
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
  if (!TERMINAL.has(item.status)) {
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

/**
 * Reap worktrees of closed work (story-start-worktree): every item with a
 * `worktree_path` record is classified against the default branch. Default
 * mode only lists; `prune: true` removes removable worktrees (git worktree
 * remove), deletes their merged branches (git branch -d), and clears the
 * record. Items that are not done/cancelled and branches that are not fully
 * merged are reported as skipped and never touched. Before anything is
 * removed, both the local branch AND its remote counterpart (when
 * `origin/<branch>` exists) must be merged into the base, so a lost push can
 * never leave a stranded remote tip (bug-cleanup-partial-failure). Per-item
 * prune failures are reported and never abort the run. Throws on non-git
 * trees or undetectable default branch (CLI maps to CLEANUP_FAILED).
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

  const entries = tracked.map((item) =>
    classify(item, root, base, gitRunner, { noGh: opts.noGh, gh: deps.gh }),
  );

  const pruned: CleanupAction[] = [];
  const failures: string[] = [];
  const clearedPaths: string[] = [];
  const clearedIds: string[] = [];
  if (opts.prune) {
    for (const entry of entries.filter((e) => e.removable)) {
      // Squash-merged entries need `git branch -D`: their tip is not an
      // ancestor of base (that is why the PR lookup ran), so `-d` would refuse.
      const deleteBranch = entry.via
        ? (branch: string) => gitRunner.deleteBranchForce(root, branch)
        : (branch: string) => gitRunner.deleteBranch(root, branch);
      try {
        if (entry.action?.startsWith("remove worktree")) {
          // Start-created node_modules links are untracked, and `node_modules/`
          // ignore patterns match directories only, so git refuses to remove
          // the worktree because of the link (review F2). Remove only a symlink
          // whose target is the primary checkout's install — never a real
          // directory, never a link elsewhere — then let git do the removal (it
          // can still refuse for other untracked files, reported per item).
          //
          // Ownership (review R3): the link points at the checkout that ran
          // `arggon start`. When cleanup runs from a LINKED worktree, that is
          // the MAIN checkout, not the current root, so resolve the canonical
          // (first) `git worktree list` entry as the ownership target. The
          // current root is checked too: a start run from this worktree links
          // this worktree's install.
          const mainRoot = resolve(gitRunner.worktreeList(root)[0] ?? root);
          unlinkNodeModulesLink(mainRoot, entry.path);
          if (mainRoot !== resolve(root)) unlinkNodeModulesLink(root, entry.path);
          gitRunner.removeWorktree(root, entry.path);
          pruned.push({
            id: entry.id,
            action: `removed worktree ${entry.path}`,
            ...(entry.via ? { via: entry.via } : {}),
          });
        }
        if (entry.branch && gitRunner.branchExists(root, entry.branch)) {
          try {
            deleteBranch(entry.branch);
            pruned.push({
              id: entry.id,
              action: `deleted branch ${entry.branch}`,
              ...(entry.via ? { via: entry.via } : {}),
            });
          } catch (err) {
            // Race: pre-flight passed but the delete failed. The worktree is
            // already gone, so its record is obsolete either way; report the
            // leftover branch explicitly and keep the run going.
            const message = err instanceof Error ? err.message : String(err);
            pruned.push({
              id: entry.id,
              action: "failed",
              error: message,
              leftoverBranch: entry.branch,
            });
          }
        }
        // Clear the record whenever the worktree is gone (including entries
        // whose stale record pointed at a missing path); a failed branch
        // delete does not make the record useful again.
        runUpdate({ cwd: root, id: entry.id, worktreePath: "" });
        pruned.push({ id: entry.id, action: "cleared worktree_path" });
        // Entries are built from byId values, so the item always resolves.
        clearedPaths.push(byId.get(entry.id)!.filePath);
        clearedIds.push(entry.id);
      } catch (err) {
        // Per-candidate failure: nothing is orphaned (the worktree_path
        // record stays only while the worktree still exists); the run
        // continues and CLEANUP_FAILED is not raised.
        const message = err instanceof Error ? err.message : String(err);
        failures.push(`${entry.id}: ${message}`);
        pruned.push({ id: entry.id, action: "failed", error: message });
      }
    }
  }

  // Tracker hygiene (task-auto-commit-tracker): one commit covering every
  // item file whose worktree_path record was cleared this run — staged
  // surgically by path, so unrelated dirty state stays untouched. Skipped
  // when nothing was cleared; never fails the command.
  const commit: TrackerCommitResult | undefined =
    opts.prune && clearedPaths.length > 0
      ? commitTrackerMutation(root, clearedPaths, {
          message: trackerCommitMessage("pruned", clearedIds),
          commit: resolveAutoCommit(opts.commit, readAutoCommitConfig(root)),
        })
      : undefined;

  return { root, base, entries, pruned, failures, commit };
}
