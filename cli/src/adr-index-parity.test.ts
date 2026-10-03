/**
 * ADR index/directory parity (task-adr-readme-index-missing-adr-0020).
 *
 * `ArggonManager/docs/adr/README.md` is a hand-maintained index; the ADR
 * directory is the corpus. Nothing in the build links them, so the index has
 * silently drifted from the directory twice on record:
 *
 *   - rows were simply never added — 0005–0009 and 0020 shipped unindexed
 *     (found while reviewing PR #598), and 0014–0017 before that
 *     (05b31fb6, task-adr-index-rows);
 *   - a status flip landed in the files but not the index — c0cdd60b
 *     ("accept ADRs 0002/0003/0004 retroactively", task-adr-status-housekeeping)
 *     edited the three ADR files and left the index claiming `Proposed`.
 *
 * So this suite pins the two failure modes actually observed, the conventions
 * the index itself promises, and the Title column the first version of this
 * suite left unchecked:
 *
 *   1. MEMBERSHIP, both directions — every ADR file has exactly one row, and
 *      every row resolves to a file that exists in the directory. A new ADR
 *      that ships unindexed fails the first half; a row pointing at a deleted
 *      or renamed ADR fails the second.
 *   2. STATUS AGREEMENT — the row's status cell must classify the ADR the same
 *      way the ADR's own `Status:` line does. The comparison is on the status
 *      CLASS, not on the text, because the index legitimately carries a
 *      qualifier the file spells differently: `Accepted (amended by 0013)`
 *      against a file saying `Accepted`, and `Partially superseded by 0011`
 *      against a file whose line is a markdown link reading
 *      `Partially superseded by [ADR 0011](…) (§2/§3 …); layout superseded by
 *      [ADR 0012](…)`. A misclassification fails — `Proposed` against an
 *      `Accepted` file is exactly the c0cdd60b drift. A status the vocabulary
 *      below does not recognise fails too, so the vocabulary cannot rot into a
 *      silent pass.
 *   3. NAMING + NUMBERING — `NNNN-short-title.md`, four digits, starting at
 *      0001, strictly ascending with no gaps and no duplicates, with the row's
 *      number and link target agreeing with the filename and with the ADR's own
 *      `# NNNN …` heading.
 *   4. ROW ORDER — rows stay in ascending ADR number, so a new row is appended
 *      where a reader expects it.
 *   5. TITLE — the row's title cell is the ADR's own `# NNNN …` heading, minus
 *      the number prefix, byte for byte. An index that misnames a decision is
 *      wrong in a way a reader cannot recover from the link, and a wrong title
 *      used to be invisible to this suite (see the corpus measurement below).
 *
 * Why the title rule is "verbatim unless declared", not "editorial":
 * `task-adr-index-parity-does-not-check-titles` measured the corpus before
 * choosing a rule. Of the 20 indexed ADRs, 17 index titles are byte-equal to
 * their own H1 title and 3 deviate — 0002 and 0018 by appending a parenthetical
 * gloss, 0003 by a near-rewrite ("Milestone field for convention v3" → "Milestone
 * field (folded into v3)"). So the honest reading of "titles are editorial" is
 * "three rows are", not "the index paraphrases by convention": leaving titles
 * unasserted let ANY title pass, and the Title column was decorative.
 *
 * Pinning verbatim bytes outright would force an editorial convention onto those
 * three rows, which the corpus does not follow and no maintainer asked for. So
 * the rule is: **the row copies the ADR's H1, unless the ADR declares otherwise
 * with a `- Index title:` line in its own metadata list.** The declaration lives
 * with the ADR (where an amendment to that ADR already edits one file plus its
 * row) and is the only sanctioned way to diverge — a divergence has to be
 * written down to be legal, which is the difference between deliberate and
 * accidental. 0002/0003/0018 carry their declaration; every other row is a
 * verbatim copy. ADR 0021 (renumbered in PR #605) ships an editorial title too
 * and will need the same one line, which its own parity failure names.
 *
 * Scope: the ADR index and its directory only. Statuses are asserted because
 * they are load-bearing: an index that misreports whether a decision is binding
 * is wrong in a way a reader cannot recover from the link.
 *
 * The suite reads the repository's own docs; it is a doc contract, not a
 * fixture test, so it pins the real corpus (the same posture as
 * prose-format.test.ts, which also runs over the tracked markdown).
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const adrDir = join(repoRoot, "ArggonManager/docs/adr");
const indexPath = join(adrDir, "README.md");

/** `NNNN-short-title.md` — four digits, kebab-case stem (docs/engineering.md). */
const ADR_FILE = /^(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

/** A row is `| [NNNN](./file.md) | Title | Status |` (header/separator excluded). */
const ROW_HEAD = /^\|\s*\[(\d{4})\]\(\.\/([^)]+)\)\s*\|/;

interface Adr {
  /** `0007` */
  number: string;
  /** The ADR's own `- Status:` line, verbatim after the colon. */
  status: string;
  /**
   * The ADR's own `# NNNN Title` heading minus the number prefix: the title a
   * verbatim index row must carry. `null` when the file has no H1 at all, which
   * the title test reports rather than skipping.
   */
  title: string | null;
  /**
   * Every `- Index title:` declaration in the ADR, in document order. Empty when
   * the ADR makes none (the common case); more than one is a reported problem,
   * so a stale second declaration cannot shadow the live one.
   */
  indexTitles: string[];
}

interface Row {
  number: string;
  target: string;
  title: string;
  status: string;
}

function adrFiles(): string[] {
  return readdirSync(adrDir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort();
}

/**
 * The ADR's own metadata: the number, status and title the file declares.
 * These are the authority for the index — the index mirrors them, it does not
 * decide them.
 */
function readAdr(file: string): Adr {
  const source = readFileSync(join(adrDir, file), "utf8");
  const status = source.match(/^-\s*\*{0,2}Status\*{0,2}:\s*(.+)$/m)?.[1]?.trim();
  expect(status, `${file}: no \`- Status:\` line (ADR template minimum)`).toBeTruthy();

  // A missing H1 is not "no title to check": it is an ADR whose indexed title
  // cannot be verified, so it stays `null` and the title test names it instead
  // of passing vacuously over it.
  const heading = source.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = heading === undefined ? null : heading.replace(/^\d{4}\s+/, "");

  return {
    number: file.slice(0, 4),
    status: status as string,
    title,
    indexTitles: readIndexTitles(source),
  };
}

/**
 * Every `- Index title:` declaration in an ADR, values joined across markdown
 * continuation lines: the metadata list already carries multi-line bullets (ADR
 * 0020's `- Amendment (…):` is one), so a wrapped declaration is read as its
 * rendered text instead of being truncated at the first line.
 */
function readIndexTitles(source: string): string[] {
  const lines = source.split("\n");
  const declared: string[] = [];
  lines.forEach((line, at) => {
    const head = line.match(/^-\s*\*{0,2}Index title\*{0,2}:\s*(.*)$/i);
    if (!head) return;
    const parts = [head[1]!.trim()];
    for (let next = at + 1; next < lines.length && /^\s+\S/.test(lines[next]!); next++) {
      parts.push(lines[next]!.trim());
    }
    declared.push(parts.join(" ").replace(/\s+/g, " ").trim());
  });
  return declared;
}

/** Every index row, parsed. Throws on a row whose cells cannot be read. */
function readRows(): Row[] {
  const rows: Row[] = [];
  for (const line of readFileSync(indexPath, "utf8").split("\n")) {
    const head = line.match(ROW_HEAD);
    if (!head) continue;
    const [, number, target] = head;
    // The status cell is last; the title may itself contain a pipe, so only the
    // trailing cell is taken as the status and the rest rejoined as the title.
    const cells = line
      .slice(head[0].length, line.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((cell) => cell.trim());
    expect(cells.length, `row ${number}: expected 2 cells after the ADR link`).toBe(2);
    rows.push({ number, target, title: cells[0], status: cells[1] });
  }
  return rows;
}

/**
 * The binding classification of a status line, longest match first so
 * "Partially superseded" is not read as "Superseded". A status outside this
 * vocabulary returns null and fails the suite: the index must not report a
 * decision in words this check cannot weigh, and a new ADR status class has to
 * be added here deliberately.
 */
const STATUS_CLASSES: ReadonlyArray<readonly [RegExp, string]> = [
  [/partially superseded/i, "Partially superseded"],
  [/superseded/i, "Superseded"],
  [/accepted/i, "Accepted"],
  [/proposed/i, "Proposed"],
  [/rejected/i, "Rejected"],
  [/deprecated/i, "Deprecated"],
];

function statusClass(status: string): string | null {
  return STATUS_CLASSES.find(([pattern]) => pattern.test(status))?.[1] ?? null;
}

describe("ADR index agrees with the ADR directory", () => {
  const files = adrFiles();
  const rows = readRows();
  const present = new Set(files);
  // A row whose target is missing from the directory is reported by its own
  // test below; the per-row checks here skip it rather than throwing ENOENT on
  // a read that has already been diagnosed one test over.
  const resolvable = rows.filter((row) => present.has(row.target));

  it("gives every ADR file exactly one index row (no ADR ships unindexed)", () => {
    // A silently empty directory would make this pass vacuously.
    expect(files.length).toBeGreaterThan(0);

    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.target, (counts.get(row.target) ?? 0) + 1);

    const problems = files
      .filter((file) => (counts.get(file) ?? 0) !== 1)
      .map((file) => `${file}: ${counts.get(file) ?? 0} index row(s), expected exactly 1`);
    expect(problems).toEqual([]);
  });

  it("gives every index row an ADR file (no row points at nothing)", () => {
    // A silently empty index would make the other direction pass vacuously.
    expect(rows.length).toBeGreaterThan(0);

    const problems = rows
      .filter((row) => !present.has(row.target))
      .map((row) => `${row.number} → ./${row.target}: no such file in docs/adr/`);
    expect(problems).toEqual([]);
    // Membership is symmetric once each side is exactly-once: as many rows as
    // ADR files. Stated separately so a row that duplicates one target while
    // another target is missing cannot hide behind the per-file count.
    expect(rows.length).toBe(files.length);
  });

  it("uses NNNN-short-title.md with four-digit, gapless, ascending numbers", () => {
    const problems: string[] = [];
    const numbers = files.map((file) => {
      const match = file.match(ADR_FILE);
      if (!match) {
        problems.push(`${file}: not NNNN-short-title.md (four-digit, kebab-case)`);
        return "";
      }
      return match[1];
    });
    // Monotonic from 0001 with no gaps and no duplicates.
    numbers.forEach((number, at) => {
      if (number === "") return;
      if (number !== String(at + 1).padStart(4, "0")) {
        problems.push(
          `numbering: position ${at + 1} is ${number}, expected ${String(at + 1).padStart(4, "0")}`,
        );
      }
    });
    expect(problems).toEqual([]);
  });

  it("agrees with each ADR on its own number (filename, link label, heading)", () => {
    const problems: string[] = [];
    for (const row of resolvable) {
      const adr = readAdr(row.target);
      const heading = readFileSync(join(adrDir, row.target), "utf8").match(/^#\s+(\d{4})\b/m)?.[1];
      if (row.number !== adr.number) {
        problems.push(`${row.target}: row is labelled ${row.number}, filename says ${adr.number}`);
      }
      if (heading !== adr.number) {
        problems.push(
          `${row.target}: heading says ${heading ?? "(none)"}, filename says ${adr.number}`,
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it("mirrors each ADR's own status, qualifiers aside", () => {
    const problems: string[] = [];
    for (const row of resolvable) {
      const adr = readAdr(row.target);
      const fromFile = statusClass(adr.status);
      const fromIndex = statusClass(row.status);
      if (fromFile === null) {
        problems.push(`${row.target}: file status "${adr.status}" is outside the known vocabulary`);
      } else if (fromIndex === null) {
        problems.push(
          `${row.target}: index status "${row.status}" is outside the known vocabulary`,
        );
      } else if (fromIndex !== fromFile) {
        problems.push(
          `${row.target}: index says "${row.status}" (${fromIndex}), file says "${adr.status}" (${fromFile})`,
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it("keeps rows in ascending ADR number", () => {
    const numbers = rows.map((row) => row.number);
    expect(numbers).toEqual([...numbers].sort());
  });

  it("gives every row a title", () => {
    expect(rows.filter((row) => row.title.length === 0).map((row) => row.number)).toEqual([]);
  });

  it("mirrors each ADR's own title, or the title that ADR declares", () => {
    // Iterates ROWS rather than the resolvable subset and diagnoses an
    // unresolvable target itself, so a row cannot slip past this check by
    // pointing at a file the directory does not contain.
    const problems: string[] = [];
    for (const row of rows) {
      if (!present.has(row.target)) {
        problems.push(
          `${row.number} → ./${row.target}: index title unverifiable — no such file in docs/adr/`,
        );
        continue;
      }
      const adr = readAdr(row.target);
      if (adr.indexTitles.length > 1) {
        problems.push(
          `${row.target}: ${adr.indexTitles.length} \`- Index title:\` declarations (${adr.indexTitles
            .map((declared) => `"${declared}"`)
            .join(", ")}) — keep exactly one, the first is not authoritative once there are two`,
        );
        continue;
      }
      const declared = adr.indexTitles[0];
      if (declared !== undefined && declared.length === 0) {
        problems.push(
          `${row.target}: \`- Index title:\` is empty — state the title or drop the line`,
        );
        continue;
      }
      if (adr.title === null) {
        problems.push(
          `${row.target}: no \`# NNNN …\` heading, so the row title "${row.title}" cannot be verified`,
        );
        continue;
      }
      // A declaration is the ADR's own statement of its index title, so it wins
      // over the H1; absent one, the row must copy the H1 byte for byte.
      const expected = declared ?? adr.title;
      if (row.title !== expected) {
        problems.push(
          declared === undefined
            ? `${row.target}: index title "${row.title}" does not match the ADR's own title "${expected}" — copy the \`# NNNN …\` title into the row, or, if the row is deliberately editorial, declare it as \`- Index title: …\` in ${row.target}`
            : `${row.target}: index title "${row.title}" does not match its declared \`- Index title: ${expected}\` — the declaration is the authority, so fix the row or the declaration`,
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it("declares an index title only where it deliberately diverges", () => {
    // Keeps "declared" meaning "divergent", so the corpus measurement stays
    // reproducible by anyone: declared ⇒ editorial, undeclared ⇒ verbatim. It
    // also means a redundant declaration cannot be left behind to sit between a
    // later H1 edit and the failure that edit produces. File-driven, so a
    // declaration with no row to mirror is named here too.
    const problems: string[] = [];
    for (const file of files) {
      const adr = readAdr(file);
      if (adr.indexTitles.length === 0) continue;
      const [declared] = adr.indexTitles;
      const row = rows.find((candidate) => candidate.target === file);
      if (adr.title !== null && declared === adr.title) {
        problems.push(
          `${file}: \`- Index title: ${declared}\` repeats the \`# NNNN …\` heading — a declaration is how a row diverges, so drop it and copy the heading instead`,
        );
      }
      if (row === undefined) {
        problems.push(`${file}: declares \`- Index title:\` but has no index row to mirror it`);
      } else if (row.title !== declared) {
        problems.push(
          `${file}: declares \`- Index title: ${declared}\` but its row says "${row.title}"`,
        );
      }
    }
    expect(problems).toEqual([]);
  });
});
