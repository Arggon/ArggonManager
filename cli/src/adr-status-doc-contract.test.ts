/**
 * Carrier ↔ ADR-status doc contract (bug-engineering-doc-stale-adr-statuses).
 *
 * `ArggonManager/docs/engineering.md` is a methodology carrier: it restates
 * facts whose authority lives somewhere else. One of those facts is an ADR's
 * STATUS, and the restatement drifted — `engineering.md:230` labelled ADR 0003
 * "(Proposed)" while `docs/adr/0003-milestone-field.md` said `Accepted`, because
 * commit c0cdd60b accepted ADRs 0002/0003/0004 in their files and never came
 * back for the carriers. The same drift hit the [ADR index](./README.md) twice
 * (05b31fb6, then c0cdd60b again) before `adr-index-parity.test.ts` pinned it.
 *
 * The failure mode is structural, not clerical: a status stated in prose is a
 * second source of truth, so it must be re-edited by hand every time a decision
 * is accepted or superseded. It was missed twice because nothing failed. This
 * suite does not "fix the number" — it removes the surface:
 *
 *   1. NO RESTATEMENT. A carrier may link to an ADR; it may not say what status
 *      that ADR is in. The rule is checked over each reference's REGION — the
 *      prose before the link, the link's own text, and the clause after it — so
 *      all three places a status is naturally written are read: `milestone field
 *      (Proposed): [ADR 0003](…)` (the defect's own shape, before the link),
 *      `[ADR 0003 (Proposed)](…)` (inside the link text) and `[ADR 0003](…)
 *      (Proposed)` (after it). A scan of the link text alone would pass
 *      vacuously over the very sentence it exists to catch, and a scan of the
 *      preceding prose alone misses the trailing form. The clause after a link
 *      stops at a sentence/comma/list boundary, so a long prose line's later
 *      sentences are not read as claims about the ADR. The lifecycle vocabulary
 *      in §ADR process (`Proposed in a PR → Accepted on merge`) carries no ADR
 *      reference, so it is prose about the PROCESS and does not fire.
 *   2. LINKS RESOLVE, AND THE NUMBER IS THE FILENAME'S. Every `./adr/NNNN-…`
 *      reference in the carrier must point at a real ADR file whose name
 *      carries the same number — so renaming or renumbering an ADR (0015 was
 *      renamed to `0015-done-gate-acceptance-waiver.md`, 0020 was renumbered)
 *      breaks the build instead of leaving a dead link in a carrier.
 *
 * A status word found by rule 1 is reported together with the ADR file's OWN
 * status, so the author is handed the truth in the failure message instead of
 * only being told the carrier is wrong. The ADR files are the authority — the
 * carrier mirrors them, it does not decide (the posture
 * `adr-index-parity.test.ts` takes over the index).
 *
 * Premise guards matter here more than usual: after this suite landed the real
 * carriers are CLEAN, so rule 1's `problems` array is legitimately empty and an
 * ordinary assertion on it would prove nothing about the scanner. The first
 * test therefore runs the scanner over synthetic carrier text — the exact
 * pre-fix sentence, and each of the three shapes a status can take around a
 * link — and asserts it finds what it must and ignores what it must not.
 *
 * The §ADR process sentence in `engineering.md` NAMES the carriers each rule
 * covers, which makes the doc and the two constants the same fact stated twice.
 * One test reads the sentence back out of the doc and asserts it names exactly
 * the carriers the rules iterate, so neither side can narrow alone: the failure
 * mode this suite exists to prevent is a document claiming coverage the code
 * does not have, and that failure is in the code's own file header as much as in
 * the prose.
 *
 * Scope: rule 1 covers all three methodology carriers (`STATUS_CARRIERS`).
 * Rule 2 covers `engineering.md` only (`LINK_CARRIERS`), because
 * `convention.md:124` links to `./adr/0015-done-gate.md`, a file that no longer
 * exists — a dead link owned by
 * `ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-convention-md-links-nonexistent-adr-0015.md`,
 * and the reason both constants are separate. ADRs, plans, specs, explorations
 * and tracker items are deliberately NOT pinned: they are dated records of what
 * was true when written, and this repo supersedes rather than rewrites them.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const docsDir = join(repoRoot, "ArggonManager/docs");
const adrDir = join(docsDir, "adr");

/**
 * Rule 1's carriers: every methodology carrier, because a carrier is a place a
 * status is tempted into and this rule is the whole point. `engineering.md`,
 * `agents.md` and `convention.md` are all clean on the field today, so the three
 * cost nothing.
 */
const STATUS_CARRIERS: readonly string[] = [
  "ArggonManager/docs/engineering.md",
  "ArggonManager/docs/agents.md",
  "ArggonManager/docs/convention.md",
];

/**
 * Rule 2's carriers: narrower, deliberately. `convention.md:124` links
 * `./adr/0015-done-gate.md`, which does not exist (the file is
 * `0015-done-gate-acceptance-waiver.md`), so rule 2 would fail on it today.
 * That dead link is
 * `ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-convention-md-links-nonexistent-adr-0015.md`;
 * adding `convention.md` here is a one-line change once it lands. Rule 2 is not
 * split per-carrier anywhere else — a status restated in a carrier this list
 * omits is still caught by rule 1.
 */
const LINK_CARRIERS: readonly string[] = ["ArggonManager/docs/engineering.md"];

/** `./adr/0003-milestone-field.md` — the ADR index link `./adr/README.md` is not one. */
const ADR_LINK = /\(\.\/adr\/(\d{4})-([a-z0-9-]+)\.md\)/g;

/**
 * Delimiters that end one ADR reference's label region and start the next.
 * `·` separates the items of a pointer list, `|` a table cell, and a newline
 * ends the line; `:` is deliberately NOT one, because the defect's own shape is
 * `milestone field (Proposed): [ADR 0003](…)`.
 */
const LABEL_DELIMITERS = /[·|\n]/;

/**
 * Where the TRAILING window of a reference stops: the first of a sentence end, a
 * comma, a list delimiter or a line break. Without this the window would run to
 * the end of the line, and a long prose line would drag unrelated text into a
 * status check — `agents.md:473` continues for hundreds of characters past its
 * ADR links, so a window that wide would report prose that has nothing to do
 * with any ADR's status. A status for a specific ADR is written as a short
 * appositive right after its link — `(Proposed)`, `— superseded by 0011` — so one
 * clause is the whole shape worth reading.
 */
const TAIL_STOPS = /[·|,\n]|\.\s/;

interface CarrierReference {
  /** `0003` */
  number: string;
  /**
   * The reference's region on both sides of its link: prose before it, the
   * link's own text, and the clause after it. The link target is stripped. This
   * is where a status of THAT ADR would be written, which is why all three
   * shapes are read and all three are pinned in the premise test.
   */
  label: string;
  /** The `./adr/…` target as written. */
  target: string;
}

/**
 * The status vocabulary, matched as whole words and only inside a label region.
 * Deliberately the same word list `adr-index-parity.test.ts` classifies index
 * rows with, so a carrier and an index row cannot disagree about what counts as
 * a status: longest-first, or `Partially superseded` reads as `Superseded`.
 */
const STATUS_WORDS: readonly RegExp[] = [
  /\bpartially superseded\b/i,
  /\bsuperseded\b/i,
  /\baccepted\b/i,
  /\bproposed\b/i,
  /\brejected\b/i,
  /\bdeprecated\b/i,
];

function read(relative: string): string {
  return readFileSync(join(repoRoot, relative), "utf8");
}

/** `NNNN-short-title.md` present in `docs/adr/` — the authority for a link. */
function adrFiles(): string[] {
  return readdirSync(adrDir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort();
}

/**
 * Every ADR reference in `source`, in order, with the region a status claim
 * about THAT ADR would be written into — on either side of its link. Pure over
 * its input so the premise test can run it over synthetic text.
 */
function adrReferences(source: string): CarrierReference[] {
  const references: CarrierReference[] = [];
  for (const line of source.split("\n")) {
    const matches = [...line.matchAll(ADR_LINK)];
    for (const [index, match] of matches.entries()) {
      const at = match.index!;
      const end = at + match[0].length;
      const from = index === 0 ? 0 : matches[index - 1]!.index! + matches[index - 1]![0].length;
      // Before the link: prose plus the link's own text (`[ADR 0003 (Proposed)]`),
      // narrowed to the segment nearest the link — a status is written about the
      // ADR it is next to, not about the previous list item.
      const head = line.slice(from, at).split(LABEL_DELIMITERS).pop() ?? "";
      // After the link: one clause, stopping at the next ADR reference, a list
      // delimiter or a sentence/comma boundary. Reading no trailing text at all is
      // the hole a restatement written `… [ADR 0003](…) (Proposed)` slips through.
      const until = matches[index + 1]?.index ?? line.length;
      const tail = line.slice(end, until).split(TAIL_STOPS)[0] ?? "";
      references.push({
        number: match[1]!,
        label: `${head} ${tail}`.trim(),
        target: `./adr/${match[1]}-${match[2]}.md`,
      });
    }
  }
  return references;
}

/** The status words stated in `label`, de-duplicated, in order. */
function statedStatuses(label: string): string[] {
  const found: string[] = [];
  for (const word of STATUS_WORDS) {
    const match = label.match(word);
    if (match && !found.includes(match[0])) found.push(match[0]);
  }
  return found;
}

/**
 * The status the ADR file itself declares, for a failure message that carries
 * the truth rather than only the complaint.
 */
function declaredStatus(file: string): string {
  const line = readFileSync(join(adrDir, file), "utf8").match(
    /^-\s*\*{0,2}Status\*{0,2}:\s*(.+)$/m,
  );
  return line?.[1]?.trim() ?? "(no - Status: line)";
}

/**
 * The §ADR process coverage statement about this very suite, read back out of
 * the doc: `Coverage: status restatement in <carriers>; link resolution in
 * <carriers>.` The doc naming the carriers it covers and the two constants
 * naming the carriers the suite covers are the SAME fact stated twice, so one of
 * them drifting has to fail a test — otherwise the sentence goes back to
 * claiming coverage the suite does not have, which is the shape of the defect
 * this suite exists to prevent (and of the defect this PR originally wrote). The
 * delimiters are ASCII on purpose: the sentence is prose, and a parse that
 * depended on an em dash or a curly quote would fail for reasons no reader could
 * act on.
 */
const COVERAGE_CLAIM = "**Coverage: status restatement in ";
const LINK_COVERAGE_CLAIM = "; link resolution in ";

/** The one paragraph in `file` containing `anchor`; more or fewer fails. */
function paragraphWith(file: string, anchor: string): string {
  const found = read(file)
    .split(/\n[ \t]*\n/)
    .filter((paragraph) => paragraph.includes(anchor));
  expect(
    found.length,
    `${file}: expected exactly one paragraph containing "${anchor}", found ${found.length} — ` +
      "keep this suite's anchor together with the sentence it pins",
  ).toBe(1);
  return found[0]!;
}

/** Backticked `.md` filenames in `clause`, as paths this suite would use. */
function carriersNamedIn(clause: string): string[] {
  return [...clause.matchAll(/`([^`]*\.md)`/g)].map((match) => `ArggonManager/docs/${match[1]}`);
}

describe("the carrier pins ADR references to the ADR files", () => {
  it("finds ADR references and status claims in carrier text (premise)", () => {
    // With the real carrier clean, rule 1 below would pass whether or not the
    // scanner works. These two assertions are the evidence that it does: the
    // exact sentence that shipped the bug is detected, and the lifecycle
    // vocabulary it must NOT detect is ignored.
    const before = adrReferences(
      "- CLI stack: [ADR 0001](./adr/0001-cli-stack.md) · milestone field (Proposed): " +
        "[ADR 0003](./adr/0003-milestone-field.md) · review smoke gate: " +
        "[ADR 0008](./adr/0008-review-smoke-gate.md)",
    );
    expect(before).toHaveLength(3);
    expect(before.map((reference) => reference.number)).toEqual(["0001", "0003", "0008"]);
    expect(statedStatuses(before[0]!.label)).toEqual([]);
    expect(statedStatuses(before[1]!.label)).toEqual(["Proposed"]);
    expect(statedStatuses(before[2]!.label)).toEqual([]);

    // §ADR process states the lifecycle in the same vocabulary with no ADR link
    // in its label region, so it is prose about the process, not a claim about
    // any one ADR.
    expect(
      statedStatuses(
        adrReferences("Proposed in a PR → Accepted on merge")
          .map((r) => r.label)
          .join(" | "),
      ),
    ).toEqual([]);
    // An ADR index link is not an ADR reference at all.
    expect(adrReferences("the [ADR index](./adr/README.md) is the register")).toEqual([]);

    // A status can be written on either side of the link, or inside its text.
    // All three shapes must be pinned HERE, not only in a drift simulation: a
    // scanner narrowed to one shape leaves the rule below passing over a carrier
    // the same PR cleaned, so a lost half of the region is invisible unless an
    // assertion names it.
    const one = (line: string) => statedStatuses(adrReferences(line)[0]!.label);
    expect(one("- x: milestone (Proposed): [ADR 0003](./adr/0003-milestone-field.md)")).toEqual([
      "Proposed",
    ]);
    expect(one("- x: [ADR 0003 (Proposed)](./adr/0003-milestone-field.md)")).toEqual(["Proposed"]);
    expect(one("- x: [ADR 0003](./adr/0003-milestone-field.md) (Proposed)")).toEqual(["Proposed"]);
    // …and the clause AFTER a link stops where unrelated prose begins, so a long
    // line's later sentences are not read as claims about the ADR.
    expect(
      one(
        "- x: [ADR 0011](./adr/0011-native-first-architecture.md) is the contract, and " +
          "a change is accepted only once it is explicitly recorded.",
      ),
    ).toEqual([]);
    // A status belonging to a DIFFERENT ADR's clause is not this ADR's claim:
    // the `·` separates the list items, so ADR 0001 does not inherit 0003's word.
    expect(
      statedStatuses(
        adrReferences(
          "- a: [ADR 0001](./adr/0001-cli-stack.md) · b (Proposed): " +
            "[ADR 0003](./adr/0003-milestone-field.md)",
        )[0]!.label,
      ),
    ).toEqual([]);
  });

  it("reads a non-empty ADR directory whose files all declare a status (premise)", () => {
    const files = adrFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((file) => declaredStatus(file) === "(no - Status: line)")).toEqual([]);
  });

  it("covers exactly the carriers the §ADR process sentence says it covers", () => {
    const paragraph = paragraphWith("ArggonManager/docs/engineering.md", COVERAGE_CLAIM);
    const from = paragraph.indexOf(COVERAGE_CLAIM) + COVERAGE_CLAIM.length;
    const linkFrom = paragraph.indexOf(LINK_COVERAGE_CLAIM);
    expect(
      carriersNamedIn(paragraph.slice(from, linkFrom)).sort(),
      "rule 1: doc vs constant",
    ).toEqual([...STATUS_CARRIERS].sort());
    expect(
      carriersNamedIn(
        paragraph.slice(linkFrom + LINK_COVERAGE_CLAIM.length, paragraph.length),
      ).sort(),
      "rule 2: doc vs constant",
    ).toEqual([...LINK_CARRIERS].sort());
  });

  it.each(STATUS_CARRIERS)("%s states no status for any ADR it links to", (carrier) => {
    const files = new Set(adrFiles());
    const problems: string[] = [];
    let references = 0;
    for (const reference of adrReferences(read(carrier))) {
      references += 1;
      const stated = statedStatuses(reference.label);
      if (stated.length === 0) continue;
      // Report the file's own status: the author is told what it actually is,
      // not merely that the carrier is wrong.
      const file = [...files].find((name) => name.startsWith(`${reference.number}-`));
      problems.push(
        `${carrier}: labels ADR ${reference.number} "${stated.join('", "')}" — ` +
          `${file ? `docs/adr/${file} says "${declaredStatus(file)}"` : "that ADR does not exist"}; ` +
          "carriers link to an ADR, they do not restate its status",
      );
    }
    // A carrier that linked no ADR at all would make the rule vacuous.
    expect(references, `${carrier}: expected at least one ADR reference to pin`).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it.each(LINK_CARRIERS)("%s links only to ADRs that exist, by their own filename", (carrier) => {
    const files = new Set(adrFiles());
    const problems: string[] = [];
    for (const reference of adrReferences(read(carrier))) {
      const resolved = resolve(docsDir, reference.target);
      if (!existsSync(resolved)) {
        const actual = [...files].filter((name) => name.startsWith(`${reference.number}-`));
        problems.push(
          `${carrier}: links ${reference.target}, which does not exist` +
            (actual.length > 0 ? ` — docs/adr/${actual.join(", docs/adr/")} does` : ""),
        );
        continue;
      }
      const stem = reference.target.slice("./adr/".length);
      if (!stem.startsWith(`${reference.number}-`)) {
        problems.push(
          `${carrier}: links ${reference.target} but numbers it ADR ${reference.number}`,
        );
      }
    }
    expect(problems).toEqual([]);
  });
});
