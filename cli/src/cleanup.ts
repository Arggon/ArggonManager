import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";
import {
  classifyCleanupEntry,
  commitTrackerMutation,
  defaultCleanupGit,
  findTasksDir,
  itemsById,
  loadItems,
  readAutoCommitConfig,
  readConventionConfig,
  repoRootFromTasks,
  resolveAutoCommit,
  runUpdate,
  trackerCommitMessage,
  worktreeComposeProject,
  type CleanupEntry,
  type CleanupGit,
  type GhExecutor,
  type TrackerCommitResult,
} from "@arggondev/lib";

import { unlinkNodeModulesLink, unlinkWorktreeEnv } from "./start.js";

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
    execFileSync(
      "docker",
      ["compose", "-p", project, "down", "-v", "--remove-orphans"],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: COMPOSE_DOWN_TIMEOUT_MS,
      },
    );
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
  /** Per-item failures during prune (removal/branch-delete/compose-reap errors). */
  failures: string[];
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
  const compose: CleanupComposeReport | undefined = services
    ? { declared: services }
    : undefined;
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
    opts.prune && clearedPaths.length > 0
      ? commitTrackerMutation(root, clearedPaths, {
          message: trackerCommitMessage("pruned", clearedIds),
          commit: resolveAutoCommit(opts.commit, readAutoCommitConfig(root)),
        })
      : undefined;

  return { root, base, entries, pruned, failures, ...(compose ? { compose } : {}), commit };
}
