/**
 * Scaffold-placeholder detection over an item's LIVE sections
 * (task-validate-refuses-placeholder-bodies; `decided: A` on
 * bug-template-only-bodies-ship-green).
 *
 * An OPEN (`todo`/`in_progress`/`blocked`) item whose live `## Context` or
 * live `## Acceptance` still carries the scaffold placeholder marker fails
 * `arggon validate` with `PLACEHOLDER_BODY` (see `lib/src/validate.ts`).
 * Done/cancelled items are excluded — history, not the contract — and the
 * refusal message says so.
 *
 * ## What the marker IS (and why it is a grammar, not a string list)
 *
 * The marker is the `<!-- … -->` placeholder comment in a live section
 * (`ArggonManager/docs/convention.md` names it exactly that way). This module
 * matches that GRAMMAR — an HTML comment surviving in a live section — and
 * deliberately does NOT enumerate the templates' prose ("Why this task
 * exists.", "What went wrong / how to reproduce.", "The real acceptance
 * criteria; tick each box when met.", …). Two reasons, both structural:
 *
 * 1. The kernel ships no assets (ADR 0013): the templates live in the repo's
 *    own `templates/` with the root package's bundled copy as fallback, and
 *    `validate` takes no `templatesDir` — so a string list here would be a
 *    restated copy that drifts the next time a template is reworded. The
 *    comment grammar is the stable property across every rewording.
 * 2. Quoted prose must stay green: `bug-template-only-bodies-ship-green`
 *    itself quotes the placeholder strings in real content (inline code
 *    spans), and it is an open item. A substring match on the prose would flag
 *    exactly the item that filed the bug. Matching the comment node — with
 *    inline code spans stripped first — is what keeps that negative control
 *    green.
 *
 * The one honest cost of the grammar rule, stated: a hand-written HTML comment
 * in a live section (e.g. `<!-- TODO: expand -->`) reads as a leftover marker
 * too. That is the documented contract — live sections carry prose, not HTML
 * comments — and it is what keeps the rule drift-free.
 *
 * ## What is excluded, and why each exclusion exists
 *
 * - Fenced code blocks and dated comment blocks are already removed by the
 *   live-section extraction (`liveAcceptanceLines` in `items.ts`, shared with
 *   the done gate): a fence is content (a repro quoting the template) and a
 *   dated block is history (maker evidence quoting the scaffold it replaced).
 * - Inline code spans are stripped HERE, before matching: prose may quote the
 *   marker text in backticks, and that quotation is real content about the
 *   marker, not the marker itself.
 *
 * Consumers MUST pass the canonical body (`acceptanceBody(item)`): narrowing
 * the input at a call site is the mistake `acceptanceBody` exists to prevent.
 */

import {
  acceptanceBody,
  liveAcceptanceRegion,
  liveContextRegion,
  type AcceptanceBodySource,
} from "./items.js";

/** A live section the placeholder guard reads. Document order: Context first. */
export type PlaceholderSection = "Context" | "Acceptance";

/**
 * Remove CommonMark inline code spans (runs of backticks) from `text`, so
 * prose that QUOTES a marker never reads as the marker itself.
 *
 * A span opens with a run of N backticks and closes at the next run of exactly
 * N backticks; an unclosed run is literal text and is kept (a lone backtick is
 * not a span, so a marker after one is still a real marker). Newlines inside a
 * span are allowed, matching CommonMark. Pure; O(n).
 */
export function stripInlineCodeSpans(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "`") {
      out += text[i];
      i += 1;
      continue;
    }
    let run = 0;
    while (text[i + run] === "`") run += 1;
    const closer = "`".repeat(run);
    const end = text.indexOf(closer, i + run);
    if (end === -1) {
      // Unclosed: literal text, kept — including any marker after it.
      out += text.slice(i);
      break;
    }
    i = end + run;
  }
  return out;
}

/** An HTML comment `<!-- … -->` anywhere in `region` (spans already stripped). */
const SCAFFOLD_COMMENT = /<!--[\s\S]*?-->/;

/**
 * True when a live section region still carries the scaffold marker: an HTML
 * comment outside inline code spans. `null`/absent regions never match (an
 * item that names its section something else publishes no marker there).
 */
export function regionHasScaffoldMarker(region: string | null): boolean {
  if (region === null) return false;
  return SCAFFOLD_COMMENT.test(stripInlineCodeSpans(region));
}

/**
 * The live sections of `body` that still carry the scaffold marker, in
 * document order (Context before Acceptance). `[]` when neither does — the
 * shape that passes `validate`.
 *
 * Pure; O(lines). Takes the canonical body (`acceptanceBody(item)`), like every
 * other acceptance consumer — the region scoping happens inside, on that input.
 */
export function placeholderSections(body: string): PlaceholderSection[] {
  const sections: PlaceholderSection[] = [];
  if (regionHasScaffoldMarker(liveContextRegion(body))) sections.push("Context");
  if (regionHasScaffoldMarker(liveAcceptanceRegion(body))) sections.push("Acceptance");
  return sections;
}

/** The guard's question over a loaded item (or any body source): does it fail? */
export function bodyHasScaffoldPlaceholder(source: AcceptanceBodySource): boolean {
  return placeholderSections(acceptanceBody(source)).length > 0;
}
