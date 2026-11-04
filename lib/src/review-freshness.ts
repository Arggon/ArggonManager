/**
 * Review-freshness classification (part 3 of the 2026-11-03 methodology
 * review, issue #872).
 *
 * A review verdict can name the revision it reviewed (`reviewed: <sha>` in the
 * verdict comment — see `verdict.ts` and `ArggonManager/docs/engineering.md`
 * §Review bar → Review verdicts). This module answers the separate question
 * "does that verdict still cover the PR head?":
 *
 * - `fresh` — the recorded revision equals the head, or every path changed
 *   between them lives under the tracker root. The verdict's own tracker
 *   commit therefore does not invalidate the approval it records.
 * - `stale` — at least one non-tracker path changed after the reviewed
 *   revision: the approval no longer covers the code, so reassessment is
 *   required.
 * - `unbound` — no revision was recorded, or the comparison cannot be
 *   resolved. Unbound is never reported as fresh; the verdict is simply not
 *   evidence of a current review.
 *
 * Report-only: `sync` reports this state and never gates matching, review or
 * the exit code. The comparison is read from GitHub (`compare`), so it works
 * even when the PR head is not fetched into the local checkout, and the local
 * tracker path is the only exclusion.
 */
import { execFileSync } from "node:child_process";

/** Freshness of a verdict relative to the PR head. */
export type ReviewFreshnessState = "fresh" | "stale" | "unbound";

/** One item's review-freshness reading (additive `sync --json` payload). */
export type ReviewFreshness = {
  /** Revision recorded by the latest verdict comment; null when absent. */
  reviewed_revision: string | null;
  /** Current PR head OID; null when the run could not resolve one. */
  head_revision: string | null;
  freshness: ReviewFreshnessState;
  /**
   * Why the state is `unbound` (or why a truncated comparison was treated as
   * stale); null for ordinary fresh and stale readings.
   */
  reason: string | null;
};

/** Paths changed between two revisions, as reported by a diff/compare reader. */
export type ChangedFilesResult = {
  /** Repo-relative paths (posix form). */
  paths: string[];
  /**
   * The reader cut its list, so `paths` is not the whole diff — a missing
   * non-tracker path is possible and the reading must not call it fresh.
   */
  truncated: boolean;
};

/**
 * GitHub's compare endpoint returns at most 300 files; a full 300-row list is
 * treated as truncated so a huge diff can never read as tracker-only.
 */
const COMPARE_FILE_CAP = 300;

/**
 * Whether two revision strings name the same commit. A reviewer may record a
 * short SHA (`abc1234`) while the PR head is the full 40-char OID, so the
 * shorter string matching a prefix of the longer one counts as the same
 * revision. Hex validation happens at parse time.
 */
export function revisionMatches(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left.length === 0 || right.length === 0) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  return longer.startsWith(shorter);
}

/**
 * Whether a repo-relative path belongs to the tracker tree (`trackerPath` is
 * the tracker directory name relative to the repo root, e.g. `ArggonManager`).
 * Both separators are normalized so a Windows-style reader cannot leak a
 * tracker commit into the relevant set.
 */
export function isTrackerPath(path: string, trackerPath: string): boolean {
  const prefix = trackerPath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (prefix.length === 0) return false;
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized === prefix || normalized.startsWith(`${prefix}/`);
}

/**
 * Classify one verdict binding. `readChangedFiles` is injected (and only
 * called when the revisions differ) so the pure decision stays testable and a
 * caller can supply a local or remote reader.
 */
export function resolveReviewFreshness(args: {
  reviewed: string | null;
  head: string | null;
  trackerPath: string;
  readChangedFiles: (base: string, head: string) => ChangedFilesResult | null;
}): ReviewFreshness {
  const reviewed = args.reviewed ? args.reviewed.trim().toLowerCase() : null;
  const head = args.head ? args.head.trim().toLowerCase() : null;

  if (!reviewed) {
    return {
      reviewed_revision: null,
      head_revision: head,
      freshness: "unbound",
      reason: "no reviewed revision recorded",
    };
  }
  if (!head) {
    return {
      reviewed_revision: reviewed,
      head_revision: null,
      freshness: "unbound",
      reason: "PR head revision unavailable",
    };
  }
  if (revisionMatches(reviewed, head)) {
    return { reviewed_revision: reviewed, head_revision: head, freshness: "fresh", reason: null };
  }

  const changed = args.readChangedFiles(reviewed, head);
  if (!changed) {
    return {
      reviewed_revision: reviewed,
      head_revision: head,
      freshness: "unbound",
      reason: "reviewed..head comparison unavailable",
    };
  }

  const relevant = changed.paths.filter((path) => !isTrackerPath(path, args.trackerPath));
  if (relevant.length > 0) {
    return { reviewed_revision: reviewed, head_revision: head, freshness: "stale", reason: null };
  }
  if (changed.truncated) {
    return {
      reviewed_revision: reviewed,
      head_revision: head,
      freshness: "stale",
      reason: "reviewed..head comparison truncated; assuming a relevant change",
    };
  }
  return { reviewed_revision: reviewed, head_revision: head, freshness: "fresh", reason: null };
}

/**
 * Read the changed paths between two revisions through GitHub's compare API.
 * Returns null when the comparison cannot be resolved (unknown revision, no
 * network, gh missing) — the caller reports `unbound`, never fresh.
 */
export function readCompareChangedFiles(
  owner: string,
  repo: string,
  base: string,
  head: string,
  execGh: typeof execFileSync = execFileSync,
): ChangedFilesResult | null {
  let out: string;
  try {
    out = execGh("gh", ["api", `repos/${owner}/${repo}/compare/${base}...${head}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 30_000,
    }) as string;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(out) as { files?: Array<{ filename?: unknown }> };
    const paths = (data.files ?? [])
      .map((file) => file.filename)
      .filter((filename): filename is string => typeof filename === "string");
    return { paths, truncated: paths.length >= COMPARE_FILE_CAP };
  } catch {
    return null;
  }
}
