import { execFileSync } from "node:child_process";
import { readConventionConfig } from "./convention.js";

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
 *    the whole CLI already works without git.
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
};

/** Verbs of the `chore(tasks): <verb> <id>` message convention. */
export type TrackerCommitVerb = "created" | "commented" | "adopted" | "pruned";

/** `chore(tasks): <verb> <item-id>` (comma-joined ids when a commit covers several). */
export function trackerCommitMessage(verb: TrackerCommitVerb, ids: string[]): string {
  return `chore(tasks): ${verb} ${ids.join(", ")}`;
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

type GitRun = { code: number; out: string; err: string; missing: boolean };

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
 * Commit tracker mutations: stage ONLY the given absolute file paths (all
 * resolved inside tasks/), then create one commit with `message`. Never
 * throws — every failure mode (non-git tree, git absent, nothing staged,
 * failed commit) returns a skip result so the caller's command succeeds.
 * The user's pre-existing dirty files are never swept into the commit.
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

  const add = runGit(["add", "--", ...paths], root);
  if (add.code !== 0) {
    return { committed: false, skipReason: `git add failed: ${firstLine(add.err || add.out)}` };
  }
  const commit = runGit(["commit", "-m", opts.message], root);
  if (commit.code !== 0) {
    const detail = `${commit.out}\n${commit.err}`;
    if (/nothing to commit|nothing added/.test(detail)) {
      return { committed: false, skipReason: "nothing to commit" };
    }
    return {
      committed: false,
      skipReason: `git commit failed: ${firstLine(commit.err || commit.out)}`,
    };
  }
  const hash = runGit(["rev-parse", "--short", "HEAD"], root);
  return {
    committed: true,
    hash: hash.code === 0 && hash.out.trim() ? hash.out.trim() : "(unknown)",
    message: opts.message,
  };
}

/** Map a kernel result to the `commit` payload field (undefined when absent). */
export function commitPayload(result: TrackerCommitResult | undefined): CommitPayload | undefined {
  if (!result) return undefined;
  if (result.committed && result.hash) {
    return { hash: result.hash, message: result.message ?? "" };
  }
  return { skipped: result.skipReason ?? "skipped" };
}

/** One human output line for the commit outcome (null when there is nothing to report). */
export function formatCommitLine(result: TrackerCommitResult | undefined): string | null {
  if (!result) return null;
  if (result.committed) return `committed: ${result.hash} ${result.message}`;
  if (result.skipReason === "auto-commit disabled") return "no-commit: tasks dirty state kept";
  return `no-commit: ${result.skipReason}`;
}
