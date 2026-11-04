/**
 * Review-verdict convention parser (task-review-verdict-checker).
 *
 * The review bar lands verdicts on the item with `arggon comment` as
 * human-written prose, never schema: a verdict comment starts with a bounded
 * header line — `verdict: approve` or `verdict: request-changes`, optionally
 * followed by a scope — and then the evidence list (see
 * `ArggonManager/docs/engineering.md` §Review bar → Review verdicts).
 *
 * A verdict may also carry an optional second header line, `reviewed: <sha>`,
 * naming the revision the reviewer actually inspected. This module reads that
 * convention report-only. It classifies an item body's comments so
 * `arggon sync --json` can report verdict state per PR-reconciled item, and the
 * revision binding lets sync flag an approval the PR head has outrun. It never
 * gates anything: a blocking merge gate is deliberately out of scope until the
 * report proves low-noise.
 */

/** A review verdict value as written in a verdict header line. */
export type VerdictValue = "approve" | "request-changes";

/** Report-only classification of an item's verdict comments. */
export type VerdictState = "approved" | "changes-requested" | "none";

/** One recognized verdict header line, attributed to its comment. */
export type VerdictComment = {
  /** Comment date (YYYY-MM-DD) parsed from the `### <date> @<author>` heading. */
  date: string;
  /** Comment position in the body (nth `###` heading) — tiebreak for equal dates. */
  order: number;
  value: VerdictValue;
  /** Text after the value token (e.g. `(smoke evidence missing)`); null when absent. */
  scope: string | null;
  /**
   * Commit SHA from the comment's optional `reviewed:` line (lowercased), or
   * null when the verdict is unbound — the reviewer recorded no revision, so
   * `sync` cannot tell whether the verdict still covers the PR head.
   */
  reviewed: string | null;
};

/**
 * A comment heading as `arggon comment` writes it: `### <YYYY-MM-DD> @<author>`.
 * Handoff headings (`### handoff <date> ...`) do not match — verdicts are
 * plain comments, so their lines never count as verdicts.
 */
const COMMENT_HEADING = /^###\s+(\d{4}-\d{2}-\d{2})\s+@/;

/**
 * A verdict header line: `verdict: approve` / `verdict: request-changes`,
 * case-insensitive on the token and the value, with optional scope after the
 * value. Bounded on purpose — `verdict: approved` or `verdict: approvals` do
 * not match (the value must be followed by end-of-line, space or `(`), and a
 * line that merely mentions "verdict" later (`the verdict: approve ...`) is
 * not a header line.
 */
const VERDICT_LINE = /^[ \t]*verdict:[ \t]*(approve|request-changes)(?=$|[ \t(])/i;

/**
 * The reviewed-revision line: `reviewed: <commit sha>` — a bounded 7-40 char
 * hexadecimal commit id, case-insensitive, optionally followed by whitespace
 * and a note. It must start the line (an inline mention or an evidence bullet
 * cannot impersonate it), and like the verdict line only the first one in a
 * dated comment counts.
 */
const REVIEWED_LINE = /^[ \t]*reviewed:[ \t]*([0-9a-f]{7,40})(?=$|[ \t])/i;

/**
 * Parse the verdict comments of an item body, in comment order.
 *
 * Only comments under a dated `### <date> @<author>` heading can carry a
 * verdict (verdicts are comments, not top-level prose), and only the first
 * verdict-looking line of a comment counts — the header line per the
 * convention, so quoted verdicts in an evidence list cannot impersonate one.
 * The optional `reviewed:` line belongs to the same comment and may appear
 * before or after the verdict line; its first occurrence binds the verdict.
 * Comments are append-only, so body order breaks ties between same-date
 * comments.
 */
export function parseVerdicts(body: string): VerdictComment[] {
  const verdicts: VerdictComment[] = [];
  let order = -1;
  let currentDate: string | null = null;
  let seenVerdictInComment = false;
  let seenReviewedInComment = false;
  let currentReviewed: string | null = null;
  let currentCommentVerdict: VerdictComment | null = null;

  for (const line of body.split("\n")) {
    if (/^###\s/.test(line)) {
      order++;
      const heading = COMMENT_HEADING.exec(line);
      currentDate = heading ? heading[1]! : null;
      seenVerdictInComment = false;
      seenReviewedInComment = false;
      currentReviewed = null;
      currentCommentVerdict = null;
      continue;
    }
    if (currentDate === null) continue;
    if (!seenReviewedInComment) {
      const reviewed = REVIEWED_LINE.exec(line);
      if (reviewed) {
        seenReviewedInComment = true;
        currentReviewed = reviewed[1]!.toLowerCase();
        if (currentCommentVerdict) currentCommentVerdict.reviewed = currentReviewed;
        continue;
      }
    }
    if (seenVerdictInComment) continue;
    const match = VERDICT_LINE.exec(line);
    if (!match) continue;
    const scope = line.slice(match.index + match[0]!.length).trim();
    currentCommentVerdict = {
      date: currentDate,
      order,
      value: match[1]!.toLowerCase() as VerdictValue,
      scope: scope.length > 0 ? scope : null,
      reviewed: currentReviewed,
    };
    verdicts.push(currentCommentVerdict);
    seenVerdictInComment = true;
  }
  return verdicts;
}

/**
 * The latest verdict comment, ordered by comment date and then by comment
 * position for comments sharing a date (comments are appended chronologically).
 * Null when the body carries no verdict comment.
 */
export function latestVerdict(body: string): VerdictComment | null {
  let latest: VerdictComment | null = null;
  for (const verdict of parseVerdicts(body)) {
    if (
      latest === null ||
      verdict.date > latest.date ||
      (verdict.date === latest.date && verdict.order > latest.order)
    ) {
      latest = verdict;
    }
  }
  return latest;
}

/**
 * Classify an item body's verdict comments (report-only):
 *
 * - `none` — no verdict comments;
 * - `approved` — the latest verdict is an approve;
 * - `changes-requested` — the latest verdict is a request-changes (newer than
 *   any earlier approve).
 *
 * "Latest" follows {@link latestVerdict}. Freshness is deliberately separate:
 * an `approved` state says only that the latest verdict was an approve, not
 * that it still covers the current PR head — `sync` reports that separately.
 */
export function classifyVerdicts(body: string): VerdictState {
  const latest = latestVerdict(body);
  if (!latest) return "none";
  return latest.value === "approve" ? "approved" : "changes-requested";
}
