import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";
import {
  classifyCleanupEntry,
  classifyReleaseEntry,
  commitTrackerMutation,
  defaultCleanupGit,
  findTasksDir,
  itemsById,
  loadItems,
  readAutoCommitConfig,
  readConventionConfig,
  readWorktreeClaimStamp,
  readConventionVersion,
  repoRootFromTasks,
  resolveAutoCommit,
  resolveCurrentLogin,
  runUpdate,
  trackerCommitMessage,
  worktreeComposeProject,
  type CleanupEntry,
  type CleanupGit,
  type GhExecutor,
  type ReleaseEntry,
  type TrackerCommitResult,
  type WorkItem,
} from "@arggondev/lib";

import { unlinkNodeModulesLink, unlinkWorktreeClaimStamp, unlinkWorktreeEnv } from "./start.js";

/**
 * Cleanup classification and git plumbing are shared kernel rules since W4
 * (task-native-permissions-worktrees): the native `cleanup` tool classifies
 * with the same `classifyCleanupEntry` over its own domain-backed
 * {@link CleanupGit}. Re-exported here so the CLI surface (and its tests) keep
 * importing them from `./cleanup.js`.
 */
export {
  classifyCleanupEntry,
  classifyReleaseEntry,
  defaultCleanupGit,
  findMergedPr,
  type CleanupEntry,
  type CleanupGit,
  type GhExecutor,
  type MergedPr,
  type ReleaseEntry,
} from "@arggondev/lib";

/**
 * Envelope text bound (bug-cli-cleanup-branch-delete-missing-failure):
 * untrusted git text enters the `--json` envelope bounded and single-line —
 * control characters become spaces, then the value clips at `max` characters
 * with an elision mark. Same shape as the native plugin's `boundedNativeText`
 * + `MAX_NATIVE_DETAIL_CHARS`. The `sanitizeHumanError`/`clipHumanValue`
 * helpers in `lib/src/sanitize.ts` are the HUMAN channel (2000 chars plus
 * escaping) and must never be reused here: the envelope is a machine surface.
 */
export const MAX_ENVELOPE_DETAIL_CHARS = 500;

export function boundedEnvelopeText(value: unknown, max: number): string {
  const text = (typeof value === "string" ? value : String(value)).replace(
    /[\u0000-\u001f\u007f]/g,
    " ",
  );
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * One Compose teardown, injectable for tests (no daemon in CI). Runs
 * `docker compose -p <project> down -v --remove-orphans` (cwd = the repo
 * root — no Compose file is needed: `down` resolves the project through the
 * containers' `com.docker.compose.project` labels). Contract: throwing an
 * error whose `code` is `"ENOENT"` signals that the docker CLI is absent —
 * the report-only degradation for the whole run; any other throw is a
 * per-item reap failure (never fatal).
 */
export type ComposeDown = (project: string, cwd: string) => void;

/** `docker compose down` timeout (bounded like the gh lookup's 30s). */
export const COMPOSE_DOWN_TIMEOUT_MS = 120_000;

function defaultComposeDown(project: string, cwd: string): void {
  try {
    execFileSync("docker", ["compose", "-p", project, "down", "-v", "--remove-orphans"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: COMPOSE_DOWN_TIMEOUT_MS,
    });
  } catch (err) {
    // Absent docker CLI: rethrow untouched — the ENOENT `code` IS the
    // report-only signal the runCleanup reap step keys on.
    if ((err as NodeJS.ErrnoException | null)?.code === "ENOENT") throw err;
    const stderr =
      err !== null && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: unknown }).stderr).trim()
        : "";
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `docker compose -p ${project} down -v --remove-orphans failed` +
        (stderr ? `: ${stderr}` : ` (${message})`),
    );
  }
}

/** Compose reaping report (ADR 0019 layer 2): present only when the repo declares services. */
export type CleanupComposeReport = {
  /**
   * The raw `x-worktree.services` declaration: `"true"` (the per-worktree
   * project is named exactly `<repo>-<item-id>`) or the declared base name
   * (the project is `<base>-<repo>-<item-id>`, lowercased).
   */
  declared: string;
  /**
   * True when the docker CLI was absent (first reap attempt failed with
   * `ENOENT`): reaping degraded to report-only for the rest of the run —
   * never a failure, never fatal (the ADR's report-only path).
   */
  dockerUnavailable?: boolean;
};

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
  /**
   * Release the named item's claim footprint (bug-unclaim-leaves-worktree-record-without-reaper):
   * remove the recorded worktree, delete its branch, reap the start-created
   * `.arggon.env` + `arggon-claim.json` stamp and clear the `worktree_path`
   * record — the inverse of `start --worktree`, for an item whose claim was
   * dropped. Mutually exclusive with `prune` (two different reapers; never one
   * item in one run). Reported as `release` + `released`, never as `pruned`.
   */
  release?: string;
  /**
   * Deliberate release of a worktree whose stamped owner is presumed dead
   * (mirrors `start --take-over-worktree`, task-strict-attach-dead-owner-hatch).
   * Default OFF: a fired single-writer detection is then refused, because it is
   * the evidence of a live second writer. Armed, it releases anyway and reports
   * the replaced stamp. Never inferred — only the caller's flag releases.
   */
  releaseTakeOverWorktree?: boolean;
  /**
   * Release identity override (the resolved assignee by default, exactly what
   * `start` stamped). Tests inject a fixed identity; both surfaces pass their
   * own (native: the session id).
   */
  releaseIdentity?: string;
};

/** One completed prune/release action. */
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

/**
 * The release run's outcome (bug-unclaim-leaves-worktree-record-without-reaper):
 * a DISTINCT action family from `pruned`, never mixed into it, so a caller can
 * read "this claim was released" separately from "this finished work was
 * reaped". Present only when a release was requested.
 */
export type CleanupRelease = {
  /** The kernel classification ({ releasable, reason, action, … }). */
  entry: ReleaseEntry;
  /** Actions performed (empty when the release was refused). */
  actions: CleanupAction[];
  /**
   * The cleared-record commit, when the record outlived the removal. Absent when
   * the record lived inside the removed worktree (nothing to write — the whole
   * copy went with it) and when the release was refused.
   */
  commit?: TrackerCommitResult;
};

export type CleanupResult = {
  /** Repo root (parent of the tracker dir; the git cwd). */
  root: string;
  /** Branch merge safety is checked against this ref (e.g. origin/main). */
  base: string;
  /**
   * The tree's convention version, read before the run could remove its own
   * working directory (a release may run from inside the worktree it reaps).
   */
  conventionVersion: number;
  /** Every tracked worktree with its classification. */
  entries: CleanupEntry[];
  /** Actions performed (only with prune: true). */
  pruned: CleanupAction[];
  /** Per-item failures during prune (removal/branch-delete/compose-reap errors). */
  failures: string[];
  /**
   * The release outcome for `opts.release` — a distinct action family from
   * `pruned` (bug-unclaim-leaves-worktree-record-without-reaper). Absent without
   * a release request, so the default listing/prune envelope is unchanged.
   */
  release?: CleanupRelease;
  /**
   * Compose reaping report (ADR 0019 layer 2, task-cleanup-declared-services),
   * present only when the repo's convention declares services
   * (`x-worktree.services` in `.convention.yml`). Absent — and no Docker
   * invocation — when nothing is declared.
   */
  compose?: CleanupComposeReport;
  /** Tracker auto-commit outcome for the cleared worktree_path records (prune only). */
  commit?: TrackerCommitResult;
};

export type CleanupDeps = {
  git?: CleanupGit;
  /** gh executor for the squash-merge fallback; defaults to the real gh CLI. */
  gh?: GhExecutor;
  /** Compose teardown executor; defaults to the real docker CLI (ComposeDown contract). */
  compose?: ComposeDown;
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
 * never leave a stranded remote tip (bug-cleanup-partial-failure). When the
 * repo's convention declares services (`x-worktree.services`, ADR 0019 layer
 * 2), each removable worktree's Compose project is torn down with
 * `docker compose -p <project> down -v --remove-orphans` before the worktree
 * removal; with no declaration (or no docker CLI) cleanup never invokes
 * Docker — report-only by construction. Per-item prune failures (including
 * compose reap failures) are reported and never abort the run. Throws on
 * non-git trees or undetectable default branch (CLI maps to CLEANUP_FAILED).
 */
export function runCleanup(opts: CleanupOptions, deps: CleanupDeps = {}): CleanupResult {
  const gitRunner = deps.git ?? defaultCleanupGit();
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  if (!gitRunner.isRepo(root)) {
    throw new Error(`not a git repository (${root}); arggon cleanup needs git`);
  }
  if (opts.release !== undefined && opts.prune) {
    // Two reapers, one item: a release abandons a claim and prune reaps
    // finished work. Refusing the combination keeps each run's item set
    // single-purpose instead of letting both mutate one worktree.
    throw new Error("pass either --release <id> or --prune, not both");
  }
  if (opts.release === undefined && opts.releaseTakeOverWorktree === true) {
    // The hatch is meaningless without the release it authorizes (m5), and
    // `start` already refuses its twin without `--worktree` (START_FAILED) —
    // so this fails loudly instead of reading the flag once and never using it.
    throw new Error(
      "--take-over-worktree requires --release <id> (it authorizes a release of a worktree whose stamped owner is presumed dead)",
    );
  }
  const base = gitRunner.defaultBranch(root);
  // Captured before any release can remove this run's own working directory.
  const conventionVersionAtStart = readConventionVersion(root);

  const byId = itemsById(loadItems(tasksDir));
  const tracked = [...byId.values()]
    .filter((item) => (item.worktreePath ?? null) !== null)
    .sort((a, b) => a.id.localeCompare(b.id));

  // A release run classifies ONE item (the named one) — the survey path stays
  // out of it entirely, so an abandoned claim's worktree is released on its own
  // evidence and the `candidates` list keeps meaning "prunable work".
  const entries =
    opts.release === undefined
      ? tracked.map((item) =>
          classifyCleanupEntry(item, root, base, gitRunner, { noGh: opts.noGh, gh: deps.gh }),
        )
      : [];

  const pruned: CleanupAction[] = [];
  const failures: string[] = [];
  const clearedPaths: string[] = [];
  const clearedIds: string[] = [];
  // Compose reaping declaration (ADR 0019 layer 2). Read once; a malformed
  // convention file degrades to the report-only path (no declaration): never
  // reaping is always safe, and the tree's convention error is already loudly
  // reported by validate/start — cleanup does not grow a second one.
  let services: string | null = null;
  try {
    services = readConventionConfig(root).worktree.services;
  } catch {
    services = null;
  }
  const compose: CleanupComposeReport | undefined = services ? { declared: services } : undefined;
  let composeUnavailable = false;
  if (opts.prune) {
    for (const entry of entries.filter((e) => e.removable)) {
      // Compose reaping (ADR 0019 layer 2, task-cleanup-declared-services):
      // FIRST, before the worktree removal — the stack that lives only for
      // the run dies with the worktree (exploration 017 F8). Only a repo
      // whose convention declares services ever reaches Docker; everything
      // else stays report-only (the kernel never probes for or invokes
      // Docker the convention didn't declare). The teardown is
      // `docker compose -p <project> down -v --remove-orphans` — no Compose
      // file needed, the project resolves through container labels; on a
      // project that is already gone the same command exits 0 with only a
      // "No resource found to remove" warning (verified live, Docker 29.7.2 /
      // Compose 5.5.1, 2026-10-01), so the already-gone case needs no
      // probing. Failures are non-fatal and land on BOTH surfaces — the
      // structured `pruned` action and the flat `failures` list
      // (bug-cli-cleanup-branch-delete-missing-failure discipline); a failed
      // reap never wedges the worktree removal.
      if (compose && entry.path && !composeUnavailable) {
        // The worktree id is the worktree directory's basename
        // (`<repo>-<item-id>` — the same value `ARGGON_WORKTREE_ID` carries),
        // so the derivation needs no repo-name resolution of its own.
        const project = worktreeComposeProject(compose.declared, basename(entry.path));
        try {
          (deps.compose ?? defaultComposeDown)(project, root);
          pruned.push({ id: entry.id, action: `reaped compose project ${project}` });
        } catch (err) {
          if ((err as NodeJS.ErrnoException | null)?.code === "ENOENT") {
            // Absent docker CLI: report once, degrade the whole run to the
            // report-only path. Not a failure — the ADR's graceful no-op.
            composeUnavailable = true;
            compose.dockerUnavailable = true;
          } else {
            const message = boundedEnvelopeText(
              err instanceof Error ? err.message : String(err),
              MAX_ENVELOPE_DETAIL_CHARS,
            );
            failures.push(`${entry.id}: ${message}`);
            pruned.push({ id: entry.id, action: "failed", error: message });
          }
        }
      }
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
          // The env contract file (spec worktree-env-contract-016) is
          // untracked the same way and blocks `git worktree remove` the same
          // way; only start-created shape (the six documented KEY=value lines)
          // is ever removed here, never an adopter-customized one.
          unlinkWorktreeEnv(entry.path);
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
            // leftover branch explicitly and keep the run going. The failure
            // is reported on BOTH surfaces — the structured `pruned` action
            // AND the flat `failures` list, which would otherwise read as a
            // clean run (bug-cli-cleanup-branch-delete-missing-failure).
            const message = boundedEnvelopeText(
              err instanceof Error ? err.message : String(err),
              MAX_ENVELOPE_DETAIL_CHARS,
            );
            failures.push(`${entry.id}: ${message}`);
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
        // continues and CLEANUP_FAILED is not raised. Same envelope bound
        // as the branch-delete catch above, on BOTH surfaces
        // (bug-cli-cleanup-branch-delete-missing-failure, acceptance box 1).
        const message = boundedEnvelopeText(
          err instanceof Error ? err.message : String(err),
          MAX_ENVELOPE_DETAIL_CHARS,
        );
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
    clearedPaths.length > 0
      ? commitTrackerMutation(root, clearedPaths, {
          message: trackerCommitMessage("pruned", clearedIds),
          commit: resolveAutoCommit(opts.commit, readAutoCommitConfig(root)),
        })
      : undefined;

  // The release path (bug-unclaim-leaves-worktree-record-without-reaper): the
  // inverse of `start --worktree`, for an item whose claim was dropped. It
  // shares the Compose reap and the cleared-record commit with prune and
  // NOTHING else — different premise (an ABANDONED claim, not finished work),
  // different safety (the single-writer gate, never the merge check),
  // different envelope family (`released`, never mixed into `pruned`).
  //
  // It runs AFTER prune's own commit: one run never asks for both, so the
  // release commits its own cleared record as `chore(tasks): released <id>`.
  const release =
    opts.release === undefined
      ? undefined
      : releaseClaimedWorktree({
          id: opts.release,
          root,
          byId,
          gitRunner,
          opts,
          deps,
          compose,
          isComposeUnavailable: () => composeUnavailable,
          failures,
        });

  return {
    root,
    base,
    // Read while the tree is still there: a release can remove the very
    // directory this run was invoked from (the claiming session works INSIDE
    // the worktree it releases), and a post-hoc read would degrade to 0.
    conventionVersion: conventionVersionAtStart,
    entries,
    pruned,
    failures,
    ...(release !== undefined ? { release } : {}),
    ...(compose ? { compose } : {}),
    ...((release?.commit ?? commit) !== undefined ? { commit: (release?.commit ?? commit)! } : {}),
  };
}

/** What the release needs from the run it hangs off. */
type ReleaseRun = {
  id: string;
  root: string;
  byId: Map<string, WorkItem>;
  gitRunner: CleanupGit;
  opts: CleanupOptions;
  deps: CleanupDeps;
  compose: CleanupComposeReport | undefined;
  isComposeUnavailable: () => boolean;
  /** Shared with the run: a refusal or a failed step is a run failure too. */
  failures: string[];
};

/**
 * Release one item's claim footprint (bug-unclaim-leaves-worktree-record-without-reaper) —
 * the inverse of `start --worktree`.
 *
 * Why `update` does not do this: `update` is a frontmatter-only kernel op with
 * no git lifecycle — it is the very call that CLEARS a `worktree_path` record —
 * so it cannot remove a worktree, and destroying a working tree on a status
 * flip would be a data-loss surprise no caller asked for. The contract is
 * therefore split: `update` REPORTS the dropped claim's footprint on the very
 * call that drops it (its `claimFootprint` receipt), and the release — the one
 * destructive operation — is an EXPLICIT command in the worktree domain, gated by
 * the kernel rule both surfaces share (`classifyReleaseEntry`).
 *
 * WHERE the record lives decides the record's fate (a claim made through
 * `start --worktree` is recorded in the WORKTREE copy, so that is where a
 * release normally runs — from the claiming session, inside the worktree it
 * reaps):
 *
 *   - the run's root is the worktree being released → the record's home is the
 *     directory being deleted, so the record is DISPOSED with it: no tracker
 *     write, no commit (nothing would outlive the removal), reported as
 *     `disposed worktree_path record with the worktree`;
 *   - the record lives in a checkout that OUTLIVES the worktree → prune's
 *     order, unchanged: remove, then clear, then commit — so a failed removal
 *     keeps the record that makes the worktree reapable.
 *
 * All git calls run from the canonical (first) worktree, never from a directory
 * this run is about to delete.
 */
function releaseClaimedWorktree(run: ReleaseRun): CleanupRelease {
  const { id, root, byId, gitRunner, opts, failures } = run;
  const actions: CleanupAction[] = [];
  const refuse = (reason: string, entry: ReleaseEntry): CleanupRelease => {
    // A refusal is never a silent no-op: it lands in the action list AND in the
    // flat `failures` (the both-surfaces discipline prune uses for a failed
    // step), so the human path exits non-zero and a `--json` consumer reads it
    // in the payload. Clamped like every sibling failure path (review m9) — the
    // refusals embed paths, and the envelope is a machine surface.
    const message = boundedEnvelopeText(reason, MAX_ENVELOPE_DETAIL_CHARS);
    failures.push(`${id}: ${message}`);
    actions.push({ id, action: "failed", error: message });
    return { entry: { ...entry, reason: message }, actions };
  };
  const item = byId.get(id);
  if (item === undefined) {
    const reason = `id '${id}' not found under the tracker`;
    return refuse(reason, {
      id,
      status: "unknown",
      branch: null,
      path: "",
      releasable: false,
      reason,
      action: null,
    });
  }
  // Identity: the caller passes it explicitly (native: its session id); the CLI
  // resolves the same login `start` stamped, so the ordinary path — the
  // claiming session releasing its own abandoned claim — is never refused.
  const identity = opts.releaseIdentity ?? resolveCurrentLogin() ?? "";
  const entry = classifyReleaseEntry(item, root, gitRunner, {
    identity,
    ...(opts.releaseTakeOverWorktree === true ? { takeOver: true } : {}),
  });
  if (!entry.releasable) {
    return refuse(entry.reason ?? "release refused", entry);
  }
  // Every git call below runs from the canonical (main) worktree: `git worktree
  // list` puts it first, and this run may be invoked from inside the worktree it
  // is about to delete.
  const gitRoot = resolve(gitRunner.worktreeList(root)[0] ?? root);
  // The record outlives the removal exactly when this run's tracker copy is not
  // the worktree being released (the claim made through `start --worktree` is
  // recorded IN that worktree copy, so releasing it disposes the record with the
  // directory — nothing to write, nothing a commit could outlive).
  const recordHome = resolve(root) !== resolve(entry.path);
  // Uncommitted work is never discarded silently. The classification already
  // refused removal-blocking content unless the take-over hatch was armed (the
  // dirty gate, review M2), so reaching here with the hatch armed is exactly
  // the caller's "that owner is dead and that work is disposable" — and it is
  // the only case in which the removal is forced.
  const forceArmed = opts.releaseTakeOverWorktree === true;

  try {
    // Stale-record clause: the worktree is already gone, so the record is the
    // only thing left. No Compose project, no stamp, no branch — nothing the
    // removal does not already own.
    if (entry.action !== "clear stale worktree_path record (path missing on disk)") {
      // Compose first, before the worktree removal (ADR 0019 layer 2,
      // exploration 017 F8): the stack that lives only for the run dies with
      // the worktree. Only a repo whose convention declares services ever
      // reaches Docker, and an absent docker CLI degrades this run to the same
      // report-only path prune uses.
      if (run.compose !== undefined && !run.isComposeUnavailable()) {
        const project = worktreeComposeProject(run.compose.declared, basename(entry.path));
        try {
          (run.deps.compose ?? defaultComposeDown)(project, root);
          actions.push({ id, action: `reaped compose project ${project}` });
        } catch (err) {
          if ((err as NodeJS.ErrnoException | null)?.code !== "ENOENT") throw err;
          run.compose.dockerUnavailable = true;
        }
      }
      // Ownership, not blanket deletion: only a start-created install link (a
      // symlink to the canonical checkout's install) and a start-shaped
      // `.arggon.env` are removed — an adopter's own file is left for git to
      // report. The link's owner is resolved exactly as in prune: when the run
      // happens from a LINKED worktree, the link points at the MAIN checkout.
      unlinkNodeModulesLink(gitRoot, entry.path);
      if (gitRoot !== resolve(root)) unlinkNodeModulesLink(root, entry.path);
      // The env contract is untracked, so it has to go BEFORE the removal or git
      // refuses the worktree — same ownership rule as prune (start-created shape
      // only, never an adopter's own file).
      unlinkWorktreeEnv(entry.path);
      // Did this worktree carry a claim stamp? Read BEFORE the removal, because
      // `git worktree remove` takes the worktree's git dir (and the stamp in it)
      // with it — which is why the post-removal reap below is the one that
      // matters for a DOMAIN removal (it never touches `.git/worktrees/<name>`).
      const hadStamp = readWorktreeClaimStamp(entry.path) !== null;
      gitRunner.removeWorktree(gitRoot, entry.path, { force: forceArmed });
      actions.push({ id, action: `removed worktree ${entry.path}` });
      // AFTER the observed removal, never before (review M2): the claim stamp is
      // the single-writer evidence, and a failed removal must leave it standing
      // — reaping it first stripped a surviving worktree of its ownership
      // record, disarming the gate for every later attempt and losing the F12
      // evidence. Both outcomes are reported, because both are the invariant
      // "no stamp survives a release": either this run removed the file, or the
      // removal took it with the worktree.
      if (unlinkWorktreeClaimStamp(entry.path)) {
        actions.push({ id, action: "reaped arggon-claim.json stamp" });
      } else if (hadStamp) {
        actions.push({ id, action: "arggon-claim.json stamp gone with the worktree" });
      }
      if (entry.branch !== null && gitRunner.branchExists(gitRoot, entry.branch)) {
        // Force, never the safe delete: an abandoned claim's branch is by
        // definition NOT provably merged into the base (that is what prune's
        // eligibility means), and the release is already an explicit,
        // refusal-gated discard of that work.
        gitRunner.deleteBranchForce(gitRoot, entry.branch);
        actions.push({ id, action: `deleted branch ${entry.branch}` });
      }
    }
    if (recordHome) {
      // The record outlives the removal here, so it is cleared AFTER the
      // worktree is observably gone — prune's invariant (a surviving worktree
      // keeps the record that makes it reapable) — and rides one commit.
      runUpdate({ cwd: root, id, worktreePath: "" });
      actions.push({ id, action: "cleared worktree_path" });
      const cleared = commitTrackerMutation(root, [item.filePath], {
        message: trackerCommitMessage("released", [id]),
        commit: resolveAutoCommit(opts.commit, readAutoCommitConfig(root)),
      });
      return { entry, actions, commit: cleared };
    }
    actions.push({ id, action: "disposed worktree_path record with the worktree" });
    return { entry, actions };
  } catch (err) {
    // Per-candidate failure, prune's discipline exactly: reported on both
    // surfaces, never fatal. The record left standing (when it outlives the
    // removal) is what makes the leftover reapable.
    const message = boundedEnvelopeText(
      err instanceof Error ? err.message : String(err),
      MAX_ENVELOPE_DETAIL_CHARS,
    );
    failures.push(`${id}: ${message}`);
    actions.push({ id, action: "failed", error: message });
    return { entry, actions };
  }
}
