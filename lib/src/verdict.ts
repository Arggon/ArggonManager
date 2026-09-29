/**
 * Review-verdict convention parser (task-review-verdict-checker).
 *
 * The review bar lands verdicts on the item with `arggon comment` as
 * human-written prose, never schema: a verdict comment starts with a bounded
 * header line — `verdict: approve` or `verdict: request-changes`, optionally
 * followed by a scope — and then the evidence list (see
 * `ArggonManager/docs/engineering.md` §Review bar → Review verdicts).
 *
 * This module reads that convention report-only. It classifies an item body's
 * comments so `arggon sync --json` can report verdict state per PR-reconciled
 * item. It never gates anything: a blocking merge gate is deliberately out of
 * scope until the report proves low-noise.
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
 * Parse the verdict comments of an item body, in comment order.
 *
 * Only comments under a dated `### <date> @<author>` heading can carry a
 * verdict (verdicts are comments, not top-level prose), and only the first
 * verdict-looking line of a comment counts — the header line per the
 * convention, so quoted verdicts in an evidence list cannot impersonate one.
 * Comments are append-only, so body order breaks ties between same-date
 * comments.
 */
export function parseVerdicts(body: string): VerdictComment[] {
  const verdicts: VerdictComment[] = [];
  let order = -1;
  let currentDate: string | null = null;
  let seenVerdictInComment = false;

  for (const line of body.split("\n")) {
    if (/^###\s/.test(line)) {
      order++;
      const heading = COMMENT_HEADING.exec(line);
      currentDate = heading ? heading[1]! : null;
      seenVerdictInComment = false;
      continue;
    }
    if (currentDate === null || seenVerdictInComment) continue;
    const match = VERDICT_LINE.exec(line);
    if (!match) continue;
    const scope = line.slice(match.index + match[0]!.length).trim();
    verdicts.push({
      date: currentDate,
      order,
      value: match[1]!.toLowerCase() as VerdictValue,
      scope: scope.length > 0 ? scope : null,
    });
    seenVerdictInComment = true;
  }
  return verdicts;
}

/**
 * Classify an item body's verdict comments (report-only):
 *
 * - `none` — no verdict comments;
 * - `approved` — the latest verdict is an approve;
 * - `changes-requested` — the latest verdict is a request-changes (newer than
 *   any earlier approve).
 *
 * "Latest" is ordered by comment date, then by comment position for comments
 * sharing a date (comments are appended chronologically).
 */
export function classifyVerdicts(body: string): VerdictState {
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
  if (!latest) return "none";
  return latest.value === "approve" ? "approved" : "changes-requested";
}
