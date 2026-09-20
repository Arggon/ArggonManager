import type { WorkItem } from "./types.js";

export type SyncMatchResult =
  | {
      status: "matched";
      itemId: string;
      branch: string;
      prNumber: number;
    }
  | {
      /** Branch unset and exactly one candidate PR references the item id. */
      status: "fillable";
      itemId: string;
      branch: string;
      prNumber: number;
    }
  | {
      /** Branch unset and candidate PRs disagree — a human decides, never a guess. */
      status: "pending";
      itemId: string;
    }
  | { status: "no_pr"; itemId: string }
  | {
      status: "ambiguous";
      itemId: string;
      branch: string;
      prNumbers: number[];
    };

export type SyncFilled = Record<string, string>;

export type SyncResult = {
  command: "sync";
  mode: "check" | "write";
  /** Items whose branch matches an open PR (write mode: includes filled items). */
  matched: string[];
  /** Items with no matching/candidate open PR. */
  unmatched: string[];
  /** Check mode: fill available (see suggestions) or candidates disagree. */
  pending: string[];
  /** Multiple open PRs share one head branch — reported, never guessed. */
  ambiguous: Array<{ id: string; branch: string | null; prs: number[] }>;
  /** Empty-branch items a --write run can (check) or did (write) fill. */
  suggestions: Array<{ id: string; branch: string; pr: number }>;
  /** Write mode: id -> branch actually written to disk. */
  filled: SyncFilled | null;
  errors: string[];
  exit_code: 0 | 1;
};

export type PRInfo = {
  number: number;
  headRefName: string;
  title: string;
  url: string;
};

/**
 * Whether a branch name references the item id as a delimited token.
 * `branch_patterns` embed `{id}` verbatim (convention v2), so the id must
 * start a path segment and not run into following slug characters —
 * `task-1` must not match `feat/task-12`.
 */
export function branchReferencesItem(branch: string, id: string): boolean {
  const token = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|/)${token}(?![a-z0-9])`).test(branch);
}

/**
 * Match one item against the open PR list. Never guesses: exact head-branch
 * equality for items with a branch, id-referencing candidates otherwise, and
 * anything not uniquely resolvable degrades to pending/ambiguous.
 */
export function matchItem(
  item: Pick<WorkItem, "id" | "branch">,
  prs: PRInfo[]
): SyncMatchResult {
  if (item.branch) {
    const matching = prs.filter((pr) => pr.headRefName === item.branch);
    if (matching.length === 0) {
      return { status: "no_pr", itemId: item.id };
    }
    if (matching.length > 1) {
      return {
        status: "ambiguous",
        itemId: item.id,
        branch: item.branch,
        prNumbers: matching.map((p) => p.number),
      };
    }
    return {
      status: "matched",
      itemId: item.id,
      branch: item.branch,
      prNumber: matching[0]!.number,
    };
  }

  const candidates = prs.filter((pr) => branchReferencesItem(pr.headRefName, item.id));
  if (candidates.length === 0) {
    return { status: "no_pr", itemId: item.id };
  }
  if (candidates.length === 1) {
    const pr = candidates[0]!;
    return { status: "fillable", itemId: item.id, branch: pr.headRefName, prNumber: pr.number };
  }
  const branches = new Set(candidates.map((p) => p.headRefName));
  if (branches.size === 1) {
    return {
      status: "ambiguous",
      itemId: item.id,
      branch: candidates[0]!.headRefName,
      prNumbers: candidates.map((p) => p.number),
    };
  }
  return { status: "pending", itemId: item.id };
}

/**
 * Aggregate matches into a SyncResult. Mode colors the report, not the
 * matching: check mode counts fillable items as pending (sync needed, the CI
 * gate exits non-zero); write mode counts them as matched because this run
 * fills them.
 */
export function toSyncResult(
  matches: SyncMatchResult[],
  mode: "check" | "write",
  filled: SyncFilled | null = null,
  errors: string[] = []
): SyncResult {
  const matched: string[] = [];
  const unmatched: string[] = [];
  const pending: string[] = [];
  const ambiguous: Array<{ id: string; branch: string | null; prs: number[] }> = [];
  const suggestions: Array<{ id: string; branch: string; pr: number }> = [];

  for (const m of matches) {
    switch (m.status) {
      case "matched":
        matched.push(m.itemId);
        break;
      case "fillable":
        suggestions.push({ id: m.itemId, branch: m.branch, pr: m.prNumber });
        if (mode === "write") {
          matched.push(m.itemId);
        } else {
          pending.push(m.itemId);
        }
        break;
      case "pending":
        pending.push(m.itemId);
        break;
      case "no_pr":
        unmatched.push(m.itemId);
        break;
      case "ambiguous":
        ambiguous.push({ id: m.itemId, branch: m.branch, prs: m.prNumbers });
        break;
    }
  }

  return {
    command: "sync",
    mode,
    matched,
    unmatched,
    pending,
    ambiguous,
    suggestions,
    filled,
    errors,
    exit_code:
      mode === "check"
        ? (pending.length > 0 || ambiguous.length > 0 || errors.length > 0 ? 1 : 0)
        : ambiguous.length > 0 || errors.length > 0
          ? 1
          : 0,
  };
}
