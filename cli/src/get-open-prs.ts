import { execFileSync, ExecFileSyncOptions } from "node:child_process";
import { detectRepo, type DetectedRepo } from "./detect-repo.js";
import type { PRInfo } from "./sync-types.js";

/** Signature for git executors used in getOpenPRs detection. */
type GitExecutor = (file: string, args: string[], options?: ExecFileSyncOptions) => string;

/** Default git executor bound for use as a default value in getOpenPRs. */
const defaultExecGit: GitExecutor = (file: string, args: string[], options?: ExecFileSyncOptions) =>
  execFileSync(file, args, options) as string;

/** Retrieve open PRs for a GitHub repository. */
export function getOpenPRs(
  repo: string | null,
  cwd: string,
  execGh: typeof execFileSync = execFileSync,
  execGit: GitExecutor = defaultExecGit
): PRInfo[] {
  const detected: DetectedRepo | null = repo
    ? { owner: repo.split("/")[0]!, repo: repo.split("/")[1]! }
    : detectRepo(cwd, execGit);

  if (!detected) {
    throw new Error("Cannot determine GitHub repository. Pass --repo or ensure origin is a GitHub remote.");
  }

  return getOpenPRsForRepo(detected.owner, detected.repo, execGh);
}

/** Get open PRs for a specific GitHub repository. Exported for testing. */
export function getOpenPRsForRepo(
  owner: string,
  repo: string,
  execGh: typeof execFileSync
): PRInfo[] {
  try {
    const json = execGh(
      "gh",
      [
        "pr",
        "list",
        "--repo",
        `${owner}/${repo}`,
        "--json",
        "number,title,headRefName,url",
        "--state",
        "open",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 30_000,
      }
    );

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
  } catch {
    try {
      const json = execGh(
        "gh",
        ["api", `repos/${owner}/${repo}/pulls?state=open&per_page=100`],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 30_000,
        }
      );

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
