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
 * So this suite pins the two failure modes actually observed, plus the
 * conventions the index itself promises:
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
 *
 * Scope: the ADR index and its directory only. Titles are deliberately NOT
 * asserted — index titles are editorial summaries rather than copies of the
 * headings (0018 is titled "Update delivery and distribution channel (release
 * pipeline, update channel, skew, tarballs)" against a bare H1, and 0002/0003
 * are abbreviated), so pinning them would assert a convention the corpus does
 * not follow. Statuses are asserted because those are load-bearing: an index
 * that misreports whether a decision is binding is wrong in a way a reader
 * cannot recover from the link.
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
 * The ADR's own metadata: the number and status the file declares. These are
 * the authority for the index — the index mirrors them, it does not decide.
 */
function readAdr(file: string): Adr {
  const source = readFileSync(join(adrDir, file), "utf8");
  const status = source.match(/^-\s*\*{0,2}Status\*{0,2}:\s*(.+)$/m)?.[1]?.trim();
  expect(status, `${file}: no \`- Status:\` line (ADR template minimum)`).toBeTruthy();
  return { number: file.slice(0, 4), status: status as string };
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

  it("indexes every ADR file exactly once (no ADR ships unindexed)", () => {
    // A silently empty directory would make this pass vacuously.
    expect(files.length).toBeGreaterThan(0);

    const indexed = new Map(
      rows.map((row) => [row.target, rows.filter((r) => r.target === row.target).length]),
    );
    const problems: string[] = [];
    for (const file of files) {
      const count = indexed.get(file) ?? 0;
      if (count !== 1) problems.push(`${file}: ${count} index row(s), expected exactly 1`);
    }
    expect(problems).toEqual([]);
    // Membership is symmetric: as many rows as ADR files.
    expect(rows.length).toBe(files.length);
  });

  it("has no row pointing at a file the directory does not contain", () => {
    const problems = rows
      .filter((row) => !present.has(row.target))
      .map((row) => `${row.number} → ./${row.target}: no such file in docs/adr/`);
    expect(problems).toEqual([]);
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
});
