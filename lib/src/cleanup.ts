import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { GhExecutor } from "./import-issues.js";
import type { WorkItem } from "./items.js";
import { isClaimed } from "./status.js";
import {
  defaultWorktreeStatus,
  detectWorktreeForeignWrites,
  MAX_CLAIM_WRITE_NAMES,
  readWorktreeClaimStamp,
  type GitDirRunner,
  type WorktreeClaimStamp,
  type WorktreeForeignWriteReport,
  type WorktreeStatusRunner,
} from "./worktree.js";

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
  /**
   * `git worktree remove <path>` (refuses dirty worktrees). `opts.force` adds
   * `--force`: only the release path passes it, and only when the caller armed
   * the take-over hatch — prune never forces.
   */
  removeWorktree(cwd: string, path: string, opts?: { force?: boolean }): void;
  /** Safe `git branch -d <branch>` (only succeeds for merged branches). */
  deleteBranch(cwd: string, branch: string): void;
  /**
   * `git branch -D <branch>` — used only when a squash-merged PR (not git
   * ancestry) proved the branch integrated, so `-d` would refuse it.
   */
  deleteBranchForce(cwd: string, branch: string): void;
  branchExists(cwd: string, name: string): boolean;
  /**
   * The branch a worktree currently has checked out (`null` for a detached
   * HEAD or a probe that did not answer). OPTIONAL: release reads the branch
   * from the worktree itself (the recorded `branch` field is cleared by the
   * very unclaim that asks for the release), and a runner without it falls back
   * to the item's recorded branch.
   */
  worktreeBranch?(cwd: string, path: string): string | null;
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
    removeWorktree(cwd: string, path: string, opts?: { force?: boolean }): void {
      git(["worktree", "remove", ...(opts?.force === true ? ["--force"] : []), path], cwd);
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
    worktreeBranch(cwd: string, path: string): string | null {
      // Read from the WORKTREE, never from the item: the recorded branch is
      // cleared by the unclaim that asks for this release, so the item is not a
      // source here. A detached HEAD (`HEAD`) means no branch to delete.
      const name = git(["rev-parse", "--abbrev-ref", "HEAD"], path);
      return name.length > 0 && name !== "HEAD" ? name : null;
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

/**
 * Claim RELEASE (bug-unclaim-leaves-worktree-record-without-reaper) — the
 * release path, the inverse of `start --worktree`, and the half of the unclaim
 * contract that `update` deliberately does not own.
 *
 * Why it is not `update`: `update` is a frontmatter-only kernel op with no git
 * lifecycle (it is the very call `cleanup` uses to CLEAR a `worktree_path`
 * record), so it cannot remove a worktree — and silently destroying a working
 * tree on a status flip would be the wrong default anyway. What `update` does
 * instead is report the dropped claim's footprint (its `claimFootprint`
 * receipt) naming this path, so the consequence is visible on the same call
 * that causes it. The release itself — worktree, branch, `worktree_path`,
 * `.arggon.env`, claim stamp — lives here, in the worktree domain, with CLI and
 * native parity by construction (both surfaces call this rule).
 *
 * It is deliberately NOT the prune classifier: prune reaps worktrees of FINISHED
 * work whose branch is integrated into the base (terminal status + merge), while
 * a release reaps an ABANDONED claim (any status, branch merged or not). The
 * two never compete for one item in one run — the CLI refuses `--release`
 * together with `--prune`. A terminal item is therefore NOT this path: its
 * remedy is `--prune`, whose merge gate protects unmerged work.
 */
export type ReleaseRequest = {
  /**
   * Identity asking for the release: the calling session id on the native
   * surface, the resolved assignee on the CLI — the same value `start` stamped.
   */
  identity: string;
  /**
   * Deliberate take-over of a presumed-dead stamped owner
   * (task-strict-attach-dead-owner-hatch; CLI `--take-over-worktree`). Default
   * OFF, and then the flag changes NOTHING about a clean release: a fired
   * single-writer detection and removal-blocking content each keep their
   * refusal, because those are the evidence of a live writer and of work a
   * release would discard without removing anything. Armed, it releases anyway
   * and records the replaced stamp on the entry — the caller owns the judgement,
   * the kernel only reports it.
   *
   * It does NOT bypass the still-claimed refusal (m6): a re-claimed item has a
   * live owner by definition, and nothing durable here records an override.
   */
  takeOver?: boolean;
  /**
   * Porcelain-probe override (tests); defaults to a real `git status`. Shared
   * by the live-writer detection and the removal-blocking check, so a run
   * probes the worktree at most once.
   */
  status?: WorktreeStatusRunner;
  /** Git-dir-probe override (tests); defaults to a real `git rev-parse`. */
  gitDir?: GitDirRunner;
};

/** One item classified for release, with the refusal evidence when it refused. */
export type ReleaseEntry = {
  id: string;
  status: string;
  /** Branch the release deletes (the worktree's own HEAD, else the recorded one). */
  branch: string | null;
  /** Absolute worktree path as recorded on the item ("" when none is). */
  path: string;
  /** True when the release may proceed. */
  releasable: boolean;
  /** Why the release is refused (null when releasable). */
  reason: string | null;
  /** What the release does (null when refused). */
  action: string | null;
  /**
   * The fired single-writer detection behind a refusal — a stamp held by a
   * DIFFERENT identity plus tracked files modified after that claim, i.e. the
   * F12 signature of a live writer. Present only on that refusal.
   */
  foreignWrites?: WorktreeForeignWriteReport;
  /** The stamp an armed take-over replaced (task-strict-attach-dead-owner-hatch). */
  takeOver?: { replacedIdentity: string; replacedClaimedAt: string };
  /**
   * Additive (review M2): the paths that block `git worktree remove`
   * (uncommitted or untracked content), capped at `MAX_CLAIM_WRITE_NAMES`, with
   * the exact `blockingTotal`. Present only on the refusal that names them —
   * whose reason explains that a release would otherwise strip the worktree's
   * env file and claim stamp without removing anything.
   */
  blockingPaths?: string[];
  /** Exact count of `blockingPaths` before the cap. */
  blockingTotal?: number;
};

/**
 * The refusal sentence for a release whose single-writer detection FIRED
 * (exploration 017 F12): the same evidence and the same remedy ORDER as the
 * attach-time strict gate (`strictWorktreeWriteFailure`) — coordinate with the
 * stamped session first (non-destructive, and the correct read for a live
 * owner), then the audited take-over for a presumed-dead owner, then the
 * documented manual stamp removal. The named-file list goes LAST for the same
 * reason there: the human channel clips a long line at its HEAD, and the
 * remedies are the actionable part.
 */
export function worktreeReleaseRefusal(
  item: WorkItem,
  path: string,
  report: WorktreeForeignWriteReport,
): string {
  const extra = report.total - report.files.length;
  const named = report.files.join(", ");
  return (
    `refusing to release the worktree of '${item.id}': it is stamped by session ` +
    `${report.owner} (claimed ${report.claimedAt}) and ${report.total} tracked ` +
    `file${report.total === 1 ? " was" : "s were"} modified after that claim — another ` +
    "session may still be writing there. Coordinate with the stamped session first; if that " +
    "session is gone, confirm no live writer and re-run with the take-over flag " +
    "(cleanup --release <id> --take-over-worktree; native cleanup({ release, take_over_worktree })); " +
    "as a last resort remove the stamp by hand " +
    `(rm "$(git -C ${path} rev-parse --absolute-git-dir)/arggon-claim.json"). ` +
    `Files modified after that claim: ${named}${extra > 0 ? ` (and ${extra} more)` : ""}.`
  );
}

/**
 * The porcelain lines that BLOCK `git worktree remove`: git refuses a worktree
 * with modified, staged, renamed, conflicted or untracked content — only
 * IGNORED (`!!`) files go away with it. Raw output (never trimmed: the leading
 * status columns are positional), rename lines (`R  old -> new`) contribute the
 * post-rename path.
 */
export function parseRemovalBlockingPaths(porcelain: string): string[] {
  const paths: string[] = [];
  for (const line of porcelain.split("\n")) {
    if (line.trim().length === 0) continue;
    if (line.slice(0, 2) === "!!") continue; // ignored files die with the worktree
    let path = line.slice(3).trim();
    const arrow = path.indexOf(" -> ");
    if (arrow !== -1) path = path.slice(arrow + 4);
    path = path.replace(/^"|"$/g, "");
    if (path.length > 0) paths.push(path);
  }
  return paths;
}

/**
 * The refusal for a worktree that cannot be removed as it stands (review M2).
 *
 * git refuses a dirty worktree, so releasing one without the take-over hatch
 * would reaped nothing while DESTROYING the evidence: the env file goes (it is
 * untracked, so it has to go before the removal) and — before this gate existed
 * — so did the claim stamp, which disarmed the single-writer gate for every
 * later attempt and lost the F12 evidence. Refusing during classification, with
 * the offending paths named, keeps the whole footprint intact and the retry
 * honest. Same bounded shape as the F12 refusal (a cap on the names, the exact
 * total).
 */
export function worktreeDirtyRefusal(item: WorkItem, paths: string[]): string {
  const named = paths.slice(0, MAX_CLAIM_WRITE_NAMES);
  const extra = paths.length - named.length;
  return (
    `refusing to release the worktree of '${item.id}': it has ${paths.length} uncommitted or ` +
    `untracked file${paths.length === 1 ? "" : "s"}, so 'git worktree remove' would refuse it and a ` +
    "release would discard the work without removing the worktree. Commit or discard that work " +
    "first, or — if the stamped owner is dead and the work is disposable — confirm no live writer " +
    "and re-run with the take-over flag (cleanup --release <id> --take-over-worktree; native " +
    `cleanup({ release, take_over_worktree })). Blocking paths: ${named.join(", ")}` +
    `${extra > 0 ? ` (and ${extra} more)` : ""}.`
  );
}

/**
 * Classify ONE item for release. The order is the contract: recorded path →
 * still claimed → filesystem state → branch → ONE porcelain probe feeding the
 * live-writer gate and the removal-blocking gate. Every refusal carries a
 * `reason`; every releasable entry carries the `action` the surface performs.
 *
 * Two refusals are UNCONDITIONAL, by decision (m6, coordinator ruling):
 *
 * - **still claimed** — a re-claimed item has a live owner by definition, and
 *   the cheap remedy is that owner's own unclaim. `--take-over-worktree` does
 *   NOT bypass it; the hatch is for a *presumed-dead stamped owner on an
 *   unclaimed item*, where nothing durable would record the override either.
 * - **removal-blocking content** — refused unless the take-over hatch is armed,
 *   because reaping the env file (untracked, so it must go before the removal)
 *   and then failing to remove anything is how a failed release used to strip
 *   the claim stamp off a surviving worktree.
 *
 * The live-writer gate reuses the attach-time detection verbatim: the stamp must
 * name a DIFFERENT identity than the requester, and tracked files must have moved
 * after that stamp. Its bound is the documented one (one porcelain read plus one
 * `stat` per dirty path, no full-tree walk) and its degradation is the same — a
 * missing or corrupt stamp, or a probe that does not answer, yields no detection
 * and never a false accusation. An armed `takeOver` is the only sanctioned way
 * past a fired detection or a dirty worktree, exactly like `start`'s.
 */
export function classifyReleaseEntry(
  item: WorkItem,
  root: string,
  gitRunner: CleanupGit,
  request: ReleaseRequest,
): ReleaseEntry {
  const path = item.worktreePath ? resolve(item.worktreePath) : "";
  const entry: ReleaseEntry = {
    id: item.id,
    status: item.status,
    branch: null,
    path,
    releasable: false,
    reason: null,
    action: null,
  };
  if (path === "") {
    entry.reason = "no worktree recorded on the item (nothing to release)";
    return entry;
  }
  if (isClaimed(item.type, item.status, item.assignee)) {
    // The release exists for an ABANDONED claim, and this refusal is
    // unconditional (m6): a re-claimed item has a live owner, the cheap remedy
    // is that owner's own unclaim, and unlike `start`'s take-over nothing here
    // durably records an override.
    entry.reason =
      `item is still claimed by ${item.assignee} — drop the claim first ` +
      `(arggon update ${item.id} --status todo), then release the worktree. ` +
      "This refusal is not overridable: --take-over-worktree is for a " +
      "presumed-dead stamped owner on an UNCLAIMED item.";
    return entry;
  }
  if (!existsSync(path)) {
    // Same stale-record clause as prune: the worktree is already gone, so the
    // record is the only thing left to clear.
    entry.action = "clear stale worktree_path record (path missing on disk)";
    entry.releasable = true;
    return entry;
  }
  if (
    !gitRunner
      .worktreeList(root)
      .map((p) => resolve(p))
      .includes(path)
  ) {
    entry.reason = "path exists but is not a git worktree of this repo (remove it manually)";
    return entry;
  }
  // Branch: the WORKTREE is the source of truth (the recorded field is cleared
  // by the unclaim that asks for this release, and a detached worktree has no
  // branch to delete). A runner without the optional probe falls back to the
  // recorded branch.
  entry.branch =
    gitRunner.worktreeBranch === undefined
      ? (item.branch ?? null)
      : (gitRunner.worktreeBranch(root, path) ?? null);

  // ONE porcelain probe, shared by both gates below: the F12 detection needs the
  // raw lines (status columns are positional) and the removal-blocking check
  // needs the same read. A probe that does not answer degrades to "no evidence"
  // for both — never to a refusal, and never to a false accusation.
  const porcelain = (request.status ?? defaultWorktreeStatus)(path);

  const stamp: WorktreeClaimStamp | null = readWorktreeClaimStamp(path, {
    ...(request.gitDir !== undefined ? { gitDir: request.gitDir } : {}),
  });
  if (stamp !== null && stamp.identity !== request.identity && porcelain !== undefined) {
    const foreignWrites = detectWorktreeForeignWrites(path, stamp, {
      status: () => porcelain,
    });
    if (foreignWrites !== null) {
      if (request.takeOver !== true) {
        entry.reason = worktreeReleaseRefusal(item, path, foreignWrites);
        entry.foreignWrites = foreignWrites;
        return entry;
      }
      entry.takeOver = {
        replacedIdentity: stamp.identity,
        replacedClaimedAt: stamp.claimedAt,
      };
    }
  }
  let forced = false;
  if (porcelain !== undefined) {
    const blocking = parseRemovalBlockingPaths(porcelain);
    if (blocking.length > 0) {
      if (request.takeOver !== true) {
        entry.reason = worktreeDirtyRefusal(item, blocking);
        entry.blockingPaths = blocking.slice(0, MAX_CLAIM_WRITE_NAMES);
        entry.blockingTotal = blocking.length;
        return entry;
      }
      // The hatch disarms the refusal AND forces the removal; the action says
      // so, so the envelope never reports a bare forced discard (and this is
      // the ONLY case in which a removal is forced).
      forced = true;
    }
  }
  const disposal =
    entry.branch === null
      ? "clear the worktree_path record"
      : "delete its branch and clear the worktree_path record";
  entry.action = forced
    ? `remove the worktree (forced past its uncommitted content), ${disposal}`
    : `remove the worktree, ${disposal}`;
  entry.releasable = true;
  return entry;
}
