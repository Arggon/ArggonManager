import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { findBranchClaims } from "./branch-claims.js";
import { loadItems } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { getOpenPRsWithRepo } from "./get-open-prs.js";
import {
  readCompareChangedFiles,
  resolveReviewFreshness,
  type ReviewFreshness,
} from "./review-freshness.js";
import {
  matchItem,
  toSyncResult,
  type PRInfo,
  type SyncFilled,
  type SyncMatchResult,
  type SyncResult,
} from "./sync-types.js";
import { runUpdate } from "./update.js";
import { classifyVerdicts, latestVerdict, type VerdictState } from "./verdict.js";

/**
 * The head OID of the single PR a match resolved to, or null when the match
 * does not identify one PR (pending / ambiguous) or gh omitted the field. A
 * null head makes freshness `unbound`, never fresh.
 */
function matchedHeadOid(match: SyncMatchResult, prs: PRInfo[]): string | null {
  if (match.status !== "matched" && match.status !== "fillable") return null;
  const head = prs.find((pr) => pr.number === match.prNumber)?.headRefOid ?? "";
  return head.length > 0 ? head : null;
}

/**
 * Reconcile the tracker with the repo's open GitHub PRs. Check mode (the default)
 * only reports; write mode additionally fills empty `branch` fields via the
 * same matching. Never overwrites a set branch, never guesses an ambiguous
 * match, and never touches status (merge != acceptance). Returns data; the
 * CLI prints. Throws on conflicting flags (--check + --write).
 */
export function runSync(
  opts: {
    check?: boolean;
    write?: boolean;
    repo?: string;
    cwd?: string;
  },
  execGh: typeof execFileSync = execFileSync,
): SyncResult {
  if (opts.check && opts.write) {
    throw new Error("pass either --check or --write, not both");
  }
  const mode: "check" | "write" = opts.write ? "write" : "check";
  const cwd = opts.cwd || process.cwd();

  let items;
  let prs: PRInfo[];
  let root: string;
  let repoSlug: { owner: string; repo: string };
  let trackerPath = "";
  try {
    const tasksDir = findTasksDir(cwd);
    root = repoRootFromTasks(tasksDir);
    trackerPath = basename(tasksDir);
    items = loadItems(tasksDir);
    const resolved = getOpenPRsWithRepo(opts.repo || null, cwd, execGh);
    prs = resolved.prs;
    repoSlug = resolved.repo;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return toSyncResult([], mode, null, [msg]);
  }

  // Items with a branch reconcile regardless of type (matched / no PR /
  // ambiguous). Fill suggestions are leaves only (task/bug): a PR targets
  // concrete work, and container ids (epic "auth") match unrelated branches
  // too easily. Branchless items with no candidate PR are not reported —
  // there is nothing to reconcile.
  const byId = new Map(items.map((i) => [i.id, i]));
  const reported = items
    .map((item) => matchItem({ id: item.id, branch: item.branch ?? null }, prs))
    .filter((m) => {
      const item = byId.get(m.itemId)!;
      if (item.branch) return true;
      if (m.status === "no_pr") return false;
      return item.type === "task" || item.type === "bug";
    });

  let filled: SyncFilled | null = null;
  const updateErrors: string[] = [];
  if (mode === "write") {
    for (const match of reported) {
      if (match.status !== "fillable") continue;
      try {
        runUpdate({ cwd, id: match.itemId, branch: match.branch });
        if (!filled) filled = {};
        filled[match.itemId] = match.branch;
      } catch (err) {
        updateErrors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  // Report-only review-verdict classification (task-review-verdict-checker):
  // every item this run reconciles with an open PR (matched / fillable /
  // pending / ambiguous — anything except no_pr) gets its verdict state read
  // from the body's verdict comments. Bodies are already in memory from
  // loadItems, so this costs no additional gh calls, and the result never
  // gates matching or exit_code (the blocking gate is explicitly out of
  // scope until the report proves low-noise).
  const verdicts: Record<string, VerdictState> = {};
  for (const match of reported) {
    if (match.status === "no_pr") continue;
    const item = byId.get(match.itemId)!;
    verdicts[match.itemId] = classifyVerdicts(item.body);
  }

  // Review freshness (issue #872): bind each verdict to the revision it
  // recorded and compare it with the PR head. The verdict's own tracker commit
  // lives under the tracker root, so a tracker-only `reviewed..head` diff
  // stays fresh while any code change after the approval makes it stale. The
  // comparison is read from GitHub, so it does not depend on the PR head being
  // fetched locally; when it cannot be resolved the state is `unbound`, never
  // fresh. Report-only: this never gates matching or the exit code.
  const reviewFreshness: Record<string, ReviewFreshness> = {};
  for (const match of reported) {
    if (match.status === "no_pr") continue;
    if (verdicts[match.itemId] === "none") continue;
    const item = byId.get(match.itemId)!;
    reviewFreshness[match.itemId] = resolveReviewFreshness({
      reviewed: latestVerdict(item.body)?.reviewed ?? null,
      head: matchedHeadOid(match, prs),
      trackerPath,
      readChangedFiles: (base, head) =>
        readCompareChangedFiles(repoSlug.owner, repoSlug.repo, base, head, execGh),
    });
  }
  const reassessmentRequired = Object.keys(reviewFreshness).filter(
    (id) => reviewFreshness[id]!.freshness === "stale",
  );

  // Branch-resident claims (bug-claim-pool-computed-from-main-misses-branch-
  // claims): the claim commit rides the item branch, so this tree's copy of a
  // claimed item still reads todo/unassigned until the branch merges. Read the
  // branch copies (local git only) so "unclaimed" and "claimed on a branch I
  // have not merged" are distinguishable. Report-only: never gates matching
  // or the exit code, exactly like `verdicts`.
  const branchClaims = findBranchClaims({ root, items, prs });

  return toSyncResult(
    reported,
    mode,
    filled,
    updateErrors,
    verdicts,
    branchClaims.claims,
    branchClaims.errors,
    reviewFreshness,
    reassessmentRequired,
  );
}
