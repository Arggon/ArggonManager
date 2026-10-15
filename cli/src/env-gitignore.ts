import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Report-only probe of the tracked `.gitignore`'s `.arggon.env` entry
 * (task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters,
 * spec worktree-env-contract-016).
 *
 * `arggon start --worktree` writes a per-worktree `.arggon.env` (identity +
 * state/cache dirs) at every worktree root. `arggon init` generates a
 * `.gitignore` that ignores it, but an adopter repo that already carried its
 * own `.gitignore` keeps it untouched — the file is adopter-owned
 * (modified-skip, never rewritten) — so the entry can stay missing forever and
 * the machine file can be committed by accident. This module answers the only
 * question the report needs: does the repo's own `.gitignore` ignore
 * `.arggon.env`?
 *
 * The file's OWN bytes are the source of truth: the probe deliberately does not
 * ask `git check-ignore`, because a machine-local or global exclude would hide
 * the missing entry from every other clone — the exact adopter failure this
 * hint exists for. Pure read: no file is ever written, modified or staged.
 */

/**
 * The exact line the adopter hand-step appends (spec worktree-env-contract-016,
 * §The env file — Gitignore probe).
 */
export const ARGON_ENV_IGNORE_LINE = ".arggon.env";

/**
 * Report-only remediation text: names the contract that explains the entry and
 * the exact line to append. Constant, so the three surfaces (init/adopt/doctor)
 * cannot drift apart about what they ask the adopter to do.
 */
export const ENV_GITIGNORE_HINT =
  "the tracked .gitignore does not ignore .arggon.env — append the line " +
  "`.arggon.env` (spec worktree-env-contract-016: per-worktree machine state " +
  "written by `arggon start --worktree`; never commit it). Report-only: arggon " +
  "does not edit your .gitignore";

/**
 * Anchored gitignore patterns that ignore the per-worktree env file: the bare
 * name, a root-anchored form, and a double-star-prefixed form (git trims
 * surrounding whitespace; the caller trims too).
 */
const ARGON_ENV_IGNORE_PATTERN = /^(?:\*\*\/|\/)?\.arggon\.env$/;

/** One `.gitignore` probe result, additive on every surface that reports it. */
export type EnvGitignoreReport = {
  /** `.gitignore` path (posix, relative to the probed root). */
  path: string;
  /** The file exists on disk. */
  present: boolean;
  /**
   * A pattern line ignores `.arggon.env` — evaluated in file order, so a later
   * `!.arggon.env` negation correctly un-ignores it. Always false when the file
   * is absent.
   */
  ignores: boolean;
  /**
   * The report-only remediation text, non-null EXACTLY when the file exists and
   * does not ignore `.arggon.env`; null when there is nothing to report (entry
   * present, or no `.gitignore` at all — a fresh `init` generates one that
   * carries the entry).
   */
  hint: string | null;
};

/** Does one gitignore line ignore `.arggon.env` (ignoring comments/negations)? */
function ignoresArgonEnv(line: string): boolean {
  const pattern = line.trim();
  // Comments are not patterns; a negation is an explicit un-ignore.
  if (pattern === "" || pattern.startsWith("#") || pattern.startsWith("!")) return false;
  return ARGON_ENV_IGNORE_PATTERN.test(pattern);
}

/** Is the line an explicit `!.arggon.env` un-ignore? */
function negatesArgonEnv(line: string): boolean {
  const pattern = line.trim();
  if (!pattern.startsWith("!")) return false;
  return ARGON_ENV_IGNORE_PATTERN.test(pattern.slice(1).trim());
}

/**
 * Read `<root>/.gitignore` and report whether it ignores `.arggon.env`.
 * Pure read; never throws (an unreadable file is reported as absent).
 */
export function readEnvGitignore(root: string): EnvGitignoreReport {
  const path = ".gitignore";
  let raw: string;
  try {
    raw = readFileSync(join(root, path), "utf8");
  } catch {
    return { path, present: false, ignores: false, hint: null };
  }
  // File order matters, exactly as git evaluates it: a later `!.arggon.env`
  // negation un-ignores a previous entry.
  let ignores = false;
  for (const line of raw.split(/\r?\n/)) {
    if (ignoresArgonEnv(line)) ignores = true;
    else if (negatesArgonEnv(line)) ignores = false;
  }
  return {
    path,
    present: true,
    ignores,
    hint: ignores ? null : ENV_GITIGNORE_HINT,
  };
}
