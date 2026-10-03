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
 *      that ADR is in. The rule is checked over the LABEL REGION of each ADR
 *      reference — the prose between the previous list delimiter and the link's
 *      target, so it covers a status written before the link AND one written
 *      inside the link's own text. The defect's shape is the first:
 *      `milestone field (Proposed): [ADR 0003](…)` puts the status before the
 *      link, so a link-text-only scan would pass vacuously over the very
 *      sentence it exists to catch. The lifecycle vocabulary in §ADR process
 *      (`Proposed in a PR → Accepted on merge`) is prose about the PROCESS and
 *      carries no ADR reference, so it is not a status claim and does not fire.
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
 * carrier is CLEAN, so rule 1's `problems` array is legitimately empty and an
 * ordinary assertion on it would prove nothing about the scanner. The first
 * test therefore runs the scanner over synthetic carrier text — including the
 * exact pre-fix sentence from this bug — and asserts it finds what it must.
 *
 * Scope: the carrier this item owns (`engineering.md`). `agents.md` and
 * `convention.md` are listed in `CARRIERS` and are clean today, but
 * `convention.md` links to `./adr/0015-done-gate.md`, a file that no longer
 * exists, so rule 2 would fail on it — repairing that link is a separate item
 * (reported on bug-engineering-doc-stale-adr-statuses) and adding these two
 * names to the list is then a one-line change.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const docsDir = join(repoRoot, "ArggonManager/docs");
const adrDir = join(docsDir, "adr");

/**
 * Methodology carriers whose ADR references are pinned. A carrier is a place a
 * status is tempted into; see the Scope note above for why this list is one
 * entry today.
 */
const CARRIERS: readonly string[] = ["ArggonManager/docs/engineering.md"];

/** `./adr/0003-milestone-field.md` — the ADR index link `./adr/README.md` is not one. */
const ADR_LINK = /\(\.\/adr\/(\d{4})-([a-z0-9-]+)\.md\)/g;

/**
 * Delimiters that end one ADR reference's label region and start the next.
 * `·` separates the items of a pointer list, `|` a table cell, and a newline
 * ends the line; `:` is deliberately NOT one, because the defect's own shape is
 * `milestone field (Proposed): [ADR 0003](…)`.
 */
const LABEL_DELIMITERS = /[·|\n]/;

interface CarrierReference {
  /** `0003` */
  number: string;
  /** Prose before the link, plus the link's own text; the target is stripped. */
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
 * Every ADR reference in `source`, in order, with the label region a status
 * claim would be written into. Pure over its input so the premise test can run
 * it over synthetic text.
 */
function adrReferences(source: string): CarrierReference[] {
  const references: CarrierReference[] = [];
  for (const line of source.split("\n")) {
    let from = 0;
    for (const match of line.matchAll(ADR_LINK)) {
      const at = match.index!;
      // The label is what a reader reads as this ADR's description, so it is
      // the only place a status of THAT ADR could be stated.
      const label = line.slice(from, at).split(LABEL_DELIMITERS).pop() ?? "";
      references.push({ number: match[1]!, label, target: `./adr/${match[1]}-${match[2]}.md` });
      from = at + match[0].length;
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
  });

  it("reads a non-empty ADR directory whose files all declare a status (premise)", () => {
    const files = adrFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((file) => declaredStatus(file) === "(no - Status: line)")).toEqual([]);
  });

  it.each(CARRIERS)("%s states no status for any ADR it links to", (carrier) => {
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

  it.each(CARRIERS)("%s links only to ADRs that exist, by their own filename", (carrier) => {
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
