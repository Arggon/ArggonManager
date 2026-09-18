import { execFileSync } from "node:child_process";
import { readConventionConfig } from "./convention.js";
import { withItemLock } from "./lock.js";
import { join, resolve } from "node:path";
import { sanitizeHumanError } from "./sanitize.js";

/**
 * Tracker hygiene (story-tracker-hygiene, task-auto-commit-tracker): tracker
 * mutations commit their own changes so `tasks/` never sits dirty after a
 * tool-driven edit — pre-existing dirty state would block `start`'s
 * clean-tree precondition and force a manual commit dance.
 *
 * Guardrails:
 *  - Staging is surgical: `git add -- <path>` for the mutated files only —
 *    never `git add -A` / `git add .`. The user's own pre-existing dirty
 *    files stay dirty (untracked by the tool's commit).
   *  - Best effort by design: non-git trees, missing git, or a no-op commit
   *    (nothing staged) skip with a reason instead of failing the command —
   *    the whole CLI already works without git. Exception (task-nothing-to-
   *    commit-masking): a "nothing to commit" whose mutated paths still carry
   *    changes means a concurrent index rewrite lost our staged entry — that
   *    skip is REPORTED (stderr warning + payload), never quiet.
 *  - Default ON, opt-out per invocation (`--no-commit`) and per tree
 *    (`tasks/.convention.yml` `x-tracker.auto-commit: false`, namespaced
 *    like `x-playbooks`); precedence is CLI flag > config > built-in
 *    default (true).
 */

/** The commit result as it appears in the additive `commit` field of `--json` payloads. */
export type CommitPayload = { hash: string; message: string } | { skipped: string };

export type TrackerCommitResult = {
  committed: boolean;
  /** Why nothing was committed; present only when `committed` is false. */
  skipReason?: string;
  /** Short hash of the created commit; present only when `committed` is true. */
  hash?: string;
  /** Commit message as recorded; present only when `committed` is true. */
  message?: string;
};

export type TrackerCommitOptions = {
  /** Commit message (`chore(tasks): <verb> <item-id>`; see trackerCommitMessage). */
  message: string;
  /**
   * Already resolved against config by the caller (`resolveAutoCommit`).
   * `false` skips without touching git.
   */
  commit?: boolean;
  /**
   * Wall-clock retry budget under index.lock contention. Default 10s
   * (lock.ts's LOCK_TIMEOUT_MS); tests inject a small value to exercise the
   * skip path quickly.
   */
  commitRetryTimeoutMs?: number;
};

/** Verbs of the `chore(tasks): <verb> <id>` message convention. */
export type TrackerCommitVerb =
  | "created"
  | "commented"
  | "adopted"
  | "pruned"
  | "done"
  | "updated"
  | "claimed"
  | "imported"
  /** init bootstrap (bug-init-leaves-docs-untracked): the generated doc set. */
  | "generated";

/** `chore(tasks): <verb> <item-id>` (comma-joined ids when a commit covers several). */
export function trackerCommitMessage(verb: TrackerCommitVerb, ids: string[]): string {
  return `chore(tasks): ${verb} ${ids.join(", ")}`;
}

/**
 * Message for an `update`-driven commit: `chore(tasks): <verb> <id>`, with a
 * ` (cascade: <ids>)` suffix when the container auto-completion fired in the
 * same run (task-autocommit-update-import) — the cascade-mutated ancestors
 * ride in the same commit, so the message names them.
 */
export function updateCommitMessage(verb: TrackerCommitVerb, id: string, cascadeIds: string[]): string {
  const base = trackerCommitMessage(verb, [id]);
  return cascadeIds.length > 0 ? `${base} (cascade: ${cascadeIds.join(", ")})` : base;
}

/**
 * Precedence for the auto-commit decision: CLI flag wins over config, config
 * wins over the built-in default (true). `flag` is the `--no-commit` request
 * (`false`) or an explicit opt-in (`true`); `undefined` defers to config.
 */
export function resolveAutoCommit(flag: boolean | undefined, configValue: boolean | null): boolean {
  if (flag !== undefined) return flag;
  if (configValue !== null) return configValue;
  return true;
}

/**
 * Tolerant read of `x-tracker.auto-commit` for the tree: `null` when the file
 * is missing, the key unset, or the config malformed (malformed config must
 * never fail a mutation — it falls back to the built-in default).
 */
export function readAutoCommitConfig(root: string): boolean | null {
  try {
    return readConventionConfig(root).tracker.autoCommit;
  } catch {
    return null;
  }
}

/**
 * index.lock contention (bug-autocommit-silent-skip): concurrent tracker
 * mutations race git's `index.lock`, so `add`/`commit` are retried within a
 * wall-clock budget (lock.ts retry cadence) instead of skipping silently.
 * A skip that survives the whole budget is still reported — in the JSON
 * payload (`{ skipped: "git index locked" }`) AND as a stderr warning —
 * never silent.
 */
/** Contending waits up to this long before giving up (actionable skip). */
export const COMMIT_RETRY_TIMEOUT_MS = 10_000;
/** Sleep before retry N (N starts at 1), capped so the budget is time-bounded. */
export const COMMIT_RETRY_MS = 75;
const COMMIT_RETRY_MAX_SLEEP_MS = 1_000;

/** Synchronous sleep (the commit path is a single-threaded sequence of git runs). */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

type GitRun = { code: number; out: string; err: string; missing: boolean };

/** True when a git failure is `index.lock` contention (worth retrying), not a real error. */
function isIndexLockContention(run: GitRun): boolean {
  return /index\.lock/.test(run.err) || /index\.lock/.test(run.out);
}

/**
 * Never-silent guarantee: git-failure skips (including an index.lock race lost
 * past every retry) warn on stderr in addition to the JSON `commit.skipped`
 * payload. Benign skips (`--no-commit`, nothing to commit, non-git tree) stay
 * quiet — they are the documented default behavior, not a lost mutation.
 *
 * bug-validate-stdout-injection L2: the dynamic part is git's own output
 * (`firstLine` of stderr/stdout), which can quote a repo-controlled path, so
 * the warning is display-sanitized. It uses the composite-diagnostic cap
 * (2000) like the CLI failure channel — a git first line routinely carries a
 * path, which the 200-char report cap could cut. The regex gate runs on the
 * raw reason (the prefix is static); the payload keeps the raw text.
 */
function warnGitSkip(skipReason: string): void {
  if (/^git (add|commit) failed|^git index locked|staged entry lost/.test(skipReason)) {
    process.stderr.write(
      `arggon: warning: commit skipped: ${sanitizeHumanError(skipReason)}\n`,
    );
  }
}

function runGit(args: string[], cwd: string): GitRun {
  try {
    const out = execFileSync("git", args, {
      encoding: "utf8",
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out: String(out ?? ""), err: "", missing: false };
  } catch (err) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err.code === "ENOENT" || err.code === -2)
    ) {
      return { code: -1, out: "", err: "", missing: true };
    }
    const e = err as { status?: number | null; stdout?: unknown; stderr?: unknown };
    return {
      code: typeof e.status === "number" ? e.status : 1,
      out: String(e.stdout ?? ""),
      err: String(e.stderr ?? ""),
      missing: false,
    };
  }
}

function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "git failed";
}

/**
 * Absolute path of the repo's shared .git directory (the "common dir"), so
 * every checkout AND every linked worktree of the same repo key the same
 * git-mutation lock. `--path-format=absolute` needs git >= 2.31; on older git
 * the raw `--git-common-dir` output is resolved against `root`. Returns null
 * when git cannot answer (best effort: the commit then runs unlocked and
 * falls back to the inner index.lock retry alone).
 */
export function resolveCommonGitDir(root: string): string | null {
  const abs = runGit(["rev-parse", "--path-format=absolute", "--git-common-dir"], root);
  if (abs.code === 0 && abs.out.trim().length > 0) return abs.out.trim();
  const rel = runGit(["rev-parse", "--git-common-dir"], root);
  if (rel.code === 0 && rel.out.trim().length > 0) return resolve(root, rel.out.trim());
  return null;
}

/**
 * Lock KEY for the add+commit sequence, derived from the repo's common dir.
 * Pass to withItemLock (which hashes it to its tmpdir lock file); tests hold
 * the same lock via lockFilePathFor(trackerGitLockKey(dir)).
 */
export function trackerGitLockKey(commonGitDir: string): string {
  return join(commonGitDir, "arggon-tracker-git.lock");
}

/**
 * Commit tracker mutations: stage ONLY the given absolute file paths (all
 * resolved inside tasks/), then create one commit with `message` containing
 * exactly those paths (`commit --only`). Never throws — every failure mode
 * (non-git tree, git absent, nothing staged, failed commit) returns a skip
 * result so the caller's command succeeds. The user's pre-existing dirty
 * files (and anything staged elsewhere) are never swept into the commit.
 *
 * bug-torture-contention-flake3: the whole add+commit sequence runs under a
 * repo-level git-mutation lock (tmpdir lock keyed on the repo's shared .git
 * common dir), so concurrent arggon processes cannot interleave their index
 * updates — the shared-index clobber that produced "nothing to commit" with
 * a still-dirty file is structurally impossible between arggon writers.
 */
export function commitTrackerMutation(
  root: string,
  filePaths: string[],
  opts: TrackerCommitOptions,
): TrackerCommitResult {
  if (opts.commit === false) {
    return { committed: false, skipReason: "auto-commit disabled" };
  }
  const paths = [...new Set(filePaths.filter((p) => p.length > 0))];
  if (paths.length === 0) {
    return { committed: false, skipReason: "no mutated files" };
  }
  const probe = runGit(["rev-parse", "--git-dir"], root);
  if (probe.missing) return { committed: false, skipReason: "git not found" };
  if (probe.code !== 0) return { committed: false, skipReason: "not a git repository" };

  // add+commit under the repo-level git-mutation lock (bug-torture-contention-
  // flake3): all arggon processes mutating ONE repo serialize on a single
  // tmpdir lock keyed by the repo's shared .git common dir (worktrees
  // included), so the index-clobber race — another process's commit rewriting
  // the index between our `add` and our `commit`, dropping our staged entry
  // ("nothing to commit" with the file still dirty) — cannot happen between
  // arggon writers at all. Inside the lock the original wall-clock-bounded
  // index.lock retry remains as belt-and-suspenders for NON-arggon git
  // writers (IDEs, scripts) that hold index.lock but not our lock. A lock
  // timeout or an exhausted retry is a REPORTED skip, never silent.
  const budget = opts.commitRetryTimeoutMs ?? COMMIT_RETRY_TIMEOUT_MS;
  const commonGitDir = resolveCommonGitDir(root);
  let result: TrackerCommitResult | undefined;  const attempt = (): void => {
    const deadline = Date.now() + budget;
    let locked: string | null = null;
    let add: GitRun | undefined;
    let commit: GitRun | undefined;
    for (let attempt = 1; ; attempt++) {
      if (attempt > 1) sleepSync(Math.min(COMMIT_RETRY_MS * (attempt - 1), COMMIT_RETRY_MAX_SLEEP_MS));
      add = runGit(["add", "--", ...paths], root);
      if (add.code !== 0) {
        if (isIndexLockContention(add)) {
          locked = "git index locked";
          if (Date.now() >= deadline) break;
          continue;
        }
        warnGitSkip(`git add failed: ${firstLine(add.err || add.out)}`);
        result = { committed: false, skipReason: `git add failed: ${firstLine(add.err || add.out)}` };
        return;
      }
      commit = runGit(["commit", "-m", opts.message], root);
      if (commit.code !== 0) {
        const detail = `${commit.out}\n${commit.err}`;
        if (/nothing to commit|nothing added/.test(detail)) {
          // task-nothing-to-commit-masking: "nothing to commit" is benign only
          // when someone else already committed the same content (paths clean).
          // Under concurrent commits it can also mean another process's index
          // rewrite clobbered our staged entry between `add` and `commit` — the
          // mutation then sits written-but-uncommitted while git claims there is
          // nothing to do. Residue in the mutated paths = our entry was lost →
          // a REPORTED skip (warning + payload), never the quiet benign path.
          const residue = runGit(["status", "--porcelain", "--", ...paths], root);
          if (residue.code === 0 && residue.out.trim().length > 0) {
            const lost = "nothing to commit (staged entry lost under contention)";
            warnGitSkip(lost);
            result = { committed: false, skipReason: lost };
            return;
          }
          result = { committed: false, skipReason: "nothing to commit" };
          return;
        }
        if (isIndexLockContention(commit)) {
          locked = "git index locked";
          if (Date.now() >= deadline) break;
          continue;
        }
        warnGitSkip(`git commit failed: ${firstLine(commit.err || commit.out)}`);
        result = {
          committed: false,
          skipReason: `git commit failed: ${firstLine(commit.err || commit.out)}`,
        };
        return;
      }
      locked = null;
      break;
    }
    if (locked !== null || commit === undefined) {
      warnGitSkip(locked ?? "git commit failed");
      result = { committed: false, skipReason: locked ?? "git commit failed" };
      return;
    }
    if (commit.code !== 0) {
      // Unreachable in practice (non-contention failures return above); kept as
      // a guard so the success path below only sees a successful commit.
      warnGitSkip(`git commit failed: ${firstLine(commit.err || commit.out)}`);
      result = {
        committed: false,
        skipReason: `git commit failed: ${firstLine(commit.err || commit.out)}`,
      };
      return;
    }
    const hash = runGit(["rev-parse", "--short", "HEAD"], root);
    result = {
      committed: true,
      hash: hash.code === 0 && hash.out.trim() ? hash.out.trim() : "(unknown)",
      message: opts.message,
    };
  };
  if (commonGitDir !== null) {
    try {
      withItemLock(trackerGitLockKey(commonGitDir), attempt, { timeoutMs: budget });
    } catch {
      // The outer lock timed out (another arggon process held the git-mutation
      // lock past the budget): same reported-skip semantics as index.lock.
      warnGitSkip("git index locked");
      result = { committed: false, skipReason: "git index locked" };
    }
  } else {
    attempt();
  }
  return result ?? { committed: false, skipReason: "git commit failed" };
}

/** Map a kernel result to the `commit` payload field (undefined when absent). */
export function commitPayload(result: TrackerCommitResult | undefined): CommitPayload | undefined {
  if (!result) return undefined;
  if (result.committed && result.hash) {
    return { hash: result.hash, message: result.message ?? "" };
  }
  return { skipped: result.skipReason ?? "skipped" };
}

/**
 * One human output line for the commit outcome (null when there is nothing to
 * report). bug-validate-stdout-injection L2: the skip reason can embed git's
 * own output (hostile path), and the success message embeds tracker ids — both
 * are display-sanitized here; `commitPayload` keeps the raw values for `--json`.
 */
export function formatCommitLine(result: TrackerCommitResult | undefined): string | null {
  if (!result) return null;
  if (result.committed) return sanitizeHumanError(`committed: ${result.hash} ${result.message}`);
  if (result.skipReason === "auto-commit disabled") return "no-commit: tasks dirty state kept";
  return sanitizeHumanError(`no-commit: ${result.skipReason}`);
}
