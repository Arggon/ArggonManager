/**
 * Decision-brief convention parser (ADR 0026, spec
 * `ArggonManager/docs/specs/spec-owner-decision-brief-021.md`).
 *
 * A decision brief is human-written prose on the item, never schema: the
 * delivery lead asks with a comment headed `decide: <the decision, free text>`,
 * and the product owner answers with a comment headed `decided: <the chosen
 * option, or `other``. Both live under the same dated heading `arggon comment`
 * writes — `### <YYYY-MM-DD> @<author>` — which is the grammar `verdict.ts` and
 * `acceptance.ts` already parse.
 *
 * This module reads that convention **report-only**. It classifies an item
 * body's brief and answer comments so `arggon show <id> --json` can report the
 * state and so `arggon spec analyze` can flag a brief nobody answered. It never
 * gates anything: the tracker has no identity layer, so a brief is attributed,
 * never authenticated, and a gate built on it would be forgeable. See the
 * spec's invariants for the full statement.
 *
 * ## What this is NOT
 *
 * Nothing here touches a transition, a status or the done gate. The state is a
 * classification over comment headers, read by surfaces only.
 */

import type { WorkItem } from "./items.js";

/** Report-only classification of an item's decision-brief comments. */
export type DecisionBriefState = "none" | "open" | "decided" | "self-decided";

/** Every state {@link classifyDecisionBrief} can return, for payload docs and tests. */
export const DECISION_BRIEF_STATES: readonly DecisionBriefState[] = [
  "none",
  "open",
  "decided",
  "self-decided",
];

/**
 * One recognized brief (`decide:`) or answer (`decided:`) header line, in body
 * order, attributed to its comment.
 *
 * `author` is NEW data relative to the verdict parser, which does not capture it
 * (`lib/src/verdict.ts`): `self-decided` is exactly the question "who wrote this
 * answer", so re-reading the heading would be a second grammar for the same
 * line. `acceptance.ts` records the same reasoning for `self-accepted`.
 */
export type DecisionBriefEvent = {
  /** `brief` for a `decide:` header, `answer` for a `decided:` header. */
  kind: "brief" | "answer";
  /** Comment date (YYYY-MM-DD) parsed from the `### <date> @<author>` heading. */
  date: string;
  /** Comment position in the body (nth `###` heading) — tiebreak for equal dates. */
  order: number;
  /** Comment author from the heading (`@<author>`). */
  author: string;
  /**
   * Text after the header token, trimmed (the brief's free text, or the
   * answer's chosen option — `other` included); null when the header carried
   * none. The conventions differ in kind, not in shape: unlike `verdict:` and
   * `accept:` there is no fixed value token, so the tail is prose and is kept
   * whole rather than split into a value and a scope.
   */
  text: string | null;
};

/**
 * A comment heading as `arggon comment` writes it:
 * `### <YYYY-MM-DD> @<author>` — date and author captured. Handoff headings
 * (`### handoff <date> @<author> — next: …`) do not match, so a brief quoted
 * inside a handoff section never counts.
 */
const COMMENT_HEADING = /^###\s+(\d{4}-\d{2}-\d{2})\s+@(\S+)/;

/**
 * A brief header line: `decide:` followed by free text. Only the token is
 * bounded — case-insensitive, and it must reach end-of-line, a space/tab or `(`
 * right after the colon — so `decides:` never matches and a line that merely
 * mentions "decide:" later (`the decide: header …`) is not a header line.
 */
const BRIEF_LINE = /^[ \t]*decide:(?=$|[ \t(])/i;

/**
 * An answer header line: `decided:` followed by the chosen option (`other`
 * included), optionally with a short scope. Bounded exactly like the brief
 * line, so `decidedly:` never matches.
 */
const ANSWER_LINE = /^[ \t]*decided:(?=$|[ \t(])/i;

/**
 * Parse the brief and answer comments of an item body, in comment order.
 *
 * Only comments under a dated `### <date> @<author>` heading can carry a brief
 * or an answer (both are comments, not top-level prose), and only the **first**
 * header-looking line of a comment counts — so a quoted brief or answer inside
 * an evidence list cannot impersonate one. Comments are append-only, so body
 * order breaks ties between same-date comments.
 */
export function parseDecisionBriefs(body: string): DecisionBriefEvent[] {
  const events: DecisionBriefEvent[] = [];
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
    const brief = BRIEF_LINE.exec(line);
    const answer = brief ? null : ANSWER_LINE.exec(line);
    const match = brief ?? answer;
    if (!match) continue;
    const text = line.slice(match.index + match[0]!.length).trim();
    events.push({
      kind: brief ? "brief" : "answer",
      date: current.date,
      order,
      author: current.author,
      text: text.length > 0 ? text : null,
    });
    seenInComment = true;
  }
  return events;
}

/**
 * Logins are case-insensitive identifiers, so the self-answer comparison folds
 * case: `Gonzalo` and `gonzalo` are the same owner and must not be able to slip
 * past the very signal that exists to be honest about attribution.
 */
function sameOwner(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Body order is (date, comment position): append-only comments, same-date ties. */
function isAfter(
  candidate: { date: string; order: number },
  reference: { date: string; order: number } | null,
): boolean {
  if (reference === null) return true;
  if (candidate.date !== reference.date) return candidate.date > reference.date;
  return candidate.order > reference.order;
}

/**
 * Classify an item body's decision brief (report-only):
 *
 * - `none` — no `decide:` header on the item (an answer with no brief is
 *   `none` too: there was no question);
 * - `open` — a brief is on the item and no `decided:` comment follows it;
 * - `decided` — a `decided:` comment follows the latest brief, by someone other
 *   than the item's own assignee;
 * - `self-decided` — that same answer was written by the item's own assignee.
 *
 * "Latest" and "follows" are ordered by comment date, then by comment position
 * for comments sharing a date (comments are appended chronologically). A later
 * `decided:` supersedes an earlier one, and a brief filed after an answer is
 * open again — a superseded brief is never rewritten. `assignee` is the item's
 * current assignee, or null/undefined when unassigned — an unassigned item can
 * never read as `self-decided`.
 */
export function classifyDecisionBrief(body: string, assignee?: string | null): DecisionBriefState {
  const events = parseDecisionBriefs(body);
  let latestBrief: DecisionBriefEvent | null = null;
  for (const event of events) {
    if (event.kind !== "brief") continue;
    if (isAfter(event, latestBrief)) latestBrief = event;
  }
  if (!latestBrief) return "none";

  let latestAnswer: DecisionBriefEvent | null = null;
  for (const event of events) {
    if (event.kind !== "answer") continue;
    if (!isAfter(event, latestBrief)) continue;
    if (isAfter(event, latestAnswer)) latestAnswer = event;
  }
  if (!latestAnswer) return "open";
  if (assignee && sameOwner(latestAnswer.author, assignee)) return "self-decided";
  return "decided";
}

// ---------------------------------------------------------------------------
// Which items carry an unanswered brief
// ---------------------------------------------------------------------------

/** An item whose latest brief has no recorded answer. */
export type UnansweredBrief = {
  item: WorkItem;
  /** The item's classification — always `open` (the only state this returns). */
  state: DecisionBriefState;
};

/**
 * Every item whose decision-brief state is `open`, sorted by id.
 *
 * **Deliberately unscoped by type and status** — unlike
 * `containersMissingAcceptance` (`story` containers only, terminal only). An
 * acceptance is due at closure, so waiting for the container to close is what
 * keeps that detector low-noise; a brief is owed while the decision is **open**,
 * and it stays open for its whole default window. A brief sent and never
 * answered is a leaf as often as a container, and a `todo` or `in_progress`
 * item as often as a terminal one, so narrowing this by analogy with the
 * acceptance detector would silence the exact case the finding exists for
 * (spec `owner-decision-brief-021` §The finding, AC 4).
 *
 * Pure. The caller decides whether an open brief is reported (the
 * `spec analyze` finding only fires when the adopting project has armed
 * `x-tracker.product-acceptance`).
 */
export function itemsWithUnansweredBrief(items: readonly WorkItem[]): UnansweredBrief[] {
  const unanswered: UnansweredBrief[] = [];
  for (const item of items) {
    const state = classifyDecisionBrief(item.body, item.assignee);
    if (state !== "open") continue;
    unanswered.push({ item, state });
  }
  return unanswered.sort((a, b) => (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
}
