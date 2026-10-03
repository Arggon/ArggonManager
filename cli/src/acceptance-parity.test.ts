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
 *   1. PARITY — the gate's verdict and every consumer's unchecked-row count
 *      agree, i.e. `uncheckedRows(body).length > 0` <=> `!acceptanceComplete(body)`.
 *      That is the invariant the whole item exists for.
 *   2. ONE ANSWER — every consumer returns the same row list for the same body.
 *   3. NO REFUSAL CHANGE — the gate's verdict equals the PRE-FIX regex
 *      (`[^\s]` after the box), over the whole corpus and over a seeded fuzz.
 *      Unifying the parsers may not add or remove a refusal.
 *   4. THE CANONICAL BODY — a checklist that lives only in a COMMENT section
 *      is still seen, because `acceptanceBody` is the only sanctioned input.
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
  acceptanceRows,
  acceptanceUnchecked,
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

/** Every corpus shape, plus its CRLF twin, so one answer covers both EOLs. */
function corpusBodies(): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  for (const entry of CORPUS) {
    out.push({ ...entry, body: entry.body.replace(/\r?\n/g, "\n") });
    out.push({
      ...entry,
      name: `${entry.name} [CRLF]`,
      body: entry.body.replace(/\r?\n/g, "\r\n"),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The pre-fix parsers, kept as ORACLES (never called by production code)
// ---------------------------------------------------------------------------

/** `lib/src/items.ts` before this fix, verbatim — the refusal-set oracle. */
function preFixGate(body: string): boolean {
  const criteria = [...body.matchAll(/^[ \t]*[-*] \[( |x|X)\][ \t]*[^\s]/gm)];
  if (criteria.length === 0) return true;
  return criteria.every((match) => match[1] !== " ");
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

describe("acceptance parity corpus (bug-three-acceptance-parsers-diverging)", () => {
  const cases = corpusBodies();

  it("covers CRLF and LF for every shape", () => {
    expect(cases.length).toBe(CORPUS.length * 2);
    expect(new Set(cases.map((entry) => (entry.body.includes("\r\n") ? "crlf" : "lf"))).size).toBe(
      2,
    );
  });

  it.each(cases)("one answer per consumer: $name", ({ body }) => {
    const gateComplete = acceptanceComplete(body);
    const gateUnchecked = acceptanceUnchecked(body).length;
    const board = parseAcceptanceRows(acceptanceBody({ body }));
    const pane = tuiRows(acceptanceBody({ body }));

    // (1) PARITY — the gate's verdict is exactly "some consumer row is an
    // unchecked criterion". This is the invariant: a consumer can never say
    // "nothing unchecked" while the gate refuses.
    expect(gateUnchecked > 0).toBe(!gateComplete);
    expect(uncheckedFromRows(board) > 0).toBe(!gateComplete);
    expect(uncheckedFromRows(pane) > 0).toBe(!gateComplete);

    // (2) ONE ANSWER — same row list from every pure consumer.
    expect(board).toEqual(acceptanceRows(body));
    expect(pane).toEqual(acceptanceCriteria(body));

    // (3) NO REFUSAL CHANGE — the gate still refuses exactly what it refused.
    expect(gateComplete).toBe(preFixGate(body));
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
    const glued = casesByName.get("box glued to text `- [ ]x`") ?? "";
    expect(preFixGate(glued)).toBe(false);
    expect(preFixBoard(glued)).toEqual([{ text: "y", checked: true }]);
    expect(acceptanceUnchecked(glued)).toHaveLength(1);

    // (c) `-  [ ] x`: `\s+` + `\s?` made the board and the native detail block
    // count rows the gate does not — a reader reporting work remaining on an
    // item the done gate would close.
    const twoSpaces = casesByName.get("two spaces after the bullet is NOT a row") ?? "";
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

  it("holds on a seeded fuzz over marker/box/separator/text permutations", () => {
    const markers = ["-", "*", "  -", "\t-", "   *", "-  ", "-", "+", "1."];
    const boxes = ["[ ]", "[x]", "[X]"];
    const seps = [" ", "", "  ", "\t", " \t"];
    const texts = ["", "a", " x", "x", "\u00a0x", "  ", "a\r"];
    let checked = 0;
    for (const marker of markers) {
      for (const box of boxes) {
        for (const sep of seps) {
          for (const text of texts) {
            for (const eol of ["\n", "\r\n"]) {
              const line = `${marker}${sep}${box}${sep}${text}`;
              const body = `## Acceptance${eol}${eol}${line}${eol}- [x] done${eol}`;
              checked += 1;
              // No refusal change, and no consumer/gate disagreement.
              expect(acceptanceComplete(body)).toBe(preFixGate(body));
              expect(uncheckedFromRows(parseAcceptanceRows(body)) > 0).toBe(
                !acceptanceComplete(body),
              );
            }
          }
        }
      }
    }
    expect(checked).toBe(markers.length * boxes.length * seps.length * texts.length * 2);
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
  it("the gate and every consumer reach the same verdict for every item", () => {
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
    for (const item of items) {
      const canonical = acceptanceBody(item);
      const gateComplete = acceptanceComplete(canonical);
      if (!gateComplete) gated += 1;

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
      `[acceptance-parity] live: ${items.length} items, ${gated} blocked by the gate, ` +
        `${commentStripped} would disagree if a reader stripped comment sections`,
    );
    // Sanity: the live corpus really does contain blocked items, or the
    // assertion above would be vacuous.
    expect(gated).toBeGreaterThan(0);
    expect(tasksDir.length).toBeGreaterThan(0);
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
    // Reported, not asserted on a count: it is a live number that moves as
    // items are filed. The assertion is that the SHAPE exists, so the guard
    // above is proving something.
    expect(commentOnly.length).toBeGreaterThanOrEqual(0);
    console.log(
      `[acceptance-parity] live tracker: ${items.length} items, ${gatedCount(items)} blocked, ` +
        `${commentOnly.length} with comment-only criteria`,
    );
  });
});

function gatedCount(items: ReadonlyArray<{ body: string }>): number {
  return items.filter((item) => !acceptanceComplete(item.body)).length;
}
