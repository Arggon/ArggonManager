import { execFileSync, spawnSync, type ExecFileSyncOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { GhExecutor } from "./import-issues.js";
import type { WorkItem } from "./items.js";
import { isClaimed } from "./status.js";
import {
  defaultWorktreeStatus,
  detectWorktreeForeignWrites,
  isStartOwnedNodeModulesInstall,
  isStartOwnedWorktreeEnv,
  MAX_CLAIM_WRITE_NAMES,
  readWorktreeClaimStamp,
  WORKTREE_ENV_FILE,
  WORKTREE_NODE_MODULES_ENTRY,
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
 * The classifier is pure over the injected {@link CleanupGit} predicates, one
 * filesystem check (`existsSync`), one optional liveness probe of an existing
 * path (`worktreeIsLive`, default: git's own `prunable` verdict) and one
 * porcelain probe of an existing
 * worktree (`git status --porcelain`, optional/injectable): a recorded path
 * that is gone as work — missing on disk, or existing yet no live worktree of
 * this repo — clears the record, a path that exists and IS a live worktree but
 * is not registered with this repo is never touched, a branch that is not
 * provably integrated
 * (ancestry, or a merged PR through the optional gh fallback) is skipped with a
 * reason, and removal-blocking content is classified by kind — untracked
 * blockers need the caller's force opt-in, tracked modifications are refused
 * with or without it (bug-cleanup-prune-untracked-artifacts-no-force).
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
  /**
   * Additive (bug-cleanup-prune-untracked-artifacts-no-force): the content
   * that blocks `git worktree remove`, as ONE porcelain probe of the worktree
   * reported it — capped at `MAX_CLAIM_WRITE_NAMES` with the exact
   * `blockingTotal` beside it; ignored files are never listed (they die with
   * the worktree). Present whenever the probe observed blockers — on a `forced`
   * entry these are the untracked paths the removal will discard. The
   * start-owned entries every prune run reaps itself (start's install
   * link/farm, a start-shaped `.arggon.env`) are not blockers and never appear.
   */
  blockingPaths?: string[];
  /** Exact count of `blockingPaths` before the cap. */
  blockingTotal?: number;
  /**
   * Additive: the TRACKED paths among `blockingPaths` (staged, unstaged or
   * conflicted), capped with the exact `blockingTrackedTotal`. The force
   * opt-in never discards them, so their presence keeps the entry
   * non-removable with or without `--force`. Present only when there are any —
   * absent therefore means "every blocker is untracked".
   */
  blockingTracked?: string[];
  /** Exact count of tracked blockers before the cap. */
  blockingTrackedTotal?: number;
  /**
   * Additive: true when this entry's removal will pass `--force` — the
   * terminal+merged entry whose only blockers are untracked AND whose caller
   * armed the force opt-in. `action` says so, so a forced discard is never a
   * bare removal. Never set for tracked modifications, and never set without
   * the flag.
   */
  forced?: boolean;
};

/** Git operations for cleanup, injectable for tests. */
export type CleanupGit = {
  isRepo(cwd: string): boolean;
  /** Absolute paths of every worktree registered with this repo. */
  worktreeList(cwd: string): string[];
  /**
   * True when `path` is a LIVE working tree of this repo: git has a worktree
   * record for it AND the worktree's gitdir link is intact (`git worktree list
   * --porcelain` reports the path without a `prunable` marker). A record whose
   * gitdir is gone — an interrupted `git worktree remove` leaves exactly that:
   * files behind, `.git` deleted — is NOT live: `git worktree remove` refuses
   * it forever ("validation failed, cannot remove working tree") and it keeps
   * pinning the branch ("cannot delete branch … used by worktree"), so a reaper
   * that trusted the record alone retried a removal that can never succeed
   * (bug-cleanup-stuck-when-worktree-dir-gone).
   *
   * OPTIONAL: a runner that omits it is classified on {@link worktreeList}
   * alone (the pre-existing rule). The default runner answers from a real
   * `git worktree list --porcelain`, and a probe that cannot answer reports
   * `true` — unknown is never read as "gone", so a failed probe never clears a
   * live worktree's record.
   */
  worktreeIsLive?(cwd: string, path: string): boolean;
  /**
   * `git worktree prune --verbose`: drop worktree records whose worktree gitdir
   * is missing, and report whether at least one was dropped. The dead record a
   * stale worktree leaves behind pins its branch and keeps the path in `git
   * worktree list`, so the reaper drops it itself — no manual `git worktree
   * prune` step is ever needed. Idempotent, and it only ever drops records
   * whose location is already gone: a live worktree is never touched.
   *
   * OPTIONAL: a runner that omits it keeps the pre-existing behavior (the dead
   * record survives, but the entry still converges).
   */
  pruneWorktrees?(cwd: string): boolean;
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
   * `--force`: the release path passes it only when the caller armed the
   * take-over hatch, and the prune path only for an entry whose classification
   * set `forced` (terminal+merged, untracked-only blockers, force opt-in
   * armed) — never for tracked modifications.
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
  /**
   * The force opt-in (CLI `cleanup --prune --force`; native
   * `cleanup({ prune: true, force: true })`; bug-cleanup-prune-untracked-artifacts-no-force).
   * Default OFF, and then every removal-blocking file keeps the conservative
   * skip: unknown untracked content is never discarded implicitly. Armed, a
   * terminal+merged worktree whose blockers are ALL untracked becomes
   * removable with `forced: true` (its removal must then pass `--force`);
   * tracked modifications keep their refusal either way.
   */
  force?: boolean;
  /**
   * Porcelain probe (tests); defaults to a real `git status --porcelain`. A
   * probe that does not answer degrades to "no blocker evidence" — the entry
   * keeps the plain removal classification and `git worktree remove` decides
   * at removal time, exactly as before this probe existed.
   */
  status?: WorktreeStatusRunner;
  /**
   * The checkouts whose start-created install entry this run may unlink before
   * the removal (ownership scoping, `unlinkNodeModulesLink`). Defaults to the
   * canonical (first) worktree plus `root` — exactly what the CLI prune loop
   * unlinks against; the native surface passes the domain's canonical root
   * plus `root`, mirroring its own unlink calls.
   */
  primaryRoots?: string[];
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
    worktreeIsLive(cwd: string, path: string): boolean {
      let out: string;
      try {
        out = git(["worktree", "list", "--porcelain"], cwd);
      } catch {
        // A probe that cannot answer is never "gone": clearing a live
        // worktree's record on a failed git read would orphan the worktree.
        return true;
      }
      const target = resolve(path);
      // Porcelain blocks are blank-line separated; a block is live exactly when
      // git did not annotate it `prunable` (gitdir file points to a location
      // that does not exist). That is git's own verdict on the record, and it
      // is what `git worktree remove` validates before removing.
      for (const block of out.split(/\n\s*\n/)) {
        const lines = block.split("\n");
        const head = lines.find((line) => line.startsWith("worktree "));
        if (head === undefined) continue;
        if (resolve(head.slice("worktree ".length).trim()) !== target) continue;
        return !lines.some((line) => line.startsWith("prunable"));
      }
      return false;
    },
    pruneWorktrees(cwd: string): boolean {
      // `--verbose` prints one "Removing worktrees/<name>: …" line per dropped
      // record to STDERR (stdout stays empty — verified against git 2.47) and
      // nothing at all when there is nothing to drop. The presence of that
      // output — never its text — is the signal, so no git message is parsed
      // and no locale is assumed.
      const result = spawnSync("git", ["worktree", "prune", "--verbose"], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (result.error !== undefined || result.status !== 0) {
        const stderr = String(result.stderr ?? "").trim();
        const spawnMessage =
          result.error !== undefined ? String(result.error.message ?? result.error) : "";
        throw new Error(
          `git worktree prune failed${stderr ? `: ${stderr}` : spawnMessage ? ` (${spawnMessage})` : ""}`,
        );
      }
      return String(result.stderr ?? "").trim().length > 0;
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
 * state (existence, liveness, registration) → ONE porcelain probe of its
 * removal blockers (untracked vs tracked, start-owned artifacts discounted).
 * Every skip carries a `reason`; every removable entry carries the `action` the
 * surface performs, and `forced: true` when that removal must pass `--force`.
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
  } else if (gitRunner.worktreeIsLive !== undefined && !gitRunner.worktreeIsLive(root, path)) {
    // A registration is not a working tree (bug-cleanup-stuck-when-worktree-dir-gone).
    // git keeps a worktree's record even when its gitdir link is gone — an
    // interrupted `git worktree remove` leaves exactly that: files behind,
    // `.git` deleted, the record `prunable` — and `git worktree remove` then
    // refuses it forever ("validation failed, cannot remove working tree:
    // '<path>/.git' does not exist", or "fatal: '<path>' is not a working
    // tree" once the record was pruned by hand) while it keeps pinning the
    // branch ("cannot delete branch … used by worktree"). The worktree is
    // already gone as work, so the entry is a stale record: no removal is
    // attempted, the dead git record is pruned ({@link CleanupGit.pruneWorktrees}),
    // the merged branch is still deleted and the record is cleared. A leftover
    // directory is never the reaper's to delete — it is not a worktree — and
    // stays for the operator, which the action says.
    entry.action =
      "clear stale worktree_path record (path is not a live worktree of this repo; " +
      "any leftover directory is left in place)";
  } else {
    const registered = gitRunner.worktreeList(root).map((p) => resolve(p));
    if (!registered.includes(path)) {
      entry.reason = "path exists but is not a git worktree of this repo (remove it manually)";
      return entry;
    }
    // ONE porcelain probe decides whether the removal can actually happen
    // (bug-cleanup-prune-untracked-artifacts-no-force). Before this gate the
    // classifier reported `removable: true` for a worktree git always refuses,
    // so an operator read "removable" and then hit a raw git error. A probe
    // that does not answer degrades to the pre-probe classification — the
    // removal attempt then reports its own failure, exactly as before.
    const porcelain = (deps.status ?? defaultWorktreeStatus)(path);
    if (porcelain !== undefined) {
      const primaryRoots = (
        deps.primaryRoots ?? [registered[0] ?? resolve(root), resolve(root)]
      ).map((primary) => resolve(primary));
      const blockers = parseRemovalBlockers(porcelain);
      const untracked = blockers.untracked.filter(
        (rel) => !isSelfReapedArtifact(path, rel, primaryRoots),
      );
      if (blockers.tracked.length > 0) {
        // Uncommitted TRACKED work: refused with or without the force opt-in.
        entry.reason = worktreeTrackedRefusal(item, path, blockers.tracked);
        entry.blockingPaths = [...untracked, ...blockers.tracked].slice(0, MAX_CLAIM_WRITE_NAMES);
        entry.blockingTotal = untracked.length + blockers.tracked.length;
        entry.blockingTracked = blockers.tracked.slice(0, MAX_CLAIM_WRITE_NAMES);
        entry.blockingTrackedTotal = blockers.tracked.length;
        return entry;
      }
      if (untracked.length > 0) {
        entry.blockingPaths = untracked.slice(0, MAX_CLAIM_WRITE_NAMES);
        entry.blockingTotal = untracked.length;
        if (deps.force !== true) {
          // Conservative default: unknown untracked content blocks removal and
          // is never discarded implicitly — the skip names the flag AND the
          // manual sequence.
          entry.reason = worktreeUntrackedRefusal(item, path, untracked);
          return entry;
        }
        // Armed force + untracked-only blockers: the removal is authorized to
        // discard exactly this content (never tracked changes), and says so.
        entry.forced = true;
      }
    }
    // The action names exactly what the surface does, and a forced discard
    // says so (never a bare removal).
    entry.action =
      entry.forced === true
        ? "remove worktree (forced past its untracked content), delete its branch and clear the worktree_path record"
        : "remove worktree and delete the merged branch";
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
  return parsePorcelainPaths(porcelain).map((entry) => entry.path);
}

/** One parsed porcelain line: the post-rename path plus its untracked flag. */
function parsePorcelainPaths(porcelain: string): Array<{ path: string; untracked: boolean }> {
  const entries: Array<{ path: string; untracked: boolean }> = [];
  for (const line of porcelain.split("\n")) {
    if (line.trim().length === 0) continue;
    const code = line.slice(0, 2);
    if (code === "!!") continue; // ignored files die with the worktree
    let path = line.slice(3).trim();
    const arrow = path.indexOf(" -> ");
    if (arrow !== -1) path = path.slice(arrow + 4);
    path = path.replace(/^"|"$/g, "");
    if (path.length > 0) entries.push({ path, untracked: code === "??" });
  }
  return entries;
}

/**
 * The removal blockers of {@link parseRemovalBlockingPaths}, split by what the
 * force opt-in may discard (bug-cleanup-prune-untracked-artifacts-no-force):
 * untracked entries (`??`) versus tracked modifications (every other
 * non-ignored status). Ignored files are in neither — they die with the
 * worktree.
 */
export type RemovalBlockers = {
  /** Untracked paths (`??`): the only content the force opt-in may discard. */
  untracked: string[];
  /** Tracked paths with staged/unstaged/conflicted changes: never force-removed. */
  tracked: string[];
};

export function parseRemovalBlockers(porcelain: string): RemovalBlockers {
  const untracked: string[] = [];
  const tracked: string[] = [];
  for (const entry of parsePorcelainPaths(porcelain)) {
    (entry.untracked ? untracked : tracked).push(entry.path);
  }
  return { untracked, tracked };
}

/**
 * Bound ONE untrusted path inside a skip reason: porcelain paths come from the
 * worktree being classified (a file name can reach NAME_MAX), and a reason
 * rides the `--json` envelope/skip line, so `MAX_CLAIM_WRITE_NAMES` names at
 * this per-path bound keep the whole sentence readable and bounded.
 */
function boundedPathName(path: string): string {
  return path.length > 120 ? `${path.slice(0, 119)}…` : path;
}

/**
 * The refusal for a terminal+merged worktree whose removal is blocked by
 * UNTRACKED content while the force opt-in is NOT armed
 * (bug-cleanup-prune-untracked-artifacts-no-force). The conservative default is
 * unchanged — nothing is touched, and unknown untracked files are never
 * discarded implicitly — but the skip now names the actual blockers and BOTH
 * remedies: the flag that would discard exactly this content (never tracked
 * changes) and the manual sequence.
 */
export function worktreeUntrackedRefusal(item: WorkItem, path: string, paths: string[]): string {
  const named = paths.slice(0, MAX_CLAIM_WRITE_NAMES).map(boundedPathName);
  const extra = paths.length - named.length;
  const branchStep = item.branch ? `, then git branch -D ${item.branch}` : "";
  return (
    `skipping the worktree of '${item.id}': ${paths.length} untracked file` +
    `${paths.length === 1 ? "" : "s"} block 'git worktree remove' (${named.join(", ")}` +
    `${extra > 0 ? `, and ${extra} more` : ""}). Nothing was removed. Discard them with the force ` +
    "opt-in — arggon cleanup --prune --force (native cleanup({ prune: true, force: true })), which " +
    "never discards tracked changes — or reap the worktree by hand: git worktree remove --force " +
    `${path}${branchStep}, then arggon cleanup --prune to clear the record.`
  );
}

/**
 * The refusal for a terminal+merged worktree whose removal is blocked by
 * TRACKED modifications — uncommitted work the force opt-in never discards, so
 * it is a refusal WITH and WITHOUT the flag; the remedy is to commit or
 * discard that work first (or reap by hand, the documented last resort).
 */
export function worktreeTrackedRefusal(item: WorkItem, path: string, paths: string[]): string {
  const named = paths.slice(0, MAX_CLAIM_WRITE_NAMES).map(boundedPathName);
  const extra = paths.length - named.length;
  const branchStep = item.branch ? `, then git branch -D ${item.branch}` : "";
  return (
    `skipping the worktree of '${item.id}': ${paths.length} tracked file` +
    `${paths.length === 1 ? " has" : "s have"} uncommitted changes (${named.join(", ")}` +
    `${extra > 0 ? `, and ${extra} more` : ""}), which block 'git worktree remove'; the force ` +
    "opt-in never discards tracked work. Commit or discard that work first, then re-run prune — or " +
    `reap the worktree by hand: git worktree remove --force ${path}${branchStep}, then ` +
    "arggon cleanup --prune to clear the record."
  );
}

/**
 * True when `relPath` is one of the two start-owned root entries this run
 * removes BEFORE `git worktree remove` AND it actually carries the start shape
 * (the very ownership predicates `unlinkNodeModulesLink` / `unlinkWorktreeEnv`
 * use). A foreign install or an adopter-customized env file is NOT this — it
 * stays a blocker. Paths come from porcelain, so a collapsed untracked
 * directory keeps its trailing slash.
 */
function isSelfReapedArtifact(
  worktreePath: string,
  relPath: string,
  primaryRoots: string[],
): boolean {
  const rel = relPath.replace(/\/+$/, "");
  if (rel === WORKTREE_ENV_FILE) return isStartOwnedWorktreeEnv(worktreePath);
  if (rel === WORKTREE_NODE_MODULES_ENTRY) {
    return primaryRoots.some((primary) => isStartOwnedNodeModulesInstall(primary, worktreePath));
  }
  return false;
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
