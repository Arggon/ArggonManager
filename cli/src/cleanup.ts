import { resolve } from "node:path";
import {
  classifyCleanupEntry,
  commitTrackerMutation,
  defaultCleanupGit,
  findTasksDir,
  itemsById,
  loadItems,
  readAutoCommitConfig,
  repoRootFromTasks,
  resolveAutoCommit,
  runUpdate,
  trackerCommitMessage,
  type CleanupEntry,
  type CleanupGit,
  type GhExecutor,
  type TrackerCommitResult,
} from "@arggondev/lib";

import { unlinkNodeModulesLink } from "./start.js";

/**
 * Cleanup classification and git plumbing are shared kernel rules since W4
 * (task-native-permissions-worktrees): the native `cleanup` tool classifies
 * with the same `classifyCleanupEntry` over its own domain-backed
 * {@link CleanupGit}. Re-exported here so the CLI surface (and its tests) keep
 * importing them from `./cleanup.js`.
 */
export {
  classifyCleanupEntry,
  defaultCleanupGit,
  findMergedPr,
  type CleanupEntry,
  type CleanupGit,
  type GhExecutor,
  type MergedPr,
} from "@arggondev/lib";

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

export type CleanupDeps = {
  git?: CleanupGit;
  /** gh executor for the squash-merge fallback; defaults to the real gh CLI. */
  gh?: GhExecutor;
};

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
    classifyCleanupEntry(item, root, base, gitRunner, { noGh: opts.noGh, gh: deps.gh }),
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
