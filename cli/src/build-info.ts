import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { arggonVersion } from "./docs.js";
import { packageRoot } from "./package-assets.js";

/**
 * Build identification for `arggon --version` (task-npm-packaging). The
 * package version alone cannot tell two installs apart: `main` and `opencode2`
 * both ship `0.3.0` while the branches move independently, and the sibling
 * side-by-side recipe runs both at once. The version string therefore keeps
 * the semver prefix and appends the build's git sha/branch when one can be
 * determined:
 *
 *   0.3.0 (abc1234, opencode2)   — a git checkout (or an `npm link`ed clone)
 *   0.3.0                        — no git, no baked build metadata
 *
 * Two sources, in order (see loadBuildInfo): a live probe of the package root
 * when it is the top level of a git work tree, else the `dist/build-info.json`
 * baked by the build (`cli/write-build-info.mjs`) for installs that no longer
 * live in a checkout (global prefixes, consumer `node_modules/`). Both are
 * failure-isolated: git missing/hung, a repo with no commits, a corrupt or
 * absent build-info file — every failure just drops the suffix.
 */
export interface BuildInfo {
  version: string;
  sha?: string;
  branch?: string;
  builtAt?: string;
}

/** Git sha/branch only — the identifying half of a build's provenance. */
export type GitIdentity = Pick<BuildInfo, "sha" | "branch">;

/**
 * Run one git plumbing command in `dir`. Array args (never a shell string);
 * stderr is discarded and any failure/timeout returns undefined — the caller
 * must never fail because git is unavailable.
 */
function runGit(args: string[], dir: string): string | undefined {
  try {
    const out = execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    return out === "" ? undefined : out;
  } catch {
    return undefined;
  }
}

/** Real path when it exists, else the resolved path (for the root compare). */
function canonicalPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

/**
 * Live git identity for `dir`, only when `dir` IS the top level of its work
 * tree. The guard matters for installed copies: a package under a consumer
 * repo's `node_modules/` would otherwise report the CONSUMER's sha/branch as
 * its build identity — two different arggon builds in one repo would look
 * identical. A linked checkout (`npm link`, bin symlink to `dist/cli.js`) and
 * a `git worktree` both resolve to their own top level, so they keep working.
 */
export function probeGitBuildInfo(dir: string): GitIdentity | undefined {
  const top = runGit(["rev-parse", "--show-toplevel"], dir);
  if (!top || canonicalPath(top) !== canonicalPath(dir)) return undefined;

  const sha = runGit(["rev-parse", "--short", "HEAD"], dir);
  const head = runGit(["rev-parse", "--abbrev-ref", "HEAD"], dir);
  // A detached HEAD reports the literal "HEAD": sha without a branch.
  const branch = head === "HEAD" ? undefined : head;
  if (!sha && !branch) return undefined;
  return { ...(sha ? { sha } : {}), ...(branch ? { branch } : {}) };
}

/**
 * Build metadata baked into `dist/build-info.json` by the build
 * (`cli/write-build-info.mjs`). Absent/corrupt/empty → undefined.
 */
export function readBakedBuildInfo(root: string): GitIdentity | undefined {
  try {
    const parsed = JSON.parse(
      readFileSync(resolve(root, "dist", "build-info.json"), "utf8"),
    ) as Partial<BuildInfo>;
    const sha = typeof parsed.sha === "string" && parsed.sha !== "" ? parsed.sha : undefined;
    const branch =
      typeof parsed.branch === "string" && parsed.branch !== "" ? parsed.branch : undefined;
    if (!sha && !branch) return undefined;
    return { ...(sha ? { sha } : {}), ...(branch ? { branch } : {}) };
  } catch {
    return undefined;
  }
}

/**
 * Render the `--version` line: the semver prefix is always first and intact,
 * the identity (when known) rides in parentheses. Live-probe values are
 * git-validated (hex sha, ref-format branch name — no whitespace or control
 * characters); the baked fallback below only filters empty fields and trusts
 * the build-time writer, so it is build output, not a validation boundary. An
 * unknown identity renders the bare version, never an empty `()`.
 */
export function formatBuildVersion(version: string, info: GitIdentity | undefined): string {
  const parts = [info?.sha, info?.branch].filter((p): p is string => Boolean(p));
  return parts.length === 0 ? version : `${version} (${parts.join(", ")})`;
}

/**
 * The full `--version` string. Live git wins over the baked file: when run
 * from a checkout, the checkout IS the build (and a stale `dist/` should be
 * rebuilt with the code it runs), while installed copies have no work tree and
 * fall back to what the build recorded.
 */
export function buildVersion(root: string = packageRoot()): string {
  return formatBuildVersion(arggonVersion(), probeGitBuildInfo(root) ?? readBakedBuildInfo(root));
}
