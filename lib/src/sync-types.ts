import type { WorkItem } from "./types.js";
import type { VerdictState } from "./verdict.js";

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

/**
 * A branch-resident claim (bug-claim-pool-computed-from-main-misses-branch-
 * claims): a copy of the item file on another branch that holds a claim the
 * tree this run read does not show. `start`'s claim commit rides the item
 * branch, so until that branch merges the primary's copy still reads
 * `todo`/unassigned — this is how sync makes that claim visible.
 */
export type BranchClaim = {
  /** Item id the claim belongs to. */
  id: string;
  /** Branch whose copy of the item file carries the claim. */
  branch: string;
  /** Open-PR number naming the branch, when one does; null for a local-only branch. */
  pr: number | null;
  /** Claim read from the branch copy (in_progress + assignee). */
  assignee: string;
  /** Soft lease read from the branch copy; null when the claim predates `claimed_at`. */
  claimed_at: string | null;
  /**
   * The state THIS tree shows for the item, so an invisible claim is a visible
   * diff: `{ status: "todo", assignee: null }` is the incident case.
   */
  local: { status: string; assignee: string | null };
};

/**
 * A branch that could not be read, so its claim state is unknown — never
 * assumed unclaimed. Emitted for a recorded/PR branch that is not available
 * locally (not fetched) and for a branch copy without readable frontmatter.
 */
export type BranchClaimError = {
  id: string;
  branch: string;
  pr: number | null;
  /** Why the branch copy could not be read (bounded, first line of the git/parse error). */
  reason: string;
};

/** The branch-claim read over one tracker tree. */
export type BranchClaimsResult = {
  claims: BranchClaim[];
  errors: BranchClaimError[];
};

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
  /**
   * Report-only review-verdict classification (task-review-verdict-checker),
   * per item this run reconciled with an open PR (matched / fillable /
   * pending / ambiguous — never `no_pr` items). Read from the item body's
   * verdict comments (`docs/engineering.md` §Review bar → Review verdicts);
   * additive within schemaVersion 1 and never gates matching or exit_code.
   */
  verdicts: Record<string, VerdictState>;
  /**
   * Branch-resident claims (bug-claim-pool-computed-from-main-misses-branch-
   * claims), read from the branch copies themselves: every locally-unclaimed
   * claimable item whose recorded branch, a local/origin ref referencing its
   * id, or an open-PR head branch names it. Additive within schemaVersion 1
   * and report-only — never gates matching or exit_code.
   */
  branchClaims: BranchClaim[];
  /** Branches whose item copy could not be read — claim state unknown. */
  branchClaimErrors: BranchClaimError[];
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
export function matchItem(item: Pick<WorkItem, "id" | "branch">, prs: PRInfo[]): SyncMatchResult {
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
  errors: string[] = [],
  verdicts: Record<string, VerdictState> = {},
  branchClaims: BranchClaim[] = [],
  branchClaimErrors: BranchClaimError[] = [],
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
    verdicts,
    branchClaims,
    branchClaimErrors,
    errors,
    exit_code:
      mode === "check"
        ? pending.length > 0 || ambiguous.length > 0 || errors.length > 0
          ? 1
          : 0
        : ambiguous.length > 0 || errors.length > 0
          ? 1
          : 0,
  };
}
