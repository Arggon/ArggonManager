import { execFileSync, ExecFileSyncOptions } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

/** Result of detecting a GitHub repo from a local git repository. */
export type DetectedRepo = {
  owner: string;
  repo: string;
};

/** GitHub remote URL patterns we accept. */
const GITHUB_REMOTE_RE = /github\.com[:\/]([^/]+)\/([^/]+?)(\.git)?$/;

/** Signature for git executors used in detectRepo and getOpenPRs. */
export type GitExecutor = (file: string, args: string[], options?: ExecFileSyncOptions) => string;

/** Default executor for git commands (used when no custom executor provided). */
function defaultExecGit(file: string, args: string[], options?: ExecFileSyncOptions): string {
  const opts: ExecFileSyncOptions = options ?? {};
  return execFileSync(file, args, {
    cwd: opts.cwd ?? process.cwd(),
    encoding: opts.encoding ?? "utf8",
    stdio: opts.stdio ?? ["ignore", "pipe", "ignore"],
    timeout: opts.timeout ?? 10_000,
  }) as string;
}

/**
 * Detect the GitHub owner/repo from the local git repository at or above `cwd`.
 *
 * Returns null when:
 * - `cwd` is not inside a git repository (no `.git` found upward)
 * - the origin remote is not a GitHub URL
 * - the remote URL cannot be parsed
 *
 * Throws on unexpected git errors (e.g. git not installed).
 *
 * @param cwd - Directory to search for a git repository
 * @param execGit - Optional custom git executor for testing
 */
export function detectRepo(
  cwd: string,
  execGit: GitExecutor = defaultExecGit
): DetectedRepo | null {
  const repoRoot = findRepoRoot(cwd);
  if (!repoRoot) return null;

  const origin = getOriginRemote(repoRoot, execGit);
  if (!origin) return null;

  const match = GITHUB_REMOTE_RE.exec(origin);
  if (!match) return null;

  const [, owner, repo] = match;
  return { owner, repo };
}

/** Find the git repository root for a path, or null if not in a git repo. */
function findRepoRoot(cwd: string): string | null {
  let dir = isAbsolute(cwd) ? cwd : process.cwd();
  while (dir) {
    try {
      statSync(join(dir, ".git"));
      return dir;
    } catch {
      // no .git here, go up
    }
    const parent = dirname(dir);
    if (parent === dir) break; // hit filesystem root
    dir = parent;
  }
  return null;
}

/** Read the `origin` remote URL from a git repository. Returns null if no origin. */
function getOriginRemote(
  repoRoot: string,
  execGit: GitExecutor
): string | null {
  try {
    const url = execGit("git", ["remote", "get-url", "origin"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
    });
    return url.trim() || null;
  } catch {
    return null;
  }
}
