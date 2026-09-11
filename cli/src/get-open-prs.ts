import { execFileSync, ExecFileSyncOptions } from "node:child_process";
import { detectRepo, type DetectedRepo } from "./detect-repo.js";
import type { PRInfo } from "./sync-types.js";

/** Signature for git executors used in getOpenPRs detection. */
type GitExecutor = (file: string, args: string[], options?: ExecFileSyncOptions) => string;

/** Default git executor bound for use as a default value in getOpenPRs. */
const defaultExecGit: GitExecutor = (file: string, args: string[], options?: ExecFileSyncOptions) =>
  execFileSync(file, args, options) as string;

/** Parse and validate an explicit `owner/name` repo slug. Throws an actionable error. */
export function parseRepoSlug(slug: string): { owner: string; repo: string } {
  const parts = slug.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1] || /\s/.test(slug)) {
    throw new Error(
      `Invalid --repo "${slug}": expected "owner/name" (e.g. --repo octocat/hello-world)`,
    );
  }
  return { owner: parts[0], repo: parts[1] };
}

export type GhPrListOptions = {
  /** Extra fields for `--json` (comma-separated, e.g. "number,title,headRefName,url"). */
  fields: string;
  /** `owner/name` slug for `--repo`; omit to use gh's own repo resolution from cwd. */
  repo?: string;
  /** Working directory for gh; omit to inherit the process cwd. */
  cwd?: string;
  limit?: number;
  execGh?: typeof execFileSync;
};

/**
 * Shared `gh pr list` invocation — the one place that owns the limit/JSON
 * contract for every reader (sync, board). Throws a plain technical error;
 * callers add their UX context (overlay hint, sync fallback, ...).
 */
export function ghPrListJson(opts: GhPrListOptions): unknown[] {
  const execGh = opts.execGh ?? execFileSync;
  const args = ["pr", "list", "--limit", String(opts.limit ?? 100), "--json", opts.fields];
  if (opts.repo) args.push("--repo", opts.repo);
  let out: string;
  try {
    const runOpts: {
      encoding: "utf8";
      stdio: ["ignore", "pipe", "ignore"];
      timeout: number;
      cwd?: string;
    } = {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 30_000,
    };
    if (opts.cwd !== undefined) runOpts.cwd = opts.cwd;
    out = execGh("gh", args, runOpts) as string;
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
    return data;
  } catch {
    throw new Error("gh pr list returned unparseable JSON (check `gh auth status`)");
  }
}

/** Retrieve open PRs for a GitHub repository. */
export function getOpenPRs(
  repo: string | null,
  cwd: string,
  execGh: typeof execFileSync = execFileSync,
  execGit: GitExecutor = defaultExecGit,
): PRInfo[] {
  const detected: DetectedRepo | null = repo ? parseRepoSlug(repo) : detectRepo(cwd, execGit);

  if (!detected) {
    throw new Error(
      "Cannot determine GitHub repository. Pass --repo or ensure origin is a GitHub remote.",
    );
  }

  return getOpenPRsForRepo(detected.owner, detected.repo, execGh);
}

/** Get open PRs for a specific GitHub repository. Exported for testing. */
export function getOpenPRsForRepo(
  owner: string,
  repo: string,
  execGh: typeof execFileSync,
): PRInfo[] {
  try {
    const data = ghPrListJson({
      repo: `${owner}/${repo}`,
      fields: "number,title,headRefName,url",
      execGh,
    }) as Array<{
      number: number;
      title: string;
      headRefName: string;
      url: string;
    }>;

    return data.map((pr) => ({
      number: pr.number,
      headRefName: pr.headRefName,
      title: pr.title,
      url: pr.url,
    }));
  } catch {
    try {
      const json = execGh("gh", ["api", `repos/${owner}/${repo}/pulls?state=open&per_page=100`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 30_000,
      });

      const data = JSON.parse(json) as Array<{
        number: number;
        title: string;
        headRefName: string;
        url: string;
      }>;

      return data.map((pr) => ({
        number: pr.number,
        headRefName: pr.headRefName,
        title: pr.title,
        url: pr.url,
      }));
    } catch (apiError) {
      throw new Error(`GitHub API error: ${(apiError as Error).message}`);
    }
  }
}
