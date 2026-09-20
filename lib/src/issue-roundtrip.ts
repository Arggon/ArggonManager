import { execFileSync, ExecFileSyncOptions } from "node:child_process";
import { detectRepo } from "./detect-repo.js";

/**
 * Issue round-trip (task-issue-roundtrip): when an item carrying the additive
 * `issue` frontmatter field (written by `import-issues`) flips to `done`, the
 * linked GitHub issue is closed with an annotation comment via `gh`. Opt-in,
 * gated tree-wide by `tasks/.convention.yml` `x-github.issue-roundtrip: true`
 * (default OFF) — done flips happen through bots and MCP flows too, so a
 * config gate covers every path a per-call flag would miss.
 *
 * Same best-effort contract as the tracker auto-commit (tracker-commit.ts):
 * this NEVER throws and NEVER blocks the done flip. gh absent, unauthenticated,
 * a non-GitHub origin, or a failed close all degrade to a reported skip; the
 * caller surfaces it in the payload / as a stderr warning.
 */

/** The round-trip outcome as it appears in the additive `issueRoundtrip` field of `--json` payloads. */
export type IssueRoundtripResult =
  | { closed: true; issue: number; repo: string }
  | { closed: false; issue: number; skipped: string };

/** Annotation posted on the closed issue: names the tracker item that resolved it. */
export function roundtripComment(itemId: string): string {
  return `Resolved via tracker item \`${itemId}\` (arggon tracker; item flipped to done).`;
}

/**
 * Close GitHub issue `issue` in the repo detected from `root`'s origin remote,
 * with `roundtripComment(itemId)` as the closing comment. Never throws — every
 * failure mode returns `{ closed: false, skipped }` so the done flip succeeds
 * regardless.
 */
export function closeLinkedIssue(
  root: string,
  itemId: string,
  issue: number,
  execGh: typeof execFileSync = execFileSync,
): IssueRoundtripResult {
  const repo = detectRepo(root);
  if (!repo) {
    return {
      closed: false,
      issue,
      skipped: "github repo not detected (origin is missing or not a GitHub remote)",
    };
  }
  const slug = `${repo.owner}/${repo.repo}`;
  const opts: ExecFileSyncOptions = {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 30_000,
  };
  try {
    execGh(
      "gh",
      ["issue", "close", String(issue), "--repo", slug, "--comment", roundtripComment(itemId)],
      opts,
    );
  } catch (err) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err.code === "ENOENT" || err.code === -2)
    ) {
      return { closed: false, issue, skipped: "gh not found (install gh and run `gh auth login`)" };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { closed: false, issue, skipped: `gh issue close failed (${message})` };
  }
  return { closed: true, issue, repo: slug };
}
