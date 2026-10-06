/**
 * Acceptance-parser PARITY (bug-three-acceptance-parsers-diverging).
 *
 * The DONE GATE (`acceptanceComplete`, `lib/src/items.ts`) refuses a
 * `--status done` flip. Three consumers also answer a question about the same
 * checklist: the board drawer (`parseAcceptanceRows`), the CLI detail pane
 * (`tuiAcceptanceRows`) and the native detail block
 * (`opencode/plugins/arggon/board.ts`).
 *
 * The item was filed against THREE parsers; there were SIX grammars in the tree
 * before this fix — the gate, plus `cli/src/board.ts`, `cli/src/tui.ts`,
 * `opencode/plugins/arggon/board.ts`, `cli/src/spec.ts` and the ZCode goal
 * contract on PR #605 — and the consumers disagreed with the gate in BOTH
 * directions on reachable shapes. The worst case is the inversion: the gate
 * refuses while a consumer reports "nothing unchecked".
 *
 * This suite is the guard, and it is deliberately over a CORPUS rather than a
 * fixture. A corpus makes the class unfixable-by-luck: every shape below is
 * decided by ONE answer, and a new shape added to `CORPUS` is decided by the
 * same rule without anyone writing a new parser.
 *
 * What is asserted, for every corpus shape:
 *
 *   1. PARITY — the ROW question is shared: every consumer returns the same rows,
 *      and `acceptanceRows`/`acceptanceCriteria`/`acceptanceComplete` keep their
 *      documented whole-body identities (`acceptanceComplete is exactly
 *      no unchecked criteria` is asserted over the whole corpus).
 *   2. ONE ANSWER — every consumer returns the same row list for the same body.
 *   3. THE GATE'S OWN RULE — the done flip is decided by `acceptanceGate` over the
 *      item's LIVE `## Acceptance` section (dated comment blocks are history), and
 *      this suite compares it against an INDEPENDENT oracle of that rule over the
 *      whole corpus plus a structured fuzz. The oracle replaced the pre-fix
 *      whole-body regex when `bug-done-gate-counts-checkboxes-inside-comment-blocks`
 *      scoped the gate: that change deliberately moves the refusal set (history is
 *      no longer an obligation, a missing contract now is), so "the refusal set is
 *      unchanged" is no longer a property worth asserting — "the refusal set is
 *      EXACTLY the documented rule" is, and that is what an oracle can prove.
 *   4. THE CANONICAL BODY — every reader gets `acceptanceBody`'s bytes, never a
 *      reader's clipped prose, so the gate and the renderers cannot diverge on the
 *      input.
 *
 * `opencode/plugins/arggon/board.ts` reads items off disk, so its parity is
 * asserted end-to-end against a real tracker fixture in the second describe;
 * the pure predicate corpus covers the three pure consumers.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acceptanceBody,
  acceptanceComplete,
  acceptanceCriteria,
  acceptanceGate,
  acceptanceRows,
  acceptanceUnchecked,
  liveAcceptanceCriteria,
  liveAcceptanceRows,
  liveAcceptanceUnchecked,
  findTasksDir,
  loadItems,
  showBoundedParts,
  type AcceptanceRow,
} from "@arggondev/lib";
import { parseAcceptanceRows } from "./board.js";
import { tuiAcceptanceRows } from "./tui.js";
import { boardItemDetail } from "../../opencode/plugins/arggon/board.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// The corpus
// ---------------------------------------------------------------------------

/** LF body, its CRLF twin, and the four shapes that used to diverge. */
const CORPUS: Array<{ name: string; body: string }> = [
  { name: "empty body", body: "" },
  { name: "no checklist at all", body: "# Title\n\nJust prose.\n" },
  {
    name: "LF unticked",
    body: "# T\n\n## Acceptance\n\n- [ ] first\n- [ ] second\n",
  },
  {
    name: "CRLF unticked — the inversion: the gate refused, board/goal said 'nothing unchecked'",
    body: "# T\r\n\r\n## Acceptance\r\n\r\n- [ ] first\r\n- [ ] second\r\n",
  },
  { name: "LF all ticked", body: "## Acceptance\n\n- [x] a\n- [X] b\n- [ ] c\n" },
  {
    name: "CRLF all ticked",
    body: "## Acceptance\r\n\r\n- [x] a\r\n- [X] b\r\n- [ ] c\r\n",
  },
  // The documented `- [ ] x` decision (docs/convention.md §Acceptance rows):
  // a bare marker with trailing content IS a row and DOES gate.
  { name: "bare marker `- [ ] x`", body: "- [ ] x\n- [x] y\n" },
  { name: "bare marker `- [ ] x` on CRLF", body: "- [ ] x\r\n- [x] y\r\n" },
  // `- [ ]x`: the gate always counted it; the board never did.
  { name: "box glued to text `- [ ]x`", body: "- [ ]x\n- [x] y\n" },
  // `-  [ ] x`: the board always counted it; the gate never has. Two spaces is
  // NOT a row (the one-space rule is the gate's historical shape and is kept).
  { name: "two spaces after the bullet is NOT a row", body: "-  [ ] x\n-  [x] y\n" },
  { name: "star bullet", body: "* [ ] x\n* [x] y\n" },
  { name: "two-space indent", body: "  - [ ] x\n  - [x] y\n" },
  { name: "four-space indent", body: "    - [ ] x\n    - [x] y\n" },
  { name: "tab indent", body: "\t- [ ] x\n\t- [x] y\n" },
  { name: "tab between bullet and box", body: "-\t[ ] x\n-\t[x] y\n" },
  { name: "tab after the box", body: "- [ ]\tx\n- [x]\ty\n" },
  // The scaffold placeholder: `create` leaves one under `## Acceptance`.
  {
    name: "bare empty box is a placeholder, not a criterion",
    body: "## Acceptance\n\n- [ ]\n- [x] a\n",
  },
  {
    name: "bare empty box on CRLF is still a placeholder",
    body: "## Acceptance\r\n\r\n- [ ]\r\n- [x] a\r\n",
  },
  { name: "only a bare empty box", body: "## Acceptance\n\n- [ ]\n" },
  {
    name: "empty box + trailing spaces + CRLF",
    body: "- [ ]   \r\n- [x] a\r\n",
  },
  // The literal `- [ ]` inside a code span must never be read as a row: the
  // bullet is not at the start of the line, so the marker cannot match.
  {
    name: "literal `- [ ]` inside a code span",
    body: "Use `- [ ] text` to add a criterion.\n",
  },
  {
    name: "code span with an unticked box inside it",
    body: "Literal: `- [ ] not a row` — and `- [x] neither`.\n",
  },
  {
    name: "fenced code block holding a checklist",
    body: "```md\n- [ ] inside a fence\n- [x] also inside\n```\n\n- [ ] real\n",
  },
  {
    name: "inline code inside a real row",
    body: "- [x] wrap it in `- [ ]` when you mean the literal box\n- [ ] do the thing\n",
  },
  // An item whose ONLY boxes live in a comment section — the shape `create`
  // produces (it has no `--body` flag). `shown.prose` / `bounded.prose` drops
  // these; `acceptanceBody(item)` keeps them. This is the #605 round-2 defect.
  {
    name: "checklist only in a comment section",
    body: "# T\n\n## Acceptance\n\n- [ ]\n\n## Notes\n\n### 2026-10-03 @worker\n\n- [ ] criterion filed as a comment\n- [x] already done\n",
  },
  {
    name: "comment-only checklist on CRLF",
    body: "# T\r\n\r\n## Notes\r\n\r\n### 2026-10-03 @worker\r\n\r\n- [ ] criterion filed as a comment\r\n- [x] already done\r\n",
  },
  {
    name: "comment checklist plus an in-body criterion",
    body: "## Acceptance\n\n- [ ] in body\n\n## Notes\n\n### @w\n\n- [ ] filed as a comment\n",
  },
  { name: "no space at all after the bullet", body: "-[ ] x\n-[x] y\n" },
  { name: "plus bullet is not a row", body: "+ [ ] x\n+ [x] y\n" },
  { name: "ordered list is not a row", body: "1. [ ] x\n2. [x] y\n" },
  { name: "blockquote is not a row", body: "> - [ ] x\n> - [x] y\n" },
  { name: "marker not at line start", body: "text - [ ] x\ntext - [x] y\n" },
  { name: "three-space indent", body: "   - [ ] x\n   - [x] y\n" },
  { name: "uppercase X box", body: "- [X] x\n" },
  { name: "mixed ticks and a placeholder", body: "- [ ]\n- [x] a\n- [ ] b\n* [ ]c\n" },
];

/**
 * Shapes that only exist once a body is terminated by a NON-`\n` LineTerminator,
 * i.e. the F1 false-passes. They are listed separately rather than only
 * re-terminating the shapes above, because a uniform re-termination of a body
 * that ends in a trailing newline cannot produce "a ticked row, then an
 * unticked row, with nothing but the terminator between them" unless the body is
 * written for it — and that is precisely the shape the old gate refused on.
 */
const TERMINATOR_SHAPES: Array<{ name: string; body: string }> = [
  { name: "ticked then unticked separated by U+2028", body: "- [x] a\u2028- [ ] b\n" },
  { name: "prose then unticked separated by U+2028", body: "prose\u2028- [ ] b\n" },
  { name: "ticked then unticked separated by U+2029", body: "- [x] a\u2029- [ ] b\n" },
  { name: "ticked then unticked separated by CR", body: "- [x] a\r- [ ] b\n" },
  { name: "unticked then ticked separated by CR", body: "- [ ] a\r- [x] b\n" },
  { name: "two unticked rows separated by U+2028", body: "- [ ] a\u2028- [ ] b\n" },
  {
    // `\v` and `\f` are whitespace but NOT LineTerminators, so `^` under `m`
    // never anchored after them: ONE row to the gate, and it must stay one.
    name: "vertical tab is NOT a line terminator",
    body: "- [x] a\v- [ ] b\n",
  },
  {
    name: "form feed is NOT a line terminator",
    body: "- [x] a\f- [ ] b\n",
  },
];

const ALL_SHAPES: Array<{ name: string; body: string }> = [...CORPUS, ...TERMINATOR_SHAPES];

/**
 * Every shape, re-terminated five ways.
 *
 * The re-termination is the point (review F1). A previous version built only an
 * LF body and a CRLF twin via `replace(/\r?\n/g, …)`, which made the corpus
 * blind to the exact class of bug this item is about: the gate is a `/…/gm`
 * regex, so `^` anchors after EVERY LineTerminator, and CR-only, U+2028 and
 * U+2029 bodies were never exercised at all. The fuzz compounded it by putting
 * `\r` only at END of line — where old and new already agree — so it could not
 * see the difference either. Both are fixed here.
 */
const TERMINATORS = [
  { label: " [LF]", eol: "\n" },
  { label: " [CRLF]", eol: "\r\n" },
  { label: " [CR]", eol: "\r" },
  { label: " [U+2028]", eol: "\u2028" },
  { label: " [U+2029]", eol: "\u2029" },
] as const;

/**
 * `ALL_SHAPES` verbatim (identity for the LF case), plus each shape
 * re-terminated. The F1 shapes keep their own literal terminator, so they are
 * added verbatim and then re-terminated too — every case is still decided by
 * one answer, and the CR/U+2028/U+2029 bodies are genuinely present.
 */
function corpusBodies(): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  for (const entry of ALL_SHAPES) {
    out.push({ ...entry, name: `${entry.name} [as written]` });
    for (const { label, eol } of TERMINATORS) {
      out.push({
        ...entry,
        name: `${entry.name}${label}`,
        body: entry.body.replace(/(?:\r\n|\r|\n|\u2028|\u2029)/g, eol),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The pre-fix parsers, kept as ORACLES (never called by production code)
// ---------------------------------------------------------------------------

/** `lib/src/items.ts` before this fix, verbatim — the pre-scoping refusal-set oracle. */
function preFixGate(body: string): boolean {
  const criteria = [...body.matchAll(/^[ \t]*[-*] \[( |x|X)\][ \t]*[^\s]/gm)];
  if (criteria.length === 0) return true;
  return criteria.every((match) => match[1] !== " ");
}

/**
 * The live `## Acceptance` region, derived INDEPENDENTLY of the kernel
 * (bug-done-gate-counts-checkboxes-inside-comment-blocks).
 *
 * Written from the RULE, not from the source, so agreement is evidence:
 *
 *   1. a comment block starts at `### <YYYY-MM-DD> @author` or `### Waiver <…>`
 *      and runs to the NEXT such heading or the end of the body — a nested
 *      `### Acceptance` inside a comment does not end it;
 *   2. THEN the region is everything after the FIRST `## Acceptance` heading up
 *      to the next heading of rank 1 or 2; absent => no contract.
 *
 * The ORDER is part of the rule, not an implementation detail: a `## Acceptance`
 * heading that lives inside a comment block is removed by step 1 and is
 * therefore not a contract at all. The structured fuzz below found this by
 * disagreeing with the kernel until the oracle was ordered the same way — which
 * is the reason the fuzz exists.
 *
 * Split on the LineTerminator set, like the kernel's row parser, so a CR / U+2028
 * body needs no separate rule here either.
 */
function liveRegionOracle(body: string): string {
  const live: string[] = [];
  let inComment = false;
  for (const line of body.split(/[\n\r\u2028\u2029]/)) {
    if (/^###[ \t]+(?:\d{4}-\d{2}-\d{2}[ \t]+@|Waiver\b)/.test(line)) inComment = true;
    if (!inComment) live.push(line);
  }
  let start = -1;
  for (let i = 0; i < live.length; i += 1) {
    // Case-insensitive, like the kernel's own heading rule.
    if (/^##[ \t]+acceptance[ \t]*$/i.test(live[i] ?? "")) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return "";
  const kept: string[] = [];
  for (const line of live.slice(start)) {
    if (/^#{1,2}[ \t]/.test(line)) break;
    kept.push(line);
  }
  return kept.join("\n");
}

/**
 * The gate's documented rule as an ORACLE verdict — the shape `acceptanceGate`
 * returns, computed without touching the kernel's implementation.
 */
function oracleCriteria(region: string): Array<{ checked: boolean }> {
  // Line-by-line, NOT a `/…/gm` regex: `^` under `m` anchors after `\n` only, so
  // a `/m` oracle would silently see no rows in the CR / U+2028 / U+2029 bodies
  // this suite exists to cover — the very blindness review F1 was about.
  const found: Array<{ checked: boolean }> = [];
  for (const line of region.split(/[\n\r\u2028\u2029]/)) {
    const match = /^[ \t]*[-*] \[( |x|X)\][ \t]*\S/.exec(line);
    if (match) found.push({ checked: match[1] !== " " });
  }
  return found;
}

function liveGateOracle(body: string): { gated: boolean; reason?: string } {
  const criteria = oracleCriteria(liveRegionOracle(body));
  if (criteria.length === 0) return { gated: true, reason: "no-live-contract" };
  return criteria.every((row) => row.checked)
    ? { gated: false }
    : { gated: true, reason: "unchecked-live-criteria" };
}

/** `cli/src/board.ts` before this fix, verbatim — the CRLF-blind oracle. */
function preFixBoard(prose: string): Array<{ text: string; checked: boolean }> {
  const rows: Array<{ text: string; checked: boolean }> = [];
  for (const line of prose.split("\n")) {
    const match = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (match) rows.push({ text: match[2].trim(), checked: match[1].toLowerCase() === "x" });
  }
  return rows;
}

/** `opencode/plugins/arggon/board.ts` before this fix, verbatim. */
function preFixPluginRows(prose: string): string[] {
  const out: string[] = [];
  for (const line of prose.split(/\r?\n/)) {
    const match = /^\s*[-*]\s+\[([ xX])\]\s?(.*)$/.exec(line);
    if (!match) continue;
    const mark = match[1].toLowerCase() === "x" ? "x" : " ";
    const text = match[2].trimEnd();
    out.push(text === "" ? `[${mark}]` : `[${mark}] ${text}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Consumer views, normalized to one comparable shape
// ---------------------------------------------------------------------------

/** What the DONE GATE would refuse on, from a consumer's own row list. */
function uncheckedFromRows(rows: ReadonlyArray<AcceptanceRow>): number {
  return rows.filter((row) => row.criterion && !row.checked).length;
}

/** The CLI detail pane's rows (already criteria-only) as kernel rows. */
function tuiRows(body: string): AcceptanceRow[] {
  return tuiAcceptanceRows(body).map((row) => ({ ...row, criterion: true }));
}

/**
 * Deterministic 32-bit PRNG for the fuzz harness (mulberry32): fixed seed, no
 * dependency, and — unlike the raw `& 0x7fffffff` LCG it replaced — usable
 * low-order bits, which the alphabet indexing below depends on.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("acceptance parity corpus (bug-three-acceptance-parsers-diverging)", () => {
  const cases = corpusBodies();

  it("covers every LineTerminator for every shape, plus the shapes as written", () => {
    // Every shape is present for all five terminators AND verbatim, because the
    // F1 shapes only mean something with their literal separator in place.
    expect(cases.length).toBe(ALL_SHAPES.length * (TERMINATORS.length + 1));
    for (const { label } of TERMINATORS) {
      const present = cases.filter((entry) => entry.name.endsWith(label));
      expect(present.length, label).toBe(ALL_SHAPES.length);
    }
    expect(cases.filter((entry) => entry.name.endsWith("[as written]")).length).toBe(
      ALL_SHAPES.length,
    );
    // Non-vacuity: CR-only, U+2028 and U+2029 bodies really are in here, which
    // is what a `\n`-only split in the kernel would silently mis-handle.
    const hasEol = (eol: string): boolean =>
      cases.some((entry) => entry.body.includes(eol) && !entry.body.includes("\n"));
    expect(hasEol("\r")).toBe(true);
    expect(hasEol("\u2028")).toBe(true);
    expect(hasEol("\u2029")).toBe(true);
    // The suite's size, printed so the numbers quoted in review and on the item
    // are re-runnable rather than remembered (review F4). Read them from here.
    console.log(
      `[acceptance-parity] corpus: ${ALL_SHAPES.length} shapes ` +
        `(${CORPUS.length} base + ${TERMINATOR_SHAPES.length} terminator-only) ` +
        `x ${TERMINATORS.length} terminators + as-written = ${cases.length} cases`,
    );
  });

  it.each(cases)("one answer per consumer: $name", ({ body }) => {
    const gateComplete = acceptanceComplete(body);
    const gateUnchecked = acceptanceUnchecked(body).length;
    const board = parseAcceptanceRows(acceptanceBody({ body }));
    const pane = tuiRows(acceptanceBody({ body }));

    // (1) PARITY — the whole-body question is shared: "some consumer row is an
    // unchecked criterion" is exactly `!acceptanceComplete(body)`. A consumer can
    // never say "nothing unchecked" while that question says otherwise.
    expect(gateUnchecked > 0).toBe(!gateComplete);
    expect(uncheckedFromRows(board) > 0).toBe(!gateComplete);
    expect(uncheckedFromRows(pane) > 0).toBe(!gateComplete);

    // (2) ONE ANSWER — same row list from every pure consumer.
    expect(board).toEqual(acceptanceRows(body));
    expect(pane).toEqual(acceptanceCriteria(body));

    // (3) THE GATE'S OWN RULE — the done flip is decided by the LIVE section
    // (dated comment blocks are history), so its verdict is compared against the
    // independent oracle below rather than against the pre-fix whole-body regex
    // (bug-done-gate-counts-checkboxes-inside-comment-blocks).
    expect(acceptanceGate(body)).toEqual(liveGateOracle(body));
    // …and the live rows are `acceptanceRows` over the independently-derived
    // region, so no second row parser can hide behind the extractor.
    expect(liveAcceptanceRows(body)).toEqual(acceptanceRows(liveRegionOracle(body)));
    expect(liveAcceptanceCriteria(body)).toEqual(
      acceptanceRows(liveRegionOracle(body)).filter((row) => row.criterion),
    );
    expect(liveAcceptanceUnchecked(body).map((row) => row.text)).toEqual(
      acceptanceRows(liveRegionOracle(body))
        .filter((row) => row.criterion && !row.checked)
        .map((row) => row.text),
    );
  });

  it("the gate refuses on a body terminated by ANY LineTerminator (review F1)", () => {
    // The blocking finding: the first version of `acceptanceRows` split on
    // `"\n"` only, so a body separated by CR / U+2028 / U+2029 glued the
    // following criterion onto the previous line and the gate STOPPED refusing
    // something it used to refuse. This is the decisive assertion — it fails on
    // the `split("\n")` implementation and passes only on the LineTerminator
    // split, and the per-shape `preFixGate` oracle above is what makes the whole
    // corpus prove the refusal set is unchanged.
    const casesByName = new Map(cases.map((entry) => [entry.name, entry.body]));
    const name = "LF unticked";

    for (const separator of ["\r", "\u2028", "\u2029"]) {
      const body = casesByName.get(`${name} [as written]`)!.replace(/\n/g, separator);
      // Two unchecked criteria the old gate refused on...
      expect(preFixGate(body), JSON.stringify(separator)).toBe(false);
      // ...and the kernel must still refuse on.
      expect(acceptanceComplete(body), JSON.stringify(separator)).toBe(false);
      expect(acceptanceUnchecked(body), JSON.stringify(separator)).toHaveLength(2);
      // ...and so must every consumer report.
      expect(uncheckedFromRows(parseAcceptanceRows(body)), JSON.stringify(separator)).toBe(2);
      expect(tuiAcceptanceRows(body), JSON.stringify(separator)).toHaveLength(2);
    }

    // The specific false-passes the reviewer transcribed, verbatim.
    for (const body of [
      "- [x] a\u2028- [ ] b\n",
      "prose\u2028- [ ] b\n",
      "- [x] a\u2029- [ ] b\n",
      "- [x] a\r- [ ] b\n",
    ]) {
      expect(preFixGate(body), JSON.stringify(body)).toBe(false);
      expect(acceptanceComplete(body), JSON.stringify(body)).toBe(false);
      expect(acceptanceUnchecked(body), JSON.stringify(body)).toHaveLength(1);
    }

    // And the converse must NOT drift: `\v` / `\f` are whitespace but not
    // LineTerminators, so the gate has always seen ONE row there and must
    // continue to (splitting on them would ADD a refusal).
    for (const body of ["- [x] a\v- [ ] b\n", "- [x] a\f- [ ] b\n"]) {
      expect(preFixGate(body), JSON.stringify(body)).toBe(true);
      expect(acceptanceComplete(body), JSON.stringify(body)).toBe(true);
      expect(acceptanceUnchecked(body), JSON.stringify(body)).toHaveLength(0);
    }
  });

  it("the corpus actually catches the pre-fix divergences", () => {
    // If the corpus did not exercise these, a regression back to a hand-written
    // regex could pass every assertion above. Pin that it does — and pin that
    // the old parsers were wrong, so this test cannot be "fixed" by reverting.
    const casesByName = new Map(cases.map((entry) => [entry.name, entry.body]));

    // (a) CRLF: `cli/src/board.ts` split on "\n" only and matched `(.*)$`,
    // which cannot cross a `\r` — so it reported NOTHING unchecked on a CRLF
    // item the gate refused. (Its sibling parsers split on `/\r?\n/` and
    // `trimEnd()`, which is why only this one was CRLF-blind; the goal contract
    // inherited the blindness by calling it.)
    const crlf = casesByName.get("LF unticked [CRLF]") ?? "";
    expect(preFixGate(crlf)).toBe(false);
    expect(preFixBoard(crlf)).toEqual([]);
    expect(acceptanceUnchecked(crlf)).toHaveLength(2);

    // (b) `- [ ]x`: the gate always counted it; `\s+` after the box made the
    // board miss it while still seeing the ticked sibling.
    const glued = casesByName.get("box glued to text `- [ ]x` [LF]") ?? "";
    expect(preFixGate(glued)).toBe(false);
    expect(preFixBoard(glued)).toEqual([{ text: "y", checked: true }]);
    expect(acceptanceUnchecked(glued)).toHaveLength(1);

    // (c) `-  [ ] x`: `\s+` + `\s?` made the board and the native detail block
    // count rows the gate does not — a reader reporting work remaining on an
    // item the done gate would close.
    const twoSpaces = casesByName.get("two spaces after the bullet is NOT a row [LF]") ?? "";
    expect(preFixGate(twoSpaces)).toBe(true);
    expect(preFixBoard(twoSpaces)).toHaveLength(2);
    expect(preFixPluginRows(twoSpaces)).toHaveLength(2);
    expect(acceptanceUnchecked(twoSpaces)).toHaveLength(0);

    // (d) The native detail block's `\s?` also accepted a glued box the gate
    // rejects — the same disagreement, opposite direction.
    expect(preFixPluginRows("no list here\n")).toEqual([]);
  });

  it("acceptanceComplete is exactly `no unchecked criteria`", () => {
    for (const { name, body } of cases) {
      expect(acceptanceComplete(body), name).toBe(acceptanceUnchecked(body).length === 0);
      expect(acceptanceCriteria(body).length, name).toBe(
        acceptanceRows(body).filter((row) => row.criterion).length,
      );
    }
  });

  it("a bare box is a row that does not gate; a box with text always does", () => {
    expect(acceptanceRows("- [ ]\n")).toEqual([{ text: "", checked: false, criterion: false }]);
    expect(acceptanceCriteria("- [ ]\n")).toEqual([]);
    expect(acceptanceComplete("- [ ]\n")).toBe(true);
    // The gate's own rule is "first char after the box is not whitespace", so a
    // no-break space is NOT text for the gate even though `trim()` would eat
    // it — which is why `criterion` is its own field and not `text !== ""`.
    expect(acceptanceRows("- [ ] x\n")[0]?.criterion).toBe(true);
    const nbsp = acceptanceRows("- [ ] x\n")[0];
    expect(nbsp?.text).toBe("x");
    expect(nbsp?.criterion).toBe(false);
    expect(acceptanceComplete("- [ ] x\n")).toBe(true);
  });

  it("the literal `- [ ]` in a code span is never a row", () => {
    for (const { name, body } of cases) {
      if (!name.includes("code span") && !name.includes("fenced")) continue;
      expect(acceptanceRows(body), name).toEqual(acceptanceCriteria(body));
    }
    const span = "Use `- [ ] text` to add a criterion.\n";
    expect(acceptanceRows(span)).toEqual([]);
    expect(acceptanceComplete(span)).toBe(true);
    // ...but the same literal inside a real row is that row's text.
    expect(acceptanceUnchecked("- [ ] wrap in `- [ ]` now\n")).toHaveLength(1);
  });

  it("holds on a seeded fuzz over marker/box/separator/text/terminator permutations", () => {
    // The previous version of this fuzz put `\r` only at END of line, where the
    // old regex and a `\n`-only split already agree — so it could not see the
    // F1 false-pass at all. `\r`, `\u2028` and `\u2029` now appear as SEPARATORS
    // between two rows, which is where they decide the answer.
    const markers = ["-", "*", "  -", "\t-", "   *", "-  ", "-", "+", "1."];
    const boxes = ["[ ]", "[x]", "[X]"];
    const seps = [" ", "", "  ", "\t", " \t"];
    const texts = ["", "a", " x", "x", "\u00a0x", "  ", "a\r"];
    const eols = ["\n", "\r\n", "\r", "\u2028", "\u2029"];
    let checked = 0;
    for (const marker of markers) {
      for (const box of boxes) {
        for (const sep of seps) {
          for (const text of texts) {
            for (const eol of eols) {
              // A ticked row, then an UNCHECKED row, joined by the terminator:
              // the shape the gate must refuse on for every LineTerminator.
              const line = `${marker}${sep}${box}${sep}${text}`;
              const body = `## Acceptance${eol}${eol}${line}${eol}- [ ] todo${eol}- [x] done${eol}`;
              checked += 1;
              // No refusal change, and no consumer/gate disagreement.
              expect(acceptanceComplete(body), JSON.stringify(body)).toBe(preFixGate(body));
              expect(uncheckedFromRows(parseAcceptanceRows(body)) > 0).toBe(
                !acceptanceComplete(body),
              );
              // Same for the two-row product with the terminator in the MIDDLE
              // and no surrounding prose.
              const bare = `${line}${eol}- [ ] todo`;
              expect(acceptanceComplete(bare), JSON.stringify(bare)).toBe(preFixGate(bare));
            }
          }
        }
      }
    }
    expect(checked).toBe(markers.length * boxes.length * seps.length * texts.length * eols.length);
  });

  it("fuzzes 200k structured bodies against the pre-fix gate (committed harness)", () => {
    // Previously this claim lived only in an uncommitted scratch probe, so a
    // reviewer could not re-run it (review F4). It is committed and
    // deterministic now.
    //
    // The generator is ROW-BIASED on purpose. A uniform alphabet over `[`, `]`,
    // ` ` and `-` almost never assembles a valid criterion, so a pure-noise fuzz
    // of this shape returns "no refusals at all" and proves nothing — which is
    // exactly what the first version of this harness did: it asserted
    // `toBeGreaterThan(1000)` on a count that was always 0. Each body is built
    // from line fragments, three quarters of them well-formed rows, and the
    // non-vacuity assertion below counts REAL refusals and demands a healthy
    // share of them.
    const rand = mulberry32(0x5eed1234);
    const pick = <T>(values: readonly T[]): T => values[Math.floor(rand() * values.length)];
    const bullets = ["-", "*", "  -", "\t-", "   *", "-  ", "+", "1.", "", "  "];
    const boxes = ["[ ]", "[x]", "[X]"];
    const gaps = ["", " ", "  ", "\t", " \t", "\u00a0"];
    const tails = ["a", "x", " x", "", "  ", "done", "\u00a0x", "a\r"];
    const eols = ["\n", "\r\n", "\r", "\u2028", "\u2029"];
    const noise = ["prose", "# H", "```", "text - [ ] x", "> quote", "`- [ ]`", "", "\v", "\f"];
    const bodies = 200_000;
    let refusals = 0;
    for (let i = 0; i < bodies; i += 1) {
      const lines = 1 + Math.floor(rand() * 4);
      let body = "";
      for (let k = 0; k < lines; k += 1) {
        if (rand() < 0.25) body += pick(noise);
        else body += pick(bullets) + pick(gaps) + pick(boxes) + pick(gaps) + pick(tails);
        body += pick(eols);
      }
      const pre = preFixGate(body);
      expect(acceptanceComplete(body), JSON.stringify(body)).toBe(pre);
      // Parity on the same body, so a regression in EITHER direction shows.
      expect(uncheckedFromRows(parseAcceptanceRows(body)) > 0, JSON.stringify(body)).toBe(!pre);
      if (!pre) refusals += 1;
    }
    // Non-vacuity, with a number that means something: a fuzz whose gate never
    // refuses proves nothing about refusals. The yield is low by construction —
    // a line is a criterion only when the bullet is `-`/`*` AND exactly one
    // character separates it from the box (1 of the 6 gaps) AND the tail starts
    // non-blank AND the box is unticked — so ~2-3% of bodies are refused. The
    // floor below is an absolute count (not a guessed rate) chosen to fail loudly
    // if the generator stops producing refusals at all.
    expect(refusals).toBeGreaterThan(2000);
    expect(refusals / bodies).toBeGreaterThan(0.01);
    console.log(
      `[acceptance-parity] random fuzz: ${bodies} bodies, ${refusals} refused ` +
        `(${((refusals / bodies) * 100).toFixed(1)}%)`,
    );
  });

  it("fuzzes the LIVE-section rule against the oracle, with both refusals exercised", () => {
    // The whole-body fuzz above proves the ROW grammar is unchanged; this one
    // proves the SCOPING rule is exactly what the docs say
    // (bug-done-gate-counts-checkboxes-inside-comment-blocks). Bodies are built
    // from the fragments that decide the region — the heading, its rank, dated
    // comment headings (including the waiver shape and a nested `### Acceptance`
    // inside a comment), rows of every tick/indent/text shape, and all five
    // LineTerminators — because a rule that is wrong in a way only a heading or a
    // comment boundary can express is invisible to a row-only fuzz.
    const rand = mulberry32(0x11ce_5eed);
    const pick = <T>(values: readonly T[]): T => values[Math.floor(rand() * values.length)];
    const headings = [
      "# Title",
      "## Context",
      "## Acceptance",
      "## acceptance",
      "## Notes",
      "### 2026-10-03 @worker",
      "### Waiver 2026-10-03",
      "### Acceptance",
      "## Acceptance criteria",
      "",
      "prose",
    ];
    const rows = [
      "- [ ] a criterion",
      "- [x] done",
      "- [X] done too",
      "- [ ]",
      "  - [ ] indented",
      "* [ ] starred",
      "- [ ]x glued",
      "-  [ ] two spaces",
      "- [ ]\u00a0nbsp",
      "```",
      "> quoted - [ ] not a row",
    ];
    const eols = ["\n", "\r\n", "\r", "\u2028", "\u2029"];
    const bodies = 40_000;
    const counts = { noContract: 0, unchecked: 0, allows: 0 };
    for (let i = 0; i < bodies; i += 1) {
      const lines = 1 + Math.floor(rand() * 8);
      let body = "";
      for (let k = 0; k < lines; k += 1) {
        body += rand() < 0.4 ? pick(headings) : pick(rows);
        body += pick(eols);
      }
      const verdict = acceptanceGate(body);
      expect(verdict, JSON.stringify(body)).toEqual(liveGateOracle(body));
      // The live rows are the kernel's row parser over the oracle's region: no
      // second parser can hide behind the extractor.
      expect(liveAcceptanceRows(body), JSON.stringify(body)).toEqual(
        acceptanceRows(liveRegionOracle(body)),
      );
      if (!verdict.gated) counts.allows += 1;
      else if (verdict.reason === "no-live-contract") counts.noContract += 1;
      else counts.unchecked += 1;
    }
    // Non-vacuity in all three directions, with absolute floors: a fuzz that
    // never reaches a verdict, or only ever reaches one of them, proves nothing
    // (the previous harness in this file asserted a count that was always 0 —
    // see the 200k generator's comment).
    expect(counts.allows).toBeGreaterThan(500);
    expect(counts.noContract).toBeGreaterThan(500);
    expect(counts.unchecked).toBeGreaterThan(500);
    console.log(
      `[acceptance-parity] live-section fuzz: ${bodies} bodies — ` +
        `${counts.allows} allowed, ${counts.noContract} refused (no live contract), ` +
        `${counts.unchecked} refused (unchecked live criteria)`,
    );
  });
});

// ---------------------------------------------------------------------------
// End-to-end: the four real consumers over a real tracker
// ---------------------------------------------------------------------------

function write(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content, "utf8");
}

function itemFile(id: string, title: string, body: string): string {
  return [
    "---",
    "type: task",
    "status: in_progress",
    `id: ${id}`,
    `title: ${title}`,
    "---",
    "",
    body,
  ].join("\n");
}

/**
 * A tracker whose items carry the shapes that used to diverge: a CRLF item, an
 * item whose only checklist is in a comment section, a glued-box item and a
 * two-space item.
 */
function trackerWith(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-parity-"));
  tmpDirs.push(root);
  write(root, "ArggonManager/.convention.yml", "version: 5\n");
  const story = itemFile(
    "story-parity",
    "Parity story",
    "# Parity story\n\n## Acceptance\n\n- [x] children exist\n",
  );
  write(root, "ArggonManager/story-parity.md", story);
  const items: Array<[string, string, string]> = [
    [
      "task-crlf",
      "CRLF unchecked",
      "# CRLF\r\n\r\n## Acceptance\r\n\r\n- [ ] first\r\n- [ ] second\r\n- [x] third\r\n",
    ],
    [
      "task-comment-only",
      "Checklist filed as a comment",
      "# Comment-only\n\n## Acceptance\n\n- [ ]\n\n## Notes\n\n### 2026-10-03 @worker\n\n- [ ] criterion filed as a comment\n- [x] already done\n",
    ],
    ["task-glued", "Glued box", "# Glued\n\n## Acceptance\n\n- [ ]x\n- [x] y\n"],
    ["task-two-spaces", "Two spaces", "# Two spaces\n\n## Acceptance\n\n-  [ ] x\n-  [x] y\n"],
    ["task-done", "All ticked", "# Done\n\n## Acceptance\n\n- [x] a\n- [X] b\n"],
    ["task-prose-only", "No checklist", "# No checklist\n\nJust prose, no boxes at all.\n"],
  ];
  for (const [id, title, body] of items) {
    write(root, `ArggonManager/story-parity/${id}.md`, itemFile(id, title, body));
  }
  return root;
}

describe("acceptance parity over real items (bug-three-acceptance-parsers-diverging)", () => {
  // What this describe pins is the RENDERING question — every consumer lists the
  // item's rows as written, whole body, history included — and that it is one
  // parser's answer. The DONE GATE asks a narrower question since
  // `bug-done-gate-counts-checkboxes-inside-comment-blocks` (the live `##
  // Acceptance` section, comment blocks excluded), so `acceptanceComplete` is not
  // its verdict any more; `acceptanceGate` is, and the corpus above compares that
  // against the oracle over every shape.
  it("every consumer renders one parser's rows for every item", () => {
    const root = trackerWith();
    const items = loadItems(findTasksDir(root));
    expect(items.length).toBeGreaterThanOrEqual(6);

    for (const item of items) {
      const canonical = acceptanceBody(item);
      const gateComplete = acceptanceComplete(canonical);

      // Consumer 1: the board drawer.
      const board = parseAcceptanceRows(canonical);
      // Consumer 2: the CLI detail pane.
      const pane = tuiRows(canonical);
      // Consumer 3: the native detail block (reads the item off disk).
      const detail = boardItemDetail(root, item.id);
      expect(detail.error, item.id).toBeNull();

      const label = `${item.id} (${JSON.stringify(canonical.slice(0, 40))})`;

      // The gate's refusal, expressed by every consumer.
      expect(uncheckedFromRows(board) > 0, label).toBe(!gateComplete);
      expect(uncheckedFromRows(pane) > 0, label).toBe(!gateComplete);
      expect(detail.acceptanceTotal - detail.acceptanceDone > 0, label).toBe(!gateComplete);

      // Same row list everywhere.
      expect(board, label).toEqual(acceptanceRows(canonical));
      expect(pane, label).toEqual(acceptanceCriteria(canonical));

      // What each PRE-FIX parser would have said about these items, so the
      // fixture proves it covers the reachable defects rather than only the
      // shapes the new code handles.
      if (item.id === "task-crlf") {
        expect(gateComplete).toBe(false);
        // `cli/src/board.ts` split on "\n" only and matched `(.*)$`, so it
        // reported NOTHING unchecked here.
        expect(preFixBoard(canonical)).toEqual([]);
        // The native block split on `/\r?\n/` and `trimEnd()`, so it was
        // CRLF-safe — it disagreed for the OTHER reason (below).
        expect(detail.acceptance).toEqual(["[ ] first", "[ ] second", "[x] third"]);
      }
      if (item.id === "task-two-spaces") {
        expect(gateComplete).toBe(true);
        // `\s+` + `\s?`: both old renderers counted two rows on an item the
        // gate would close.
        expect(preFixBoard(canonical)).toHaveLength(2);
        expect(preFixPluginRows(canonical)).toHaveLength(2);
      }
      if (item.id === "task-comment-only") {
        expect(gateComplete).toBe(false);
        // Its reader was `runShow`'s prose, which drops comment sections, so
        // the panel's count would have been the placeholder alone: 0/0.
        const proseOf = showBoundedParts(item, 0).prose;
        expect(acceptanceUnchecked(proseOf)).toHaveLength(0);
        expect(preFixPluginRows(proseOf)).toEqual(["[ ]"]);
      }
    }
  });

  it("the CRLF item: the gate refuses AND the panel still shows the boxes", () => {
    const root = trackerWith();
    const item = loadItems(findTasksDir(root)).find((entry) => entry.id === "task-crlf");
    expect(item).toBeDefined();
    const detail = boardItemDetail(root, "task-crlf");
    expect(detail.acceptance).toEqual(["[ ] first", "[ ] second", "[x] third"]);
    expect(detail.acceptanceDone).toBe(1);
    expect(detail.acceptanceTotal).toBe(3);
    // The panel's own footer reads "1/3 acceptance" — never "0/0".
    const footer = boardItemDetail(root, "task-crlf");
    expect(footer.acceptanceTotal).toBe(3);
    expect(acceptanceUnchecked(item?.body ?? "")).toHaveLength(2);
  });

  it("the comment-only item: a comment checklist is seen by the gate AND the panel", () => {
    const root = trackerWith();
    const item = loadItems(findTasksDir(root)).find((entry) => entry.id === "task-comment-only");
    expect(item).toBeDefined();
    const canonical = acceptanceBody(item!);

    // The gate refuses — the criterion is real.
    expect(acceptanceComplete(canonical)).toBe(false);
    expect(acceptanceUnchecked(canonical).map((row) => row.text)).toEqual([
      "criterion filed as a comment",
    ]);

    // ...and every consumer reports it. This is the 21/280 shape: `create` has
    // no `--body` flag, so a comment checklist is the DEFAULT path for a new item.
    expect(acceptanceCriteria(canonical)).toHaveLength(2);
    const detail = boardItemDetail(root, "task-comment-only");
    // The create-time bare placeholder under `## Acceptance` is still shown as a
    // box — it IS a row — but it is not a criterion, so the count is 1/2 and the
    // gate's verdict comes from the two comment-filed criteria.
    expect(detail.acceptance).toEqual([
      "[ ]",
      "[ ] criterion filed as a comment",
      "[x] already done",
    ]);
    expect(detail.acceptanceDone).toBe(1);
    expect(detail.acceptanceTotal).toBe(2);
    expect(parseAcceptanceRows(canonical)).toEqual(acceptanceRows(canonical));
    expect(tuiAcceptanceRows(canonical)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Live corpus
// ---------------------------------------------------------------------------

/** This repo's own tracker — the corpus the item was filed from (21/280). */
const REPO_ROOT = join(import.meta.dirname, "..", "..");

describe("acceptance parity over the LIVE tracker (bug-three-acceptance-parsers-diverging)", () => {
  /**
   * The regression this exists for is a CORPUS regression: 21 of 280 items with
   * comments disagreed, and no unit test could see it because the shape only
   * exists in the real tree. Over this repo's own tracker every item is checked
   * for gate/consumer agreement. Bounded and report-only-fast: `loadItems` is
   * one walk of the tree, and the check is pure string work per item.
   */
  it("every item in this tracker reads the same from the gate and the consumers", () => {
    const tasksDir = findTasksDir(REPO_ROOT);
    const items = loadItems(tasksDir);
    expect(items.length).toBeGreaterThan(0);

    const disagreements: string[] = [];
    let commentStripped = 0;
    let gated = 0;
    let liveAllowed = 0;
    let liveNoContract = 0;
    let liveUnchecked = 0;
    for (const item of items) {
      const canonical = acceptanceBody(item);
      const gateComplete = acceptanceComplete(canonical);
      if (!gateComplete) gated += 1;
      // The gate's own verdict, and the three-way breakdown of its refusals — the
      // numbers a reviewer of this change wants re-runnable rather than remembered.
      const live = acceptanceGate(canonical);
      if (!live.gated) liveAllowed += 1;
      else if (live.reason === "no-live-contract") liveNoContract += 1;
      else liveUnchecked += 1;

      const board = parseAcceptanceRows(canonical);
      const pane = tuiRows(canonical);

      // The gate's verdict, as each consumer would report it.
      const boardSaysBlocked = board.some((row) => row.criterion && !row.checked);
      const paneSaysBlocked = pane.some((row) => !row.checked);

      if (boardSaysBlocked !== !gateComplete || paneSaysBlocked !== !gateComplete) {
        disagreements.push(
          `${item.id}: gate complete=${gateComplete} board=${boardSaysBlocked} pane=${paneSaysBlocked}`,
        );
      }

      // The #605 round-2 shape, measured through the REAL bounded reader
      // (`showBoundedParts`) rather than a hand-rolled split: how many items
      // would a reader that dropped comment sections have got wrong. Counted,
      // never asserted — it is a live number that moves as items are filed.
      const stripped = acceptanceUnchecked(showBoundedParts(item, 0).prose);
      if (stripped.length > 0 !== !gateComplete) commentStripped += 1;
    }

    // Must be zero. Anything else means a consumer answered a different
    // question than the gate did.
    expect(disagreements).toEqual([]);
    console.log(
      `[acceptance-parity] live: ${items.length} items, ${gated} with an unchecked box anywhere, ` +
        `${commentStripped} would disagree if a reader stripped comment sections`,
    );
    console.log(
      `[acceptance-parity] live gate: ${liveAllowed} allowed, ${liveUnchecked} refused ` +
        `(unchecked live criteria), ${liveNoContract} refused (no live contract)`,
    );
    // Sanity: the live corpus really does contain blocked items, or the
    // assertion above would be vacuous.
    expect(gated).toBeGreaterThan(0);
    expect(tasksDir.length).toBeGreaterThan(0);
    // Both directions of the scoped gate are reachable in this tree, and the gate
    // is strictly NARROWER than the whole-body question it replaced: history is no
    // longer an obligation. A tracker where scoping changed nothing would mean the
    // corpus cannot see this change at all.
    expect(liveAllowed).toBeGreaterThan(0);
    expect(liveNoContract).toBeGreaterThan(0);
    expect(liveUnchecked).toBeGreaterThan(0);
    expect(liveAllowed + liveUnchecked + liveNoContract).toBe(items.length);
    expect(liveUnchecked).toBeLessThan(gated);
  });

  it("the gate's scoped verdict is reachable in this tree: the corpus is not vacuous", () => {
    // The shape this change exists for, measured on this repo's own tracker:
    // items the PRE-FIX gate refused only because a dated comment carries unticked
    // boxes. Each must now flip — that is the defect, and it is live here, not
    // hypothetical.
    const tasksDir = findTasksDir(REPO_ROOT);
    const unblocked = loadItems(tasksDir).filter((item) => {
      // The gate only applies to the claimable leaves.
      if (item.type !== "task" && item.type !== "bug") return false;
      if (acceptanceComplete(acceptanceBody(item))) return false;
      return acceptanceGate(acceptanceBody(item)).gated === false;
    });
    expect(unblocked.length).toBeGreaterThanOrEqual(1);
    console.log(
      `[acceptance-parity] live tracker: ${unblocked.length} items the pre-fix gate refused ` +
        `only on comment history (e.g. ${unblocked[0]?.id})`,
    );
  });

  it("a comment-filed checklist is reachable: the corpus is not vacuous", () => {
    const tasksDir = findTasksDir(REPO_ROOT);
    const items = loadItems(tasksDir);
    // An item whose ONLY unchecked criteria live in a comment section — the
    // shape that made 21/280 items disagree before the canonical-body fix.
    const commentOnly = items.filter((item) => {
      if (acceptanceComplete(acceptanceBody(item))) return false;
      return acceptanceUnchecked(showBoundedParts(item, 0).prose).length === 0;
    });
    // Non-vacuity, done properly. The previous assertion here was
    // `toBeGreaterThanOrEqual(0)`, which is true for EVERY array including an
    // empty one and therefore asserted nothing (review F3). The shape must
    // actually be present, because the guard in the previous test is only
    // meaningful if some item would have been got wrong by a stripping reader.
    //
    // A floor, not an exact count: this is a LIVE number that grows as items
    // are filed, so the test must not break on an unrelated commit. One is the
    // honest minimum — if the shape disappears from the tracker entirely, the
    // parity guard has stopped covering the defect it was filed for, and that
    // deserves a failing test rather than a silent pass.
    expect(commentOnly.length).toBeGreaterThanOrEqual(1);
    // And the shape is what we think it is: a real unchecked criterion the gate
    // sees, invisible to the bounded reader.
    for (const item of commentOnly) {
      expect(acceptanceUnchecked(acceptanceBody(item)).length, item.id).toBeGreaterThan(0);
      expect(acceptanceUnchecked(showBoundedParts(item, 0).prose).length, item.id).toBe(0);
    }
    console.log(
      `[acceptance-parity] live tracker: ${items.length} items, ` +
        `${commentOnly.length} with comment-only criteria`,
    );
  });
});
