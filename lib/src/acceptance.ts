/**
 * Product-acceptance convention parser (ADR 0021 §4, spec
 * `ArggonManager/docs/specs/spec-promotion-policy-018.md`).
 *
 * A container's product acceptance is human-written prose on the item, never
 * schema: an acceptance comment starts with a bounded header line —
 * `accept: approve` or `accept: changes-requested`, optionally followed by a
 * scope — and then the evidence list. It is the same convention, grammar for
 * grammar, as the review verdict `verdict.ts` parses.
 *
 * This module reads that convention **report-only**. It classifies an item
 * body's acceptance comments so `arggon report --json` and
 * `arggon show <id> --json` can report the state, and so `arggon spec analyze`
 * can flag a container that closed with no recorded acceptance. It never gates
 * anything: the tracker has no identity layer, so an acceptance is attributed,
 * never authenticated, and a gate built on it would be forgeable. See the
 * spec's invariants for the full statement.
 *
 * ## What this is NOT
 *
 * Nothing here touches the **done gate**. That gate is the acceptance-aware
 * *checkbox* contract in `items.ts` (`acceptanceComplete`, the cascade's
 * `acceptance-incomplete` skip) — a different question over a different
 * grammar, owned by a different module. This file reads one `accept:` header
 * line and nothing else; the words overlap, the rules do not.
 */

import type { WorkItem } from "./items.js";

/** A product-acceptance value as written in an acceptance header line. */
export type AcceptanceValue = "approve" | "changes-requested";

/**
 * Report-only classification of an item's acceptance comments.
 *
 * - `accepted` — the latest acceptance is an `approve`;
 * - `changes-noted` — the latest acceptance is a `changes-requested`;
 * - `none` — no acceptance comment on the item;
 * - `self-accepted` — the latest `approve` was written by the item's own
 *   assignee. Reported, never blocked: without an identity layer, forgery is
 *   expected rather than exceptional, and attribution is the only honest signal.
 */
export type AcceptanceState = "accepted" | "changes-noted" | "none" | "self-accepted";

/** Every state {@link classifyAcceptance} can return, for payload docs and tests. */
export const ACCEPTANCE_STATES: readonly AcceptanceState[] = [
  "accepted",
  "changes-noted",
  "none",
  "self-accepted",
];

/** One recognized acceptance header line, attributed to its comment. */
export type AcceptanceComment = {
  /** Comment date (YYYY-MM-DD) parsed from the `### <date> @<author>` heading. */
  date: string;
  /** Comment position in the body (nth `###` heading) — tiebreak for equal dates. */
  order: number;
  /**
   * Comment author from the heading (`@<author>`). NEW data relative to the
   * verdict parser, which does not capture it: `self-accepted` is exactly the
   * question "who wrote this", so re-reading the heading would be a second
   * grammar for the same line.
   */
  author: string;
  value: AcceptanceValue;
  /** Text after the value token (e.g. `(release notes missing)`); null when absent. */
  scope: string | null;
};

/**
 * A comment heading as `arggon comment` writes it:
 * `### <YYYY-MM-DD> @<author>` — date and author captured. Handoff headings
 * (`### handoff <date> @<author> — next: …`) do not match, so an acceptance
 * inside a handoff section never counts.
 */
const COMMENT_HEADING = /^###\s+(\d{4}-\d{2}-\d{2})\s+@(\S+)/;

/**
 * An acceptance header line: `accept: approve` / `accept: changes-requested`,
 * case-insensitive on the token and the value, with optional scope after the
 * value. Bounded on purpose, mirroring `verdict.ts`: `accept: approved` or
 * `accept: approvals` do not match (the value must be followed by end-of-line,
 * space or `(`), and a line that merely mentions "accept" later
 * (`the accept: approve …`) is not a header line.
 */
const ACCEPTANCE_LINE = /^[ \t]*accept:[ \t]*(approve|changes-requested)(?=$|[ \t(])/i;

/**
 * Parse the acceptance comments of an item body, in comment order.
 *
 * Only comments under a dated `### <date> @<author>` heading can carry an
 * acceptance (acceptances are comments, not top-level prose), and only the
 * first acceptance-looking line of a comment counts — the header line per the
 * convention, so a quoted acceptance inside an evidence list cannot
 * impersonate one. Comments are append-only, so body order breaks ties between
 * same-date comments.
 */
export function parseAcceptances(body: string): AcceptanceComment[] {
  const acceptances: AcceptanceComment[] = [];
  let order = -1;
  let current: { date: string; author: string } | null = null;
  let seenInComment = false;

  for (const line of body.split("\n")) {
    if (/^###\s/.test(line)) {
      order++;
      const heading = COMMENT_HEADING.exec(line);
      current = heading ? { date: heading[1]!, author: heading[2]! } : null;
      seenInComment = false;
      continue;
    }
    if (current === null || seenInComment) continue;
    const match = ACCEPTANCE_LINE.exec(line);
    if (!match) continue;
    const scope = line.slice(match.index + match[0]!.length).trim();
    acceptances.push({
      date: current.date,
      order,
      author: current.author,
      value: match[1]!.toLowerCase() as AcceptanceValue,
      scope: scope.length > 0 ? scope : null,
    });
    seenInComment = true;
  }
  return acceptances;
}

/**
 * Logins are case-insensitive identifiers, so the self-acceptance comparison
 * folds case: `Gonzalo` and `gonzalo` are the same owner and must not be able
 * to slip past the very signal that exists to be honest about attribution.
 */
function sameOwner(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Classify an item body's acceptance comments (report-only):
 *
 * - `none` — no acceptance comments;
 * - `accepted` — the latest acceptance is an `approve` by someone other than
 *   the item's own assignee;
 * - `self-accepted` — that same `approve`, written by the item's own assignee;
 * - `changes-noted` — the latest acceptance is a `changes-requested` (newer
 *   than any earlier approve). Attribution is irrelevant here: a
 *   `changes-requested` is never an approval, whoever wrote it.
 *
 * "Latest" is ordered by comment date, then by comment position for comments
 * sharing a date (comments are appended chronologically). `assignee` is the
 * item's current assignee, or null/undefined when unassigned — an unassigned
 * container can never read as `self-accepted`.
 */
export function classifyAcceptance(body: string, assignee?: string | null): AcceptanceState {
  let latest: AcceptanceComment | null = null;
  for (const acceptance of parseAcceptances(body)) {
    if (
      latest === null ||
      acceptance.date > latest.date ||
      (acceptance.date === latest.date && acceptance.order > latest.order)
    ) {
      latest = acceptance;
    }
  }
  if (!latest) return "none";
  if (latest.value === "changes-requested") return "changes-noted";
  if (assignee && sameOwner(latest.author, assignee)) return "self-accepted";
  return "accepted";
}

// ---------------------------------------------------------------------------
// Which containers the convention applies to, and which of them fell short
// ---------------------------------------------------------------------------

/**
 * The item types the convention is scoped to: `story` containers — the tier
 * the promotion policy names (T1 in spec `promotion-policy-018`), the same rows
 * `report` aggregates per epic (`ReportContainer`). Leaves are excluded by
 * construction (agent self-certifies at T0) and the epic/initiative levels are
 * not in the table, so they are deliberately NOT reported: the cap the spec
 * states — product-owner touchpoints bounded to containers, never one per item
 * — is what keeps this detector low-noise.
 */
export const ACCEPTANCE_CONTAINER_TYPES: ReadonlySet<string> = new Set(["story"]);

/** A container that reached a terminal status without a recorded `accepted`. */
export type AcceptanceGap = {
  item: WorkItem;
  /** The container's classification — `none`, `changes-noted` or `self-accepted`. */
  state: AcceptanceState;
};

/**
 * Every {@link ACCEPTANCE_CONTAINER_TYPES} item that is terminal and whose
 * latest acceptance is not `accepted`, sorted by id.
 *
 * `self-accepted` and `changes-noted` both count as gaps: the question is
 * whether the product owner's decision is on the record, and neither state is
 * that. Pure and allocation-free beyond the returned array — the caller decides
 * whether a gap is reported (the `spec analyze` finding only fires when the
 * adopting project has armed `x-tracker.product-acceptance`).
 *
 * The terminal pair is spelled out rather than imported: it is the same
 * `done`/`cancelled` pair `rules.ts`, `trend.ts` and `update.ts` each state at
 * their own use site, and this module has no git dependency to inherit
 * `CLEANUP_TERMINAL_STATUSES` from.
 */
export function containersMissingAcceptance(items: readonly WorkItem[]): AcceptanceGap[] {
  const gaps: AcceptanceGap[] = [];
  for (const item of items) {
    if (!ACCEPTANCE_CONTAINER_TYPES.has(item.type)) continue;
    if (item.status !== "done" && item.status !== "cancelled") continue;
    const state = classifyAcceptance(item.body, item.assignee);
    if (state === "accepted") continue;
    gaps.push({ item, state });
  }
  return gaps.sort((a, b) => (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
}
